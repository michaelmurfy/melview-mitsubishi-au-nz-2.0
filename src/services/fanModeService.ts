import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {CharacteristicValue, PlatformAccessory, Service, WithUUID} from 'homebridge';
import {WorkMode} from '../data';
import {AbstractService} from './abstractService';
import {
  CommandFanMode,
  CommandPower,
  CommandRotationSpeed,
} from '../melviewCommand';

/**
 * Exposes a Fanv2 HomeKit service that maps to the AC unit's FAN-only mode.
 * Activating this service powers on the unit and sets mode to WorkMode.FAN (7).
 */
export class FanModeService extends AbstractService {
  private readonly effectiveConfig: { fanSpeed?: boolean };

  public constructor(
    protected readonly platform: MelviewMitsubishiHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.effectiveConfig = (this.accessory.context.effectiveConfig ?? this.platform.config) as {
      fanSpeed?: boolean;
    };

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      `${this.device.name} Fan Speed`,
    );

    // Fan Speed Control — gated by config.fanSpeed (optional, default off)
    if (this.effectiveConfig.fanSpeed) {
      this.service.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);
      const rs = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed);
      rs.props.minValue = 0;
      rs.props.maxValue = 100;
      rs.props.minStep = 20;
      this.service.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.fanStageToPercent(this.device.state?.setfan ?? 0),
      );
      rs.onSet(this.setRotationSpeed.bind(this))
        .onGet(this.getRotationSpeed.bind(this));
    }
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
    const turningOn =
      value === this.platform.Characteristic.Active.ACTIVE || value === true || value === '1';
    this.log.info('Setting', this.getDeviceName(), 'Fan Mode =', turningOn ? 'ON' : 'OFF');
    if (turningOn) {
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

  async getRotationSpeed(): Promise<CharacteristicValue> {
    return this.fanStageToPercent(this.device.state?.setfan ?? 0);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    const newStage = this.percentToFanStage(value as number);
    const currentStage = this.device.state?.setfan ?? 0;
    if (newStage === currentStage) {
      this.log.debug('RotationSpeed unchanged (stage', currentStage, '), skipping command');
      return;
    }
    this.log.debug('RotationSpeed ->', value, '(stage', newStage, ')');
    this.platform.melviewService?.command(
      new CommandRotationSpeed(value, this.device, this.platform));
  }
}
