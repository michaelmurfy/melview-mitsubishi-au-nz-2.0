import {CharacteristicValue, Logger, PlatformAccessory, Service, WithUUID} from "homebridge";
import {MelviewMitsubishiHomebridgePlatform} from "../platform";
import {Unit} from "../data";
import {CommandRotationSpeed} from "../melviewCommand";

export abstract class AbstractService {
    protected service: Service;
    public readonly device: Unit;
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
            this.accessory.addService(this.getServiceType());
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setActive.bind(this))
            .onGet(this.getActive.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setRotationSpeed.bind(this))
            .onGet(this.getRotationSpeed.bind(this));

        // Fan has 5 discrete physical stages (auto/1-4/turbo) mapped to 0/20/40/60/80/100%.
        // minStep of 20 snaps the HomeKit slider to valid positions.
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.minValue = 0;
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.maxValue = 100;
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.minStep = 20;

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
     * Reads the current fan stage from device state and maps to a HomeKit percentage.
     * setfan: 0=auto → 0%, 1 → 20%, 2 → 40%, 3 → 60%, 5 → 80%, 6 → 100%
     */
    async getRotationSpeed(): Promise<CharacteristicValue> {
        const fan = this.device.state?.setfan ?? 0;
        switch (fan) {
            case 0: return 0;   // auto
            case 1: return 20;
            case 2: return 40;
            case 3: return 60;
            case 5: return 80;
            case 6: return 100;
            default: return 0;
        }
    }

    /**
     * Maps a HomeKit percentage back to the device fan stage code and sends the command.
     */
    async setRotationSpeed(value: CharacteristicValue) {
        this.log.debug('RotationSpeed ->', value);
        this.platform.melviewService?.command(
            new CommandRotationSpeed(value, this.device, this.platform));
    }

    protected get log () : Logger {
        return this.platform.log;
    }
}