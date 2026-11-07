import { CharacteristicValue, PlatformAccessory, Service, WithUUID } from 'homebridge';
import { MelviewMitsubishiHomebridgePlatform } from '../platform.js';
import { WorkMode } from '../data.js';
import { AbstractService } from './abstractService.js';
import {
  CommandFanMode,
  CommandPower,
  CommandRotationSpeed,
} from '../melviewCommand.js';

/**
 * Fanv2 service.
 * - Fan-speed controller (default): native HomeKit TargetFanState AUTO / MANUAL
 *   plus a 5-stage RotationSpeed slider across whichever mode the AC is running in.
 * - Fan-only mode (`fanMode: true`, `fanSpeed: false`): activating switches the unit
 *   into Melview WorkMode.FAN (7).
 */
export class FanModeService extends AbstractService {
  private readonly effectiveConfig: { fanMode?: boolean; fanSpeed?: boolean };
  private lastManualPercent = 60;
  private startupComplete = false;

  public constructor(
    protected readonly platform: MelviewMitsubishiHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.effectiveConfig = (this.accessory.context.effectiveConfig ?? this.platform.config) as {
      fanMode?: boolean;
      fanSpeed?: boolean;
    };

    const initialStage = this.device.state?.setfan ?? 0;
    if (initialStage > 0) {
      this.lastManualPercent = this.fanStageToPercent(initialStage);
    }

    const c = this.platform.Characteristic;

    if (this.effectiveConfig.fanSpeed) {
      this.service.addOptionalCharacteristic(c.TargetFanState);
      this.service.getCharacteristic(c.TargetFanState)
        .onGet(this.getTargetFanState.bind(this))
        .onSet(this.setTargetFanState.bind(this));

      this.service.addOptionalCharacteristic(c.CurrentFanState);
      this.service.getCharacteristic(c.CurrentFanState)
        .onGet(this.getCurrentFanState.bind(this));

      this.service.addOptionalCharacteristic(c.RotationSpeed);
      const rs = this.service.getCharacteristic(c.RotationSpeed);
      rs.props.minValue = 0;
      rs.props.maxValue = 100;
      rs.props.minStep = 20;
      rs.onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this));

