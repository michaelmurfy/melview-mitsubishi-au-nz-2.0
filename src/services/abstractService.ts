import {CharacteristicValue, Logger, PlatformAccessory, Service, WithUUID} from "homebridge";
import {MelviewMitsubishiHomebridgePlatform} from "../platform";
import {Unit} from "../data";

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.accessory.addService(this.getServiceType() as any);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setActive.bind(this))
            .onGet(this.getActive.bind(this));
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
     * Normalizes HomeKit Active values across number/boolean/string variants.
     */
    protected isActiveOn(value: CharacteristicValue): boolean {
        if (value === this.platform.Characteristic.Active.ACTIVE || value === true || value === 1) {
            return true;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === '1' || normalized === 'true' || normalized === 'active' || normalized === 'on') {
                return true;
            }
        }
        return false;
    }

    protected get log () : Logger {
        return this.platform.log;
    }
}