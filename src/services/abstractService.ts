import {CharacteristicValue, Logger, PlatformAccessory, Service, WithUUID} from "homebridge";
import {MelviewMitsubishiHomebridgePlatform} from "../platform";
import {Unit} from "../data";
import {CommandRotationSpeed} from "../melviewCommand";

export abstract class AbstractService {
    protected service: Service;
    public readonly device: Unit;
    private startupComplete = false;

    protected constructor(
        protected readonly platform: MelviewMitsubishiHomebridgePlatform,
        protected readonly accessory: PlatformAccessory
    ) {
        this.device = accessory.context.device;
        if (!this.device.name) {
            this.device.name = this.getDeviceRoom();
        }
        this.log.info("Set Device:", this.device.name)
        this.service = this.accessory.getService(this.getServiceType()) ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.accessory.addService(this.getServiceType() as any);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setActive.bind(this))
            .onGet(this.getActive.bind(this));

        // Set props BEFORE registering the handler and pre-populating, so HAP
        // never has a value outside the valid stepped range.
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.minValue = 0;
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.maxValue = 100;
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.minStep = 20;

        // Pre-populate BEFORE registering onSet so HAP cache is correct before
        // any HomeKit controller reconnects and pushes its stale cached value.
        this.service.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.fanStageToPercent(this.device.state?.setfan ?? 0),
        );

        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setRotationSpeed.bind(this))
            .onGet(this.getRotationSpeed.bind(this));

        // Allow a 5-second window after startup before honouring onSet for
        // RotationSpeed. HomeKit controllers can push stale cached values back
        // to the bridge when they reconnect, causing spurious fan commands.
        setTimeout(() => { this.startupComplete = true; }, 5000);
    }

    protected abstract getServiceType<T extends WithUUID<typeof Service>>() : T
    protected abstract getDeviceRoom() : string;
    protected abstract getDeviceName() : string;

    get characterisitc() {
        return this.platform.api.hap.Characteristic;
    }

    public getService() : Service {
        return this.service!;
    }

    abstract setActive(value: CharacteristicValue);

    abstract getActive(): Promise<CharacteristicValue>;

    /**
     * Maps a Melview fan stage (0,1,2,3,5,6) to a HomeKit percentage (0–100 in steps of 20).
     */
    protected fanStageToPercent(stage: number): number {
        switch (stage) {
            case 1: return 20;
            case 2: return 40;
            case 3: return 60;
            case 5: return 80;
            case 6: return 100;
            default: return 0; // auto
        }
    }

    /**
     * Maps a HomeKit percentage back to a Melview fan stage code.
     */
    protected percentToFanStage(percent: number): number {
        if (percent <= 0)  { return 0; }
        if (percent <= 20) { return 1; }
        if (percent <= 40) { return 2; }
        if (percent <= 60) { return 3; }
        if (percent <= 80) { return 5; }
        return 6;
    }

    /**
     * Reads the current fan stage from device state and maps to a HomeKit percentage.
     */
    async getRotationSpeed(): Promise<CharacteristicValue> {
        return this.fanStageToPercent(this.device.state?.setfan ?? 0);
    }

    /**
     * Maps a HomeKit percentage back to the device fan stage code and sends the command.
     * Ignores calls during the startup window to prevent HomeKit reconnect-pushes
     * from sending spurious fan commands to the unit.
     */
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

    protected get log () : Logger {
        return this.platform.log;
    }
}