      setTimeout(() => {
        this.startupComplete = true;
      }, 5000);
    } else {
      for (const ch of [c.RotationSpeed, c.TargetFanState, c.CurrentFanState]) {
        if (this.service.testCharacteristic(ch)) {
          this.service.removeCharacteristic(this.service.getCharacteristic(ch));
        }
      }
    }
  }

  protected getServiceType<T extends WithUUID<typeof Service>>(): T {
    return this.platform.Service.Fanv2 as T;
  }

  protected getServiceDisplayName(): string {
    return `${this.device.room} Fan`;
  }

  protected getServiceSubtype(): string {
    return 'fan';
  }

  protected getDeviceRoom(): string {
    return this.device.room;
  }

  protected getDeviceName(): string {
    return this.device.name!;
  }

  private isFanOnlyDedicated(): boolean {
    return this.effectiveConfig.fanMode === true && !this.effectiveConfig.fanSpeed;
  }

  async getActive(): Promise<CharacteristicValue> {
    const c = this.platform.Characteristic;
    if (this.device.state?.power === 0) {
      return c.Active.INACTIVE;
    }
    if (this.isFanOnlyDedicated() && this.device.state?.setmode !== WorkMode.FAN) {
      return c.Active.INACTIVE;
    }
    return c.Active.ACTIVE;
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    const turningOn = this.isActiveOn(value);
    const c = this.platform.Characteristic;
    try {
      if (this.isFanOnlyDedicated()) {
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
        return;
      }

      // Fan-speed tile: turning off drops fan back to Auto without powering off the AC.
      if (!turningOn) {
        if ((this.device.state?.setfan ?? 0) !== 0) {
          await this.platform.melviewService?.command(
            new CommandRotationSpeed(0, this.device, this.platform),
          );
        }
        this.service.updateCharacteristic(c.TargetFanState, c.TargetFanState.AUTO);
        if (this.device.state?.power !== 0) {
          setTimeout(() => {
            this.service.updateCharacteristic(c.Active, c.Active.ACTIVE);
          }, 150);
        }
        return;
      }

      if (this.device.state?.power === 0) {
        await this.platform.melviewService?.command(
          new CommandPower(1, this.device, this.platform),
        );
      }
    } catch (e) {
      this.log.error('setActive (Fan) command failed:', String(e));
    }
  }

  async getTargetFanState(): Promise<CharacteristicValue> {
    const c = this.platform.Characteristic;
    return (this.device.state?.setfan ?? 0) === 0
      ? c.TargetFanState.AUTO
      : c.TargetFanState.MANUAL;
  }

  async setTargetFanState(value: CharacteristicValue): Promise<void> {
    if (!this.startupComplete) {
      return;
    }
    const c = this.platform.Characteristic;
    const toAuto = Number(value) === c.TargetFanState.AUTO;
    this.log.info('Setting', this.getDeviceName(), 'Fan =', toAuto ? 'AUTO' : 'MANUAL');
    try {
      if (toAuto) {
        await this.platform.melviewService?.command(
          new CommandRotationSpeed(0, this.device, this.platform),
        );
      } else {
        const pct = this.lastManualPercent >= 20 ? this.lastManualPercent : 60;
        await this.platform.melviewService?.command(
          new CommandRotationSpeed(pct, this.device, this.platform),
        );
        this.service.updateCharacteristic(c.RotationSpeed, pct);
      }
    } catch (e) {
      this.log.error('setTargetFanState command failed:', String(e));
    }
  }

  async getCurrentFanState(): Promise<CharacteristicValue> {
    const c = this.platform.Characteristic;
    if (this.device.state?.power === 0) {
      return c.CurrentFanState.INACTIVE;
    }
    return c.CurrentFanState.BLOWING_AIR;
  }

  async getRotationSpeed(): Promise<CharacteristicValue> {
    const stage = this.device.state?.setfan ?? 0;
    if (stage === 0) {
      // Show a sensible manual position while TargetFanState indicates AUTO.
      return this.lastManualPercent;
    }
    return this.fanStageToPercent(stage);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    if (!this.startupComplete) {
      this.log.debug('RotationSpeed onSet ignored during startup window (value:', value, ')');
      return;
    }
    const c = this.platform.Characteristic;
    const pct = Number(value);
    const newStage = this.percentToFanStage(pct);
    if (newStage > 0) {
      this.lastManualPercent = this.fanStageToPercent(newStage);
    }
    const currentStage = this.device.state?.setfan ?? 0;
    if (newStage === currentStage) {
      return;
    }
    this.log.info(
      'Setting',
      this.getDeviceName(),
      'Fan Speed =',
      newStage === 0 ? 'AUTO' : `stage ${newStage} (${pct}%)`,
    );
    try {
      await this.platform.melviewService?.command(
        new CommandRotationSpeed(pct, this.device, this.platform),
      );
      this.service.updateCharacteristic(
        c.TargetFanState,
        newStage === 0 ? c.TargetFanState.AUTO : c.TargetFanState.MANUAL,
      );
    } catch (e) {
      this.log.error('setRotationSpeed (Fan) command failed:', String(e));
    }
  }

  public syncFromState(): void {
    const c = this.platform.Characteristic;
    const stage = this.device.state?.setfan ?? 0;
    if (stage > 0) {
      this.lastManualPercent = this.fanStageToPercent(stage);
    }

    void this.getActive().then((active) => {
      this.service.updateCharacteristic(c.Active, active);
    });

    if (this.service.testCharacteristic(c.TargetFanState)) {
      this.service.updateCharacteristic(
        c.TargetFanState,
        stage === 0 ? c.TargetFanState.AUTO : c.TargetFanState.MANUAL,
      );
    }
    if (this.service.testCharacteristic(c.CurrentFanState)) {
      void this.getCurrentFanState().then((cur) => {
        this.service.updateCharacteristic(c.CurrentFanState, cur);
      });
    }
    if (this.service.testCharacteristic(c.RotationSpeed)) {
      this.service.updateCharacteristic(
        c.RotationSpeed,
        stage === 0 ? this.lastManualPercent : this.fanStageToPercent(stage),
      );
    }
  }
}
