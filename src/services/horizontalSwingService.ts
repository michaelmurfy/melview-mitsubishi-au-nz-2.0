import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {Unit} from '../data';
import {CommandAirDirectionH} from '../melviewCommand';

/**
 * Exposes a Switch HomeKit service for horizontal airflow swing.
 * ON  = horizontal sweep enabled (sends AH0)
 * OFF = horizontal sweep stopped at centre position (sends AH3)
 *
 * Only registered on models where capabilities.hasairdirh === 1.
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
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    const name = this.device.name ?? this.device.room;
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      name + ' Horizontal Swing',
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    platform.log.info('HORIZONTAL SWING Capability:', this.device.room, '[COMPLETED]');
  }

  async getOn(): Promise<CharacteristicValue> {
    // airdirh 0 = swing is active
    return (this.device.state?.airdirh ?? 1) === 0;
  }

  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('setHorizontalSwing ->', value);
    // 0 = swing, 3 = centre fixed position
    const airdirh = value ? 0 : 3;
    try {
      await this.platform.melviewService?.command(
        new CommandAirDirectionH(airdirh, this.device, this.platform),
      );
    } catch (e) {
      this.platform.log.error('setOn (Horizontal Swing) command failed:', String(e));
      throw e;
    }
  }
}
