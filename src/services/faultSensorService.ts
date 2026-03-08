import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {Unit} from '../data';

/**
 * Exposes a ContactSensor HomeKit service for unit fault status.
 * OPEN/DETECTED means a fault is currently reported by the Melview payload.
 */
export class FaultSensorService {
  private readonly service: Service;
  private readonly device: Unit;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;
    const name = (this.device.name ?? this.device.room) + ' Fault';

    this.service =
      this.accessory.getServiceById(this.platform.Service.ContactSensor, 'fault-sensor') ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.accessory.addService(this.platform.Service.ContactSensor as any, name, 'fault-sensor');

    this.service.setCharacteristic(this.platform.Characteristic.Name, name);
    this.service
      .getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensorState.bind(this));
  }

  async getContactSensorState(): Promise<CharacteristicValue> {
    const fault = (this.device.state?.fault ?? '').toString().trim().toLowerCase();
    const hasFault = fault !== '' && fault !== '0' && fault !== 'ok' && fault !== 'none';
    return hasFault
      ? this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }
}
