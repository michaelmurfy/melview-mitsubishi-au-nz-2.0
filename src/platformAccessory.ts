import {PlatformAccessory} from 'homebridge';

import {MelviewMitsubishiHomebridgePlatform} from './platform';
import {Unit} from './data';
import {HeatCoolService} from './services/heatCoolService';
import {DryService} from './services/dryService';
import {FanModeService} from './services/fanModeService';
import {HorizontalSwingService} from './services/horizontalSwingService';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MelviewMitsubishiPlatformAccessory {
    private dryService?: DryService;
    private fanModeService?: FanModeService;
    private horizontalSwingService?: HorizontalSwingService;
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

        /*********************************************************
         * Dehumidifier Capability
         * https://developers.homebridge.io/#/service/HumidifierDehumidifier
         *********************************************************/
        if (this.platform.config.dry) {
          if (device.capabilities?.hasdrymode === 1) {
            this.dryService = new DryService(this.platform, this.accessory);
            this.platform.log.info('DRY Capability:', device.room, ' [COMPLETED]');
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
        }

        /*********************************************************
         * Horizontal Airflow Swing Capability
         * https://developers.homebridge.io/#/service/Switch
         *********************************************************/
        if (this.platform.config.airflowH) {
          if (device.capabilities?.hasairdirh === 1) {
            this.horizontalSwingService = new HorizontalSwingService(this.platform, this.accessory);
          } else {
            this.platform.log.info('HORIZONTAL SWING Capability:', device.room, ' [UNAVAILABLE]');
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
