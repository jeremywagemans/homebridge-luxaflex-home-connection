import { Logger } from 'homebridge';
import * as http from 'http';

const UP_COMMAND = 'up';
const DOWN_COMMAND = 'dn';
const STOP_COMMAND = 'sp';

export class BlindControllerService {

  constructor(
    private readonly log: Logger,
    private readonly host: string,
    private readonly controllerId: string,
  ) {}

  open(blindCode: string) {
    this.sendCommand(blindCode, UP_COMMAND);
  }

  close(blindCode: string) {
    this.sendCommand(blindCode, DOWN_COMMAND);
  }

  stop(blindCode: string) {
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