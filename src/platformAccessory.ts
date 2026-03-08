import {PlatformAccessory} from 'homebridge';

import {MelviewMitsubishiHomebridgePlatform} from './platform';
import {Unit} from './data';
import {HeatCoolService} from './services/heatCoolService';
import {DryService} from './services/dryService';
import {FanModeService} from './services/fanModeService';
import {HorizontalSwingService} from './services/horizontalSwingService';
import {OutdoorTemperatureService} from './services/outdoorTemperatureService';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MelviewMitsubishiPlatformAccessory {
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

        // Remove any cached RotationSpeed on the HeaterCooler service unless
        // explicitly enabled via fanSpeed + fanSpeedOnMainTile.
        if (!(this.platform.config.fanSpeed && this.platform.config.fanSpeedOnMainTile)) {
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
        if (this.platform.config.dry && device.capabilities?.hasdrymode === 1) {
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
         * Fan-Only Mode Capability
         *********************************************************/
        if (this.platform.config.fanMode) {
          this.fanModeService = new FanModeService(this.platform, this.accessory);
          this.platform.log.info('FAN MODE Capability:', device.room, ' [COMPLETED]');
          // Remove any cached RotationSpeed on the Fanv2 service when fan speed is disabled.
          if (!this.platform.config.fanSpeed) {
            if (this.fanModeService.getService().testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
              const staleRs = this.fanModeService.getService().getCharacteristic(this.platform.Characteristic.RotationSpeed);
              this.fanModeService.getService().removeCharacteristic(staleRs);
              this.platform.log.info('FAN SPEED Capability (Fanv2):', device.room, ' [REMOVED]');
            }
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
        if (this.platform.config.airflowH && device.capabilities?.hasairdirh === 1) {
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
        if (this.platform.config.outdoorTemp &&
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


        /*********************************************************
         * Polling for state change
         *********************************************************/

        this.pollingInterval = setInterval(() => {
          this.platform.melviewService?.getStatus(
            this.accessory.context.device.unitid)
            .then(s => {
              // this.platform.log.debug('Updating Accessory State:',
              //   this.accessory.context.device.unitid);
              this.accessory.context.device.state = s;
            })
            .catch(e => {
              this.platform.log.error('Unable to find accessory status. Check the network');
              this.platform.log.debug(e);
            });
        }, 5000);
  }

  public stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }
}
