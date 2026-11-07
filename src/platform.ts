import fs from 'node:fs';
import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { Unit } from './data.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { MelviewMitsubishiPlatformAccessory } from './platformAccessory.js';
import { MelviewService } from './melviewService.js';

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
      const discoveredUnits: Unit[] = [];

      for (let j = 0; j < r.length; j++) {
        const b = r[j];
        this.log.info('Discovered Building [', b.buildingid, '] = \'', b.building,
          '\' with', b.units.length, 'units!');
        for (let i = 0; i < b.units.length; i++) {
          const device = b.units[i];
          discoveredUnits.push(device);

          const uuid = this.api.hap.uuid.generate(device.unitid);
          discoveredUuids.add(uuid);
          this.log.debug('IDS:', device.unitid, uuid);
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            // Refresh capabilities every launch; localip moves with DHCP and is
            // required for the Melview `lc` to unit `/smart` LAN hop.
            const [c, s] = await Promise.all([
              this.melviewService!.capabilities(device.unitid),
              this.melviewService!.getStatus(device.unitid),
            ]);
            existingAccessory.context.device = {
              ...existingAccessory.context.device,
              ...device,
              capabilities: c,
              state: s,
            };
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

      this.syncDiscoveredUnitsToConfig(discoveredUnits);
      this.removeStaleAccessories(discoveredUuids);
    } catch(e) {
      this.log.error('Failed to process platform discovery. Fix the problem and restart the service.');
      this.log.debug(String(e));
    }
  }

  /**
   * Seed `perUnitOverrides` in Homebridge `config.json` with each discovered
   * unit (room + unitId) so the config UI lists the account's units without
   * making the user look up unit IDs. Existing overrides are preserved.
   */
  private syncDiscoveredUnitsToConfig(units: Unit[]): void {
    try {
      const configPath = this.api.user.configPath();
      const raw = fs.readFileSync(configPath, 'utf8');
      const root = JSON.parse(raw) as { platforms?: Array<Record<string, unknown>> };
      const plat = root.platforms?.find((p) => p?.platform === PLATFORM_NAME);
      if (!plat) {
        return;
      }

      const existing = Array.isArray(plat.perUnitOverrides)
        ? (plat.perUnitOverrides as Array<Record<string, unknown>>)
        : [];
      const byId = new Map<string, Record<string, unknown>>();
      for (const entry of existing) {
        const id = typeof entry?.unitId === 'string' ? entry.unitId : undefined;
        if (id) {
          byId.set(id, { ...entry });
        }
      }

      const defaultBooleans: Record<string, boolean> = {
        fanSpeed: typeof plat.fanSpeed === 'boolean' ? plat.fanSpeed : true,
        swingMode: typeof plat.swingMode === 'boolean' ? plat.swingMode : false,
        dry: typeof plat.dry === 'boolean' ? plat.dry : false,
        outdoorTemp: typeof plat.outdoorTemp === 'boolean' ? plat.outdoorTemp : false,
        airflowH: typeof plat.airflowH === 'boolean' ? plat.airflowH : false,
        fanMode: typeof plat.fanMode === 'boolean' ? plat.fanMode : false,
      };

      let changed = false;
      const merged: Array<Record<string, unknown>> = [];
      for (const unit of units) {
        const current = byId.get(unit.unitid);
        const next: Record<string, unknown> = {
          room: unit.room,
          unitId: unit.unitid,
          ...defaultBooleans,
          ...(current ?? {}),
        };
        next.room = unit.room;
        next.unitId = unit.unitid;
        for (const [k, v] of Object.entries(defaultBooleans)) {
          if (typeof next[k] !== 'boolean') {
            next[k] = v;
            changed = true;
          }
        }
        if (!current || current.room !== unit.room) {
          changed = true;
        }
        merged.push(next);
        byId.delete(unit.unitid);
      }

      if (byId.size > 0 || merged.length !== existing.length) {
        changed = true;
      }

      this.config.perUnitOverrides = merged;
      if (changed) {
        plat.perUnitOverrides = merged;
        fs.writeFileSync(configPath, JSON.stringify(root, null, 2) + '\n', 'utf8');
        this.log.info('Synced', merged.length, 'unit(s) into perUnitOverrides config');
      }
    } catch (e) {
      this.log.debug('Skipping perUnitOverrides config sync:', String(e));
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
