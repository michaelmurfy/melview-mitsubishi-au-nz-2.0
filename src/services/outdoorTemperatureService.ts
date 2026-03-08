import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {Unit} from '../data';

/**
 * Exposes a TemperatureSensor HomeKit service for the outdoor unit temperature.
 * Read-only — uses the `outdoortemp` field already present in the Melview state payload.
 * Only registered when the initial state poll returns a numeric outdoor temperature.
 */
export class OutdoorTemperatureService {
  private readonly service: Service;
  private readonly device: Unit;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    const name = (this.device.name ?? this.device.room) + ' Outdoor';

    this.service =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.accessory.addService(this.platform.Service.TemperatureSensor as any, name, 'outdoor-temperature');

    this.service.setCharacteristic(this.platform.Characteristic.Name, name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minValue = -50;
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.maxValue = 70;

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    platform.log.info('OUTDOOR TEMPERATURE Capability:', this.device.room, '[COMPLETED]');
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const temp = parseFloat(this.device.state?.outdoortemp ?? '');
    return isNaN(temp) ? 0 : temp;
  }
}
