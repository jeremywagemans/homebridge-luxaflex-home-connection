import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { BlindControllerService } from './blindControllerService';

export class LuxaflexHomeConnectionPlatform implements DynamicPlatformPlugin {

  private readonly Service: typeof Service = this.api.hap.Service;
  private readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private blindControllerService: BlindControllerService;
  private accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug(`Finished initializing platform: ${PLATFORM_NAME}`);
    this.blindControllerService = new BlindControllerService(log, config.controllerIP, config.controllerID);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverAccessories();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Configuring accessory:', accessory.displayName);
    const service = accessory.getService(this.Service.WindowCovering) || accessory.addService(this.Service.WindowCovering);
    service.getCharacteristic(this.Characteristic.TargetPosition).onSet(async (value) => {
      const blindCode = accessory.context.blindCode;
      const positionStateCharacteristic = service.getCharacteristic(this.Characteristic.PositionState);
      const currentPositionCharacteristic = service.getCharacteristic(this.Characteristic.CurrentPosition);
      this.blindControllerService.move(blindCode, value as number, {
        opening: () => positionStateCharacteristic.setValue(this.Characteristic.PositionState.INCREASING),
        closing: () => positionStateCharacteristic.setValue(this.Characteristic.PositionState.DECREASING),
        stopped: () => {
          positionStateCharacteristic.setValue(this.Characteristic.PositionState.STOPPED);
          currentPositionCharacteristic.setValue(value);
        },
      });
    });
    this.accessories.push(accessory);
  }

  private discoverAccessories() {
    const blinds = this.config.blinds;
    const cachedAccessories = [...this.accessories];
    this.accessories = [];
    for (const blind of blinds) {
      const blindName = blind.name;
      const blindCode = blind.code;
      const accessoryUUID = this.api.hap.uuid.generate(blindCode);
      const cachedAccessory = cachedAccessories.find(accessory => accessory.UUID === accessoryUUID);
      if (cachedAccessory) {
        this.log.info(`Restoring existing accessory from cache: ${blind.name} (${accessoryUUID})`);
        this.accessories.push(cachedAccessory);
      } else {
        this.log.info(`Adding new accessory: ${blind.name} (${accessoryUUID})`);
        const newAccessory = this.createAccessory(accessoryUUID, blindName, blindCode);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
      }
    }
    // Removing accessories that have been removed from config
    cachedAccessories.forEach((accessory) => {
      if(!this.accessories.find((it) => it.UUID === accessory.UUID)) {
        this.log.info(`Removing accessory from platform: ${accessory.context.blindName} (${accessory.context.blindCode})`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    });
  }

  private createAccessory(accessoryUUID: string, blindName: string, blindCode: string): PlatformAccessory {
    const accessory = new this.api.platformAccessory(blindName, accessoryUUID);
    accessory.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'Luxaflex')
      .setCharacteristic(this.Characteristic.Model, 'Smart-Shade')
      .setCharacteristic(this.Characteristic.SerialNumber, blindCode);
    accessory.context.blindName = blindName;
    accessory.context.blindCode = blindCode;
    this.configureAccessory(accessory);
    return accessory;
  }

}
