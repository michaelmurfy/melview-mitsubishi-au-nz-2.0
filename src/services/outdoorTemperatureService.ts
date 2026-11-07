import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { MelviewMitsubishiHomebridgePlatform } from '../platform.js';
import { Unit } from '../data.js';

/**
 * Linked outdoor TemperatureSensor on the same accessory as HeaterCooler.
 */
export class OutdoorTemperatureService {
  private readonly service: Service;
  private readonly device: Unit;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    this.service =
      this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'outdoor') ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.accessory.addService(this.platform.Service.TemperatureSensor as any, 'Outdoor', 'outdoor');

    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Outdoor');

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minValue = -50;
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.maxValue = 70;

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    platform.log.info('OUTDOOR TEMPERATURE Capability:', this.device.room, '[COMPLETED]');
  }

  public getService(): Service {
    return this.service;
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const temp = parseFloat(this.device.state?.outdoortemp ?? '');
    return isNaN(temp) ? 0 : temp;
  }

  public syncFromState(): void {
    void this.getCurrentTemperature().then((temp) => {
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temp);
    });
  }
}
