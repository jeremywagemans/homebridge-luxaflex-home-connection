import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { BlindControllerService } from './blindControllerService';

const MIN_POSITION = 0;
const MAX_POSITION = 100;
const BLIND_OPENING_TIME = 25000;

export class LuxaflexHomeConnectionPlatform implements DynamicPlatformPlugin {

  private readonly Service: typeof Service = this.api.hap.Service;
  private readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private blindControllerService: BlindControllerService;
  private readonly accessories: PlatformAccessory[] = [];

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
      if (value > MIN_POSITION && value < MAX_POSITION) {
        this.log.debug(`Updating current position to ${value} ('${accessory.displayName}'): this feature is currently not supported`);
        return;
      }
      if (value === MIN_POSITION) {
        this.log.debug(`Closing blind ('${accessory.displayName})`);
        this.blindControllerService.close(blindCode);
        positionStateCharacteristic.setValue(this.Characteristic.PositionState.DECREASING);
      } else {
        this.log.debug(`Opening blind ('${accessory.displayName}')`);
        this.blindControllerService.open(blindCode);
        positionStateCharacteristic.setValue(this.Characteristic.PositionState.INCREASING);
      }
      setTimeout(() => {
        this.log.debug(`Updating position state to STOPPED (${accessory.displayName})`);
        positionStateCharacteristic.setValue(this.Characteristic.PositionState.STOPPED);
        currentPositionCharacteristic.setValue(value);
      }, BLIND_OPENING_TIME);
    });
    this.accessories.push(accessory);
  }

  private discoverAccessories() {
    const blinds = this.config.blinds;
    for (const blind of blinds) {
      const blindName = blind.name;
      const blindCode = blind.code;
      const accessoryUUID = this.api.hap.uuid.generate(blindCode);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === accessoryUUID);
      if (existingAccessory) {
        this.log.info(`Restoring existing accessory from cache: ${blind.name} (${accessoryUUID})`);
      } else {
        this.log.info(`Adding new accessory: ${blind.name} (${accessoryUUID})`);
        const accessory = this.createAccessory(accessoryUUID, blindName, blindCode);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  private createAccessory(accessoryUUID: string, blindName: string, blindCode: string): PlatformAccessory {
    const accessory = new this.api.platformAccessory(blindName, accessoryUUID);
    accessory.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'Luxaflex')
      .setCharacteristic(this.Characteristic.Model, 'Smart-Shade')
      .setCharacteristic(this.Characteristic.SerialNumber, blindCode);
    accessory.context.blindCode = blindCode;
    this.configureAccessory(accessory);
    return accessory;
  }

}
