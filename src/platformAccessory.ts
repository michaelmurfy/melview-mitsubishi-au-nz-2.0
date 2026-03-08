import {PlatformAccessory} from 'homebridge';

import {MelviewMitsubishiHomebridgePlatform} from './platform';
import {Unit} from './data';
import {HeatCoolService} from './services/heatCoolService';
import {DryService} from './services/dryService';
import {FanModeService} from './services/fanModeService';
import {HorizontalSwingService} from './services/horizontalSwingService';
import {OutdoorTemperatureService} from './services/outdoorTemperatureService';

interface EffectiveConfig {
  dry: boolean;
  fanMode: boolean;
  airflowH: boolean;
  swingMode: boolean;
  fanSpeed: boolean;
  fanSpeedOnMainTile: boolean;
  outdoorTemp: boolean;
  pollIntervalSeconds: number;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MelviewMitsubishiPlatformAccessory {
  private readonly effectiveConfig: EffectiveConfig;
  private dryService?: DryService;
  private fanModeService?: FanModeService;
  private horizontalSwingService?: HorizontalSwingService;
  private outdoorTemperatureService?: OutdoorTemperatureService;
  private acService: HeatCoolService;
  private pollingInterval?: ReturnType<typeof setInterval>;
  constructor(
        private readonly platform: MelviewMitsubishiHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
  ) {
    const device: Unit = accessory.context.device;
    this.effectiveConfig = this.resolveEffectiveConfig(device.unitid);
    this.accessory.context.effectiveConfig = this.effectiveConfig;
    this.accessory.context.connectionHealthy = true;
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mitsubishi Electric')
          .setCharacteristic(this.platform.Characteristic.Model, device.capabilities!.adaptortype)
          .setCharacteristic(this.platform.Characteristic.SerialNumber, device.unitid);

        /*********************************************************
         * HEATER & Cooler Capability
         * see https://developers.homebridge.io/#/service/HeaterCooler
         *********************************************************/
        this.acService = new HeatCoolService(this.platform, this.accessory);
        this.platform.log.info('HEAT/COOL Capability:', device.room, ' [COMPLETED]');
        this.setupMainStatusFault();

        // Remove any cached RotationSpeed on the HeaterCooler service unless
        // explicitly enabled via fanSpeed + fanSpeedOnMainTile.
        if (!(this.effectiveConfig.fanSpeed && this.effectiveConfig.fanSpeedOnMainTile)) {
          if (this.acService.getService().testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
            const staleRs = this.acService.getService().getCharacteristic(this.platform.Characteristic.RotationSpeed);
            this.acService.getService().removeCharacteristic(staleRs);
            this.platform.log.info('FAN SPEED Capability (HeaterCooler):', device.room, ' [REMOVED]');
          }
        }

        /*********************************************************
         * Dehumidifier Capability
         * https://developers.homebridge.io/#/service/HumidifierDehumidifier
         *********************************************************/
        if (this.effectiveConfig.dry && device.capabilities?.hasdrymode === 1) {
          this.dryService = new DryService(this.platform, this.accessory);
          this.platform.log.info('DRY Capability:', device.room, ' [COMPLETED]');
        } else {
          const stale = this.accessory.getService(this.platform.Service.HumidifierDehumidifier);
          if (stale) {
            this.accessory.removeService(stale);
            this.platform.log.info('DRY Capability:', device.room, ' [REMOVED]');
          } else {
            this.platform.log.info('DRY Capability:', device.room, ' [UNAVAILABLE]');
          }
        }

        /*********************************************************
         * Fan-Only Mode / Fan Speed Capability
         *********************************************************/
        if (this.effectiveConfig.fanMode || this.effectiveConfig.fanSpeed) {
          this.fanModeService = new FanModeService(this.platform, this.accessory);
          this.platform.log.info('FAN MODE Capability:', device.room, ' [COMPLETED]');
          // Remove any cached RotationSpeed on the Fanv2 service when fan speed is disabled.
          if (!this.effectiveConfig.fanSpeed) {
            if (this.fanModeService.getService().testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
              const staleRs = this.fanModeService.getService().getCharacteristic(this.platform.Characteristic.RotationSpeed);
              this.fanModeService.getService().removeCharacteristic(staleRs);
              this.platform.log.info('FAN SPEED Capability (Fanv2):', device.room, ' [REMOVED]');
            }
          } else {
            this.platform.log.info('FAN SPEED Capability (Fanv2):', device.room, ' [COMPLETED]');
          }
        } else {
          const stale = this.accessory.getService(this.platform.Service.Fanv2);
          if (stale) {
            this.accessory.removeService(stale);
            this.platform.log.info('FAN MODE Capability:', device.room, ' [REMOVED]');
          }
        }

        /*********************************************************
         * Horizontal Airflow Swing Capability
         * https://developers.homebridge.io/#/service/Switch
         *********************************************************/
        if (this.effectiveConfig.airflowH && device.capabilities?.hasairdirh === 1) {
          this.horizontalSwingService = new HorizontalSwingService(this.platform, this.accessory);
        } else {
          const stale = this.accessory.getService(this.platform.Service.Switch);
          if (stale) {
            this.accessory.removeService(stale);
            this.platform.log.info('HORIZONTAL SWING Capability:', device.room, ' [REMOVED]');
          } else {
            this.platform.log.info('HORIZONTAL SWING Capability:', device.room, ' [UNAVAILABLE]');
          }
        }

        /*********************************************************
         * Outdoor Temperature Sensor
         *********************************************************/
        if (this.effectiveConfig.outdoorTemp &&
            device.state?.outdoortemp && !isNaN(parseFloat(device.state.outdoortemp))) {
          this.outdoorTemperatureService = new OutdoorTemperatureService(this.platform, this.accessory);
          this.platform.log.info('OUTDOOR TEMPERATURE Capability:', device.room, ' [COMPLETED]');
        } else {
          const stale = this.accessory.getService(this.platform.Service.TemperatureSensor);
          if (stale) {
            this.accessory.removeService(stale);
            this.platform.log.info('OUTDOOR TEMPERATURE Capability:', device.room, ' [REMOVED]');
          } else {
            this.platform.log.info('OUTDOOR TEMPERATURE Capability:', device.room, ' [UNAVAILABLE]');
          }
        }

        // Fault/health is represented on the main AC tile via StatusFault.
        // Remove any stale dedicated fault sensor service from older versions.
        const staleFault = this.accessory.getServiceById(this.platform.Service.ContactSensor, 'fault-sensor');
        if (staleFault) {
          this.accessory.removeService(staleFault);
          this.platform.log.info('FAULT SENSOR Capability:', device.room, ' [REMOVED]');
        }

        // Health is represented on the main AC tile via StatusFault.
        // Remove any stale dedicated health sensor service from older versions.
        const staleHealth = this.accessory.getServiceById(this.platform.Service.ContactSensor, 'health-sensor');
        if (staleHealth) {
          this.accessory.removeService(staleHealth);
          this.platform.log.info('HEALTH SENSOR Capability:', device.room, ' [REMOVED]');
        }


        /*********************************************************
         * Polling for state change
         *********************************************************/

        const pollIntervalSeconds = this.getPollIntervalSeconds();
        const pollIntervalMs = this.getJitteredIntervalMs(pollIntervalSeconds * 1000);
        this.platform.log.info('Polling interval:', pollIntervalSeconds, 'seconds (jittered to', pollIntervalMs, 'ms)');
        this.pollingInterval = setInterval(() => {
          this.platform.melviewService?.getStatus(
            this.accessory.context.device.unitid)
            .then(s => {
              // this.platform.log.debug('Updating Accessory State:',
              //   this.accessory.context.device.unitid);
              this.accessory.context.connectionHealthy = true;
              this.accessory.context.device.state = s;
              this.updateMainStatusFault();
            })
            .catch(e => {
              this.accessory.context.connectionHealthy = false;
              this.platform.log.error('Unable to find accessory status. Check the network');
              this.platform.log.debug(e);
              this.updateMainStatusFault();
            });
        }, pollIntervalMs);
  }

  private getPollIntervalSeconds(): number {
    const raw = Number(this.effectiveConfig.pollIntervalSeconds ?? 30);
    if (Number.isNaN(raw)) {
      return 30;
    }
    return Math.min(Math.max(Math.floor(raw), 5), 300);
  }

  private getJitteredIntervalMs(baseIntervalMs: number): number {
    const jitterMaxMs = Math.max(250, Math.floor(baseIntervalMs * 0.1));
    const jitterMs = Math.floor(Math.random() * jitterMaxMs);
    return baseIntervalMs + jitterMs;
  }

  private resolveEffectiveConfig(unitId: string): EffectiveConfig {
    const override = this.getUnitOverride(unitId);
    return {
      dry: this.resolveBoolean('dry', false, override),
      fanMode: this.resolveBoolean('fanMode', false, override),
      airflowH: this.resolveBoolean('airflowH', false, override),
      swingMode: this.resolveBoolean('swingMode', false, override),
      fanSpeed: this.resolveBoolean('fanSpeed', false, override),
      fanSpeedOnMainTile: this.resolveBoolean('fanSpeedOnMainTile', false, override),
      outdoorTemp: this.resolveBoolean('outdoorTemp', false, override),
      pollIntervalSeconds: this.resolveNumber('pollIntervalSeconds', 30, override),
    };
  }

  private getUnitOverride(unitId: string): Record<string, unknown> | undefined {
    const overrides = this.platform.config.perUnitOverrides;
    if (!Array.isArray(overrides)) {
      return undefined;
    }
    return overrides.find((entry) =>
      entry && typeof entry === 'object' && (entry as Record<string, unknown>).unitId === unitId,
    ) as Record<string, unknown> | undefined;
  }

  private resolveBoolean(key: string, fallback: boolean, override?: Record<string, unknown>): boolean {
    if (override && typeof override[key] === 'boolean') {
      return override[key] as boolean;
    }
    const value = this.platform.config[key];
    return typeof value === 'boolean' ? value : fallback;
  }

  private resolveNumber(key: string, fallback: number, override?: Record<string, unknown>): number {
    const value = override && override[key] !== undefined ? override[key] : this.platform.config[key];
    const parsed = Number(value ?? fallback);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  }

  private setupMainStatusFault() {
    const service = this.acService.getService();
    service.addOptionalCharacteristic(this.platform.Characteristic.StatusFault);
    service.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getMainStatusFault.bind(this));
    this.updateMainStatusFault();
  }

  private getMainStatusFault() {
    const hasIssue = this.hasIssue();
    return hasIssue
      ? this.platform.Characteristic.StatusFault.GENERAL_FAULT
      : this.platform.Characteristic.StatusFault.NO_FAULT;
  }

  private updateMainStatusFault() {
    this.acService.getService().updateCharacteristic(
      this.platform.Characteristic.StatusFault,
      this.getMainStatusFault(),
    );
  }

  private hasIssue(): boolean {
    const online = this.accessory.context.connectionHealthy !== false;
    const fault = (this.accessory.context.device.state?.fault ?? '').toString().trim().toLowerCase();
    const hasFault = fault !== '' && fault !== '0' && fault !== 'ok' && fault !== 'none';
    return !online || hasFault;
  }

  public stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }
}
