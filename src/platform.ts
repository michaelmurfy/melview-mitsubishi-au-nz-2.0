import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {MelviewMitsubishiPlatformAccessory} from './platformAccessory';
import {MelviewService} from './melviewService';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MelviewMitsubishiHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public melviewService?: MelviewService;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly accessoryHandlers = new Map<string, MelviewMitsubishiPlatformAccessory>();

  constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.log.debug('Finished initializing platform');

    if (!this.config.user || !this.config.password) {
      this.log.error('Plugin has not been configured. Please enter Melview user credentials.');
      return;
    }

    this.melviewService = new MelviewService(
      this.log,
      this.config,
      this.api);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices().finally();
    });
  }

  /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    try {
      await this.melviewService!.login();
      const r = await this.melviewService!.discover();
      if (!r) {
        return;
      }

      const discoveredUuids = new Set<string>();

      for (let j = 0; j < r.length; j++) {
        const b = r[j];
        this.log.info('Discovered Building [', b.buildingid, '] = \'', b.building,
          '\' with', b.units.length, 'units!');
        for (let i = 0; i < b.units.length; i++) {
          const device = b.units[i];

          const uuid = this.api.hap.uuid.generate(device.unitid);
          discoveredUuids.add(uuid);
          this.log.debug('IDS:', device.unitid, uuid);
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            const s = await this.melviewService!.getStatus(device.unitid);
            existingAccessory.context.device.state = s;
            this.registerAccessoryHandler(existingAccessory);
          } else {
            this.log.info('Adding new accessory:', device.room, '[', device.unitid, ']:', uuid);

            const [c, s] = await Promise.all([
              this.melviewService!.capabilities(device.unitid),
              this.melviewService!.getStatus(device.unitid),
            ]);

            device.capabilities = c;
            device.state = s;

            const accessory = new this.api.platformAccessory(device.room, uuid, this.api.hap.Categories.AIR_CONDITIONER);
            accessory.context.device = device;

            this.registerAccessoryHandler(accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
          }
        }
      }

      this.removeStaleAccessories(discoveredUuids);
    } catch(e) {
      this.log.error('Failed to process platform discovery. Fix the problem and restart the service.');
      this.log.debug(String(e));
    }
  }

  private registerAccessoryHandler(accessory: PlatformAccessory): MelviewMitsubishiPlatformAccessory {
    const existing = this.accessoryHandlers.get(accessory.UUID);
    existing?.stopPolling();

    const handler = new MelviewMitsubishiPlatformAccessory(this, accessory);
    this.accessoryHandlers.set(accessory.UUID, handler);
    return handler;
  }

  private removeStaleAccessories(discoveredUuids: Set<string>) {
    const removed = this.accessories.filter(accessory => !discoveredUuids.has(accessory.UUID));
    if (removed.length === 0) {
      return;
    }

    removed.forEach((accessory) => {
      this.accessoryHandlers.get(accessory.UUID)?.stopPolling();
      this.accessoryHandlers.delete(accessory.UUID);
      this.log.info('Removing accessory no longer present in Melview account:', accessory.displayName);
    });

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removed);
    removed.forEach((accessory) => {
      const index = this.accessories.indexOf(accessory);
      if (index >= 0) {
        this.accessories.splice(index, 1);
      }
    });
  }
}
