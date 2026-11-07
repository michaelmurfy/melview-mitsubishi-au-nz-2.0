import { CharacteristicValue, Logger, PlatformAccessory, Service, WithUUID } from 'homebridge';
import { MelviewMitsubishiHomebridgePlatform } from '../platform.js';
import { Unit } from '../data.js';
import { fanStageToPercent, percentToFanStage } from '../fanSpeed.js';

export abstract class AbstractService {
  protected service: Service;
  public readonly device: Unit;

  protected constructor(
    protected readonly platform: MelviewMitsubishiHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;
    if (!this.device.name) {
      this.device.name = this.device.room || this.getDeviceRoom();
    }
    this.log.debug('Set Device service:', this.getServiceDisplayName());
    this.service = this.findOrCreateService();
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.getServiceDisplayName());
    if (this.service.testCharacteristic(this.platform.Characteristic.ConfiguredName)) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        this.getServiceDisplayName(),
      );
    }

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));
  }

  protected abstract getServiceType<T extends WithUUID<typeof Service>>(): T;
  protected abstract getDeviceRoom(): string;
  protected abstract getDeviceName(): string;

  /** Short HomeKit label for linked services (e.g. "Dry"). */
  protected getServiceDisplayName(): string {
    return this.device.name ?? this.getDeviceRoom();
  }

  /** Stable subtype so linked services survive restarts without colliding. */
  protected getServiceSubtype(): string | undefined {
    return undefined;
  }

  private findOrCreateService(): Service {
    const type = this.getServiceType();
    const subtype = this.getServiceSubtype();
    if (subtype) {
      return this.accessory.getServiceById(type, subtype) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.accessory.addService(type as any, this.getServiceDisplayName(), subtype);
    }
    return this.accessory.getService(type) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.accessory.addService(type as any);
  }

  get characteristic() {
    return this.platform.api.hap.Characteristic;
  }

  /**
   * Push the latest polled device state into HomeKit characteristics.
   */
  public syncFromState(): void {
    const active = this.device.state?.power === 0
      ? this.platform.Characteristic.Active.INACTIVE
      : this.platform.Characteristic.Active.ACTIVE;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
  }

  public getService(): Service {
    return this.service!;
  }

  abstract setActive(value: CharacteristicValue): Promise<void>;

  abstract getActive(): Promise<CharacteristicValue>;

  protected fanStageToPercent(stage: number): number {
    return fanStageToPercent(stage);
  }

  protected percentToFanStage(percent: number): number {
    return percentToFanStage(percent);
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

  protected get log(): Logger {
    return this.platform.log;
  }
}
