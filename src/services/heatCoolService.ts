import {MelviewMitsubishiHomebridgePlatform} from "../platform";
import {CharacteristicValue, PlatformAccessory, Service, WithUUID} from "homebridge";
import {WorkMode} from "../data";
import {AbstractService} from "./abstractService";
import {
    CommandPower,
    CommandTargetHeaterCoolerState,
    CommandTemperature,
    CommandAirDirection,
    CommandRotationSpeed,
} from "../melviewCommand";

export class HeatCoolService extends AbstractService {
    private startupComplete = false;
    private readonly effectiveConfig: { fanSpeed?: boolean; fanSpeedOnMainTile?: boolean };

    constructor(
        protected readonly platform: MelviewMitsubishiHomebridgePlatform,
        protected readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);
        this.effectiveConfig = (this.accessory.context.effectiveConfig ?? this.platform.config) as {
            fanSpeed?: boolean;
            fanSpeedOnMainTile?: boolean;
        };

        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onSet(this.setTargetHeaterCoolerState.bind(this))
            .onGet(this.getTargetHeaterCoolerState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minValue = -50;
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.maxValue = 70;
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minStep = 0.5;

        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onSet(this.setCoolingThresholdTemperature.bind(this))
            .onGet(this.getCoolingThresholdTemperature.bind(this));;
        const cool = this.device.state!.max![WorkMode.COOL + ''];
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue = cool.min;
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue = cool.max;
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minStep = 0.5;

        this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onSet(this.setHeatingThresholdTemperature.bind(this))
            .onGet(this.getHeatingThresholdTemperature.bind(this));
        const heat = this.device.state!.max![WorkMode.HEAT + ''];
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue = heat.min;
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue = heat.max;
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minStep = 0.5;

        // Vertical airflow direction / swing — only on supported models
        if (this.device.capabilities?.hasswing === 1 || this.device.capabilities?.hasairdir === 1) {
            this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
                .onSet(this.setSwingMode.bind(this))
                .onGet(this.getSwingMode.bind(this));
        }

        // Fan Speed Control on main AC tile — optional, disabled by default.
        // Requires fanSpeed=true and fanSpeedOnMainTile=true.
        if (this.effectiveConfig.fanSpeed && this.effectiveConfig.fanSpeedOnMainTile) {
            this.service.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);
            const rs = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed);
            rs.props.minValue = 0;
            rs.props.maxValue = 100;
            rs.props.minStep = 20;
            this.service.updateCharacteristic(
                this.platform.Characteristic.RotationSpeed,
                this.fanStageToPercent(this.device.state?.setfan ?? 0),
            );
            rs.onSet(this.setRotationSpeed.bind(this))
                .onGet(this.getRotationSpeed.bind(this));
            // Ignore onSet calls during 5-second startup window to prevent
            // HomeKit controllers pushing stale cached values back to the unit.
            setTimeout(() => { this.startupComplete = true; }, 5000);
        }
    }

    protected getServiceType<T extends WithUUID<typeof Service>>() : T {
        return this.platform.Service.HeaterCooler as T;
    }

    protected getDeviceRoom(): string {
        return this.device.room;
    }

    protected getDeviceName() : string {
        return this.device.name!;
    }

    async getActive(): Promise<CharacteristicValue> {
        const power = this.device.state?.power ?? -1;
        const mode = this.device.state?.setmode ?? -1;
        this.log.debug('getActive power=', power, 'mode=', mode);
        return power === 0
            ? this.platform.Characteristic.Active.INACTIVE
            : this.platform.Characteristic.Active.ACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        const c = this.platform.Characteristic;
        const turningOn = this.isActiveOn(value);
        this.log.info('Setting', this.getDeviceName(), turningOn ? 'ON' : 'OFF');
        if (!this.platform.melviewService) {
            this.log.error('melviewService is not initialised — check credentials in config');
            return;
        }
        try {
            if (turningOn) {
                const currentMode = this.device.state?.setmode;
                const inferredTarget =
                    currentMode === WorkMode.HEAT ? c.TargetHeaterCoolerState.HEAT :
                        currentMode === WorkMode.COOL ? c.TargetHeaterCoolerState.COOL :
                            currentMode === WorkMode.AUTO ? c.TargetHeaterCoolerState.AUTO :
                                c.TargetHeaterCoolerState.AUTO;
                const restoreTarget = this.accessory.context.lastMainTargetState ?? inferredTarget;

                // Always restore/affirm a valid main-tile mode when turning on.
                await this.platform.melviewService.command(
                    new CommandPower(1, this.device, this.platform),
                    new CommandTargetHeaterCoolerState(restoreTarget, this.device, this.platform),
                );

                // Optimistically reflect ON state immediately in HomeKit.
                this.service.updateCharacteristic(c.Active, c.Active.ACTIVE);
                this.service.updateCharacteristic(c.TargetHeaterCoolerState, restoreTarget);
                const currentState = await this.getCurrentHeaterCoolerState(
                    restoreTarget === c.TargetHeaterCoolerState.HEAT ? WorkMode.HEAT :
                        restoreTarget === c.TargetHeaterCoolerState.COOL ? WorkMode.COOL :
                            WorkMode.AUTO,
                );
                this.service.updateCharacteristic(c.CurrentHeaterCoolerState, currentState);
            } else {
                await this.platform.melviewService.command(
                    new CommandPower(0, this.device, this.platform));

                // Optimistically reflect OFF state immediately in HomeKit.
                this.service.updateCharacteristic(c.Active, c.Active.INACTIVE);
                this.service.updateCharacteristic(c.CurrentHeaterCoolerState, c.CurrentHeaterCoolerState.INACTIVE);
            }
        } catch (e) {
            this.log.error('setActive command failed:', String(e));
            throw e; // re-throw so HomeKit knows the command failed
        }
    }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        this.platform.log.debug('setCoolingThresholdTemperature ->', value);
        const minVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue!;
        if ((value as number) < minVal) {
            this.platform.log.warn('setCoolingThresholdTemperature ->', value, 'is illegal - updating to', minVal);
            value = minVal;
        } else if ((value as number) > maxVal) {
            this.platform.log.warn('setCoolingThresholdTemperature ->', value, 'is illegal - updating to', maxVal);
            value = maxVal;
        }
        this.platform.melviewService?.command(
            new CommandTemperature(value, this.device, this.platform));
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        const temp = parseFloat(this.device.state!.settemp)
        const minVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue!;
        if (temp < minVal) {
            return minVal;
        } else if (temp > maxVal) {
            return maxVal;
        }
        return temp;
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        this.platform.log.debug('setHeatingThresholdTemperature:', value);
        const minVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue!;
        if ((value as number) < minVal) {
            this.platform.log.warn('setHeatingThresholdTemperature ->', value, 'is illegal - updating to', minVal);
            value = minVal;
        } else if ((value as number) > maxVal) {
            this.platform.log.warn('setHeatingThresholdTemperature ->', value, 'is illegal - updating to', maxVal);
            value = maxVal;
        }

        this.platform.melviewService?.command(
            new CommandTemperature(value, this.device, this.platform));
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        const temp = parseFloat(this.device.state!.settemp)
        const minVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue!;
        if (temp < minVal) {
            return minVal;
        } else if (temp > maxVal) {
            return maxVal;
        }
        return temp;
    }

    async getCurrentHeaterCoolerState(mode?:number): Promise<CharacteristicValue> {
        if (!mode) {
            mode = this.device.state!.setmode;
        }
        const c = this.platform.api.hap.Characteristic;
        if (this.device.state?.power === 0) {
            this.platform.log.debug('getCurrentHeaterCoolerState: INACTIVE (power off)');
            return c.CurrentHeaterCoolerState.INACTIVE;
        }
        const roomTemp = parseFloat(this.device.state!.roomtemp);
        const targTemp = parseFloat(this.device.state!.settemp);
        switch (mode) {
            case WorkMode.COOL:
                this.platform.log.debug('getCurrentHeaterCoolerState: COOLING');
                return c.CurrentHeaterCoolerState.COOLING;
            case WorkMode.DRY:
            case WorkMode.FAN:
                this.platform.log.debug('getCurrentHeaterCoolerState: IDLE');
                return c.CurrentHeaterCoolerState.IDLE;
            case WorkMode.HEAT:
                this.platform.log.debug('getCurrentHeaterCoolerState: HEATING');
                return c.CurrentHeaterCoolerState.HEATING;
            case WorkMode.AUTO:
                if (roomTemp < targTemp) {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): HEATING, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.HEATING;
                } else if (roomTemp > targTemp) {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): COOLING, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.COOLING;
                } else {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): IDLE, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.IDLE;
                }
        }
        this.platform.log
            .error('getCurrentHeaterCoolerState (UNKNOWN STATE)', mode);
        return c.CurrentHeaterCoolerState.INACTIVE;
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        this.platform.log.debug('setTargetHeaterCoolerState ->', value);
        await this.platform.melviewService?.command(
            new CommandTargetHeaterCoolerState(value, this.device, this.platform));
        this.accessory.context.lastMainTargetState = value;
        const c = this.platform.Characteristic;
        switch (value) {
            case c.TargetHeaterCoolerState.COOL:
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, c.CurrentHeaterCoolerState.COOLING);
                return;
            case c.TargetHeaterCoolerState.HEAT:
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, c.CurrentHeaterCoolerState.HEATING);
                return;
            case c.TargetHeaterCoolerState.AUTO:
                const state = await this.getCurrentHeaterCoolerState(WorkMode.AUTO);
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, state);
        }
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        const mode = this.device.state!.setmode;
        const c = this.platform.api.hap.Characteristic;
        switch (mode) {
            case WorkMode.HEAT:
                this.platform.log.debug('getTargetHeaterCoolerState -> HEAT');
                return c.TargetHeaterCoolerState.HEAT;
            case WorkMode.COOL: /*case WorkMode.FAN: case WorkMode.DRY:*/
                this.platform.log.debug('getTargetHeaterCoolerState -> COOL');
                return c.TargetHeaterCoolerState.COOL;
            case WorkMode.AUTO:
                this.platform.log.debug('getTargetHeaterCoolerState -> AUTO');
                return c.TargetHeaterCoolerState.AUTO;
        }
        this.platform.log.debug('getTargetHeaterCoolerState -> AUTO');
        return c.TargetHeaterCoolerState.AUTO;
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return parseFloat(this.device.state!.roomtemp);
    }

    async getSwingMode(): Promise<CharacteristicValue> {
        const airdir = this.device.state?.airdir ?? 1;
        return airdir === 0
            ? this.platform.Characteristic.SwingMode.SWING_ENABLED
            : this.platform.Characteristic.SwingMode.SWING_DISABLED;
    }

    async setSwingMode(value: CharacteristicValue) {
        this.platform.log.debug('setSwingMode ->', value);
        // airdir 0 = swing, 1 = first fixed position (top)
        const airdir = value === this.platform.Characteristic.SwingMode.SWING_ENABLED ? 0 : 1;
        await this.platform.melviewService?.command(
            new CommandAirDirection(airdir, this.device, this.platform));
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        return this.fanStageToPercent(this.device.state?.setfan ?? 0);
    }

    async setRotationSpeed(value: CharacteristicValue) {
        if (!this.startupComplete) {
            this.log.debug('RotationSpeed onSet ignored during startup window (value:', value, ')');
            return;
        }
        const newStage = this.percentToFanStage(value as number);
        const currentStage = this.device.state?.setfan ?? 0;
        if (newStage === currentStage) {
            this.log.debug('RotationSpeed unchanged (stage', currentStage, '), skipping command');
            return;
        }
        this.log.debug('RotationSpeed ->', value, '(stage', newStage, ')');
        this.platform.melviewService?.command(
            new CommandRotationSpeed(value, this.device, this.platform));
    }
}