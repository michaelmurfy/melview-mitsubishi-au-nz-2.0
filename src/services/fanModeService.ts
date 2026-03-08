import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {CharacteristicValue, PlatformAccessory, Service, WithUUID} from 'homebridge';
import {WorkMode} from '../data';
import {AbstractService} from './abstractService';
import {
  CommandFanMode,
  CommandPower,
} from '../melviewCommand';

/**
 * Exposes a Fanv2 HomeKit service that maps to the AC unit's FAN-only mode.
 * Activating this service powers on the unit and sets mode to WorkMode.FAN (7).
 */
export class FanModeService extends AbstractService {
  public constructor(
    protected readonly platform: MelviewMitsubishiHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
  }

  protected getServiceType<T extends WithUUID<typeof Service>>(): T {
    return this.platform.Service.Fanv2 as T;
  }

  protected getDeviceRoom(): string {
    return this.device.room + ' Fan';
  }

  protected getDeviceName(): string {
    return this.device.name!;
  }

  async getActive(): Promise<CharacteristicValue> {
    if (this.device.state?.setmode !== WorkMode.FAN) {
      return this.platform.Characteristic.Active.INACTIVE;
    }
    return this.device.state!.power === 0
      ? this.platform.Characteristic.Active.INACTIVE
      : this.platform.Characteristic.Active.ACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    this.log.info('Setting', this.getDeviceName(), 'Fan Mode =', value === 0 ? 'OFF' : 'ON');
    if (value === this.platform.Characteristic.Active.ACTIVE) {
      await this.platform.melviewService?.command(
        new CommandPower(1, this.device, this.platform),
        new CommandFanMode(WorkMode.FAN, this.device, this.platform),
      );
    } else {
      await this.platform.melviewService?.command(
        new CommandPower(0, this.device, this.platform),
      );
    }
  }
}
