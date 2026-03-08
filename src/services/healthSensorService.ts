import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {Unit} from '../data';

/**
 * Exposes a ContactSensor HomeKit service for unit health.
 * DETECTED means unhealthy (offline or fault), NOT_DETECTED means healthy.
 */
export class HealthSensorService {
  private readonly service: Service;
  private readonly device: Unit;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;
    const name = (this.device.name ?? this.device.room) + ' Health';

    this.service =
      this.accessory.getServiceById(this.platform.Service.ContactSensor, 'health-sensor') ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.accessory.addService(this.platform.Service.ContactSensor as any, name, 'health-sensor');

    this.service.setCharacteristic(this.platform.Characteristic.Name, name);
    this.service
      .getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensorState.bind(this));
  }

  async getContactSensorState(): Promise<CharacteristicValue> {
    const online = this.accessory.context.connectionHealthy !== false;
    const fault = (this.device.state?.fault ?? '').toString().trim().toLowerCase();
    const hasFault = fault !== '' && fault !== '0' && fault !== 'ok' && fault !== 'none';
    return (!online || hasFault)
      ? this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }
}
