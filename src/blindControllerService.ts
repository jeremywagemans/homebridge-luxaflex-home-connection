import { Logger } from 'homebridge';
import * as http from 'http';
import { type } from 'node:os';

const MIN_POSITION = 0;
const MAX_POSITION = 100;
const BLIND_OPENING_TIME = 25000;

const UP_COMMAND = 'up';
const DOWN_COMMAND = 'dn';
const STOP_COMMAND = 'sp';

export type MoveCallback = {
  opening: () => void;
  closing: () => void;
  stopped: () => void;
};

export class BlindControllerService {

  constructor(
    private readonly log: Logger,
    private readonly host: string,
    private readonly controllerId: string,
  ) {}

  move(blindCode: string, targetPosition: number, callbacks: MoveCallback) {
    switch(targetPosition) {
      case MIN_POSITION:
        this.log.debug(`Closing blind ('${blindCode})`);
        callbacks.closing();
        this.close(blindCode);
        break;
      case MAX_POSITION:
        this.log.debug(`Opening blind ('${blindCode}')`);
        callbacks.opening();
        this.open(blindCode);
        break;
      default:
        this.log.debug(`Updating current position to ${targetPosition} ('${blindCode}'): this feature is currently not supported`);
        return;
    }
    setTimeout(() => {
      this.log.debug(`Updating position state to STOPPED (${blindCode})`);
      callbacks.stopped();
    }, BLIND_OPENING_TIME);
  }

  private open(blindCode: string) {
    this.sendCommand(blindCode, UP_COMMAND);
  }

  private close(blindCode: string) {
    this.sendCommand(blindCode, DOWN_COMMAND);
  }

  private stop(blindCode: string) {
    this.sendCommand(blindCode, STOP_COMMAND);
  }

  private sendCommand(blindCode: string, command: string) {
    const hash = Math.floor((Math.random() * 10000) + 1);
    const url = `http://${this.host}:8838/neo/v1/transmit?id=${this.controllerId}&command=${blindCode}-${command}&hash=${hash}`;
    http.get(url, () => {
      this.log.debug(`'${command}' successfully sent to ${blindCode}`);
    }).on('error', (err) => {
      this.log.error(`An error occurred sending '${command}' to ${blindCode}: ${err}`);
    });
  }

}