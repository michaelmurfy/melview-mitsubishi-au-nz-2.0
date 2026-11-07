import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { MelviewMitsubishiHomebridgePlatform } from '../platform.js';
import { Unit } from '../data.js';
import { CommandAirDirectionH } from '../melviewCommand.js';

/**
 * Linked Switch for horizontal airflow swing (same accessory card as HeaterCooler).
 * ON  = horizontal sweep (AH0)
 * OFF = centre fixed (AH3)
 */
export class HorizontalSwingService {
  private readonly service: Service;
  private readonly device: Unit;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    this.service =
      this.accessory.getServiceById(this.platform.Service.Switch, 'airflow-h') ||
      this.accessory.addService(this.platform.Service.Switch, 'Horizontal Swing', 'airflow-h');

    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Horizontal Swing');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    platform.log.info('HORIZONTAL SWING Capability:', this.device.room, '[COMPLETED]');
  }

  public getService(): Service {
    return this.service;
  }

  async getOn(): Promise<CharacteristicValue> {
    return (this.device.state?.airdirh ?? 1) === 0;
  }

  async setOn(value: CharacteristicValue) {
    if (this.device.state?.power === 0) {
      this.platform.log.debug('setOn (Horizontal Swing) skipped - unit is powered off');
      return;
    }
    this.platform.log.debug('setHorizontalSwing ->', value);
    const airdirh = value ? 0 : 3;
    try {
      await this.platform.melviewService?.command(
        new CommandAirDirectionH(airdirh, this.device, this.platform),
      );
    } catch (e) {
      this.platform.log.error('setOn (Horizontal Swing) command failed:', String(e));
    }
  }

  public syncFromState(): void {
    void this.getOn().then((on) => {
      this.service.updateCharacteristic(this.platform.Characteristic.On, on);
    });
  }
}
