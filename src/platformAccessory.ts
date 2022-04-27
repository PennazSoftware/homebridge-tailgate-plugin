import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TailgateHomebridgePlatform } from './platform';
import { AwsIot, AwsIotTopic } from './awsiot';
//import { readFileSync } from 'fs';
import { Status } from './status';

/**
 * Tailgate Platform Accessory
 * An instance of this class is created for each accessory the platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export class TailgatePlatformAccessory {
  private service: Service;
  private awsiot: AwsIot;
  private currentGateState: Status = {state: '', previousState: '', timestamp: ''};
  private targetGateState = '';

  constructor(
    private readonly platform: TailgateHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Pennaz Software, LLC')
        .setCharacteristic(this.platform.Characteristic.Model, 'Tailgate')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, '1a2b3c');

      // get the GarageDoorOpener service if it exists, otherwise create a new GarageDoorOpener service
      // you can create multiple services for each accessory
      this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) ||
      this.accessory.addService(this.platform.Service.GarageDoorOpener);

      // set the service name, this is what is displayed as the default name on the Home app
      // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
      this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

      // create handlers for required characteristics
      this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState)
        .onGet(this.handleCurrentDoorStateGet.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState)
        .onGet(this.handleTargetDoorStateGet.bind(this))
        .onSet(this.handleTargetDoorStateSet.bind(this));

      // this.service.getCharacteristic(this.platform.Characteristic.ObstructionDetected)
      //   .onGet(this.handleObstructionDetectedGet.bind(this));

      const platformConfig = this.platform.getConfigProperties();

      const rootCACert = cleanCert(platformConfig.rootCACert);
      const privateKey = cleanCert(platformConfig.privateKey);
      const cert = cleanCert(platformConfig.cert);

      this.awsiot = new AwsIot(rootCACert, privateKey, cert,
        this.statusChangedEventHandler.bind(this), this.connectedEventHandler.bind(this),
        this.errorEventHandler.bind(this), this.platform.log);
  }

  // Handle requests to get the current value of the "Current Door State" characteristic
  handleCurrentDoorStateGet() {
    const currState = this.getDoorStateFromString(this.currentGateState.state);

    this.platform.log.info('Requested GET CurrentDoorState. State=' + this.currentGateState.state + ' currentEnumState=' + currState);
    return currState;
  }

  // Handle requests to get the current value of the "Target Door State" characteristic
  handleTargetDoorStateGet() {
    this.platform.log.info('Requested GET TargetDoorState. State=' + this.targetGateState);

    let targetState = this.platform.Characteristic.TargetDoorState.OPEN;
    if (this.targetGateState === 'close') {
      targetState = this.platform.Characteristic.TargetDoorState.CLOSED;
    }

    return targetState;
  }

  // Handle requests to set the "Target Door State" characteristic
  handleTargetDoorStateSet(value: CharacteristicValue) {
    let cmd = '';

    switch (value) {
      case this.platform.Characteristic.TargetDoorState.OPEN:
        cmd = 'open';
        this.targetGateState = 'open';
        break;
      case this.platform.Characteristic.TargetDoorState.CLOSED:
        cmd = 'close';
        this.targetGateState = 'close';
        break;
    }

    const cmdJSON = {
      command: cmd,
    };

    this.platform.log.info('Command Issued: CurrentState=' + this.currentGateState.state + ', TargetState=' + cmd);

    this.awsiot.Publish(AwsIotTopic.Command, JSON.stringify(cmdJSON));
  }

  // Event Handlers

  // Handle status changed event
  statusChangedEventHandler(topic: string, message: string, packet: string) {
    this.platform.log.debug('message: ' + message);
    const status: Status = JSON.parse(message);
    this.currentGateState = status;

    this.platform.log.info('Gate Status Changed: ' + status.state + ', Topic=' + topic + ', Packet=' + packet);

    const currState = this.getDoorStateFromString(status.state);

    this.platform.log.info('Updated this.currentGateState=' + this.currentGateState.state + ', currState=' + currState);

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, currState);
  }

  connectedEventHandler() {
    this.platform.log.info('Connected to AwsIot endpoint!');
  }

  errorEventHandler(error: string) {
    this.platform.log.debug('AwsIot error: ' + error);
  }

  getDoorStateFromString(state: string) {

    let currentState = this.platform.Characteristic.CurrentDoorState.STOPPED;

    //state = 'closing';

    this.platform.log.debug('converting \'' + state + '\'...');
    switch (state) {
      case 'open': {
        currentState = this.platform.Characteristic.CurrentDoorState.OPEN;
        break;
      }
      case 'opening': {
        currentState = this.platform.Characteristic.CurrentDoorState.OPENING;
        break;
      }
      case 'closed': {
        currentState = this.platform.Characteristic.CurrentDoorState.CLOSED;
        break;
      }
      case 'closing': {
        currentState = this.platform.Characteristic.CurrentDoorState.CLOSING;
        break;
      }
      case 'stopped': {
        currentState = this.platform.Characteristic.CurrentDoorState.STOPPED;
        break;
      }
      default:
        this.platform.log.info('failed to convert string state to enum value. stringState=' + state);
    }

    return currentState;
  }
}

function cleanCert(cert: string) {
  let cleanCert = '';

  for (let x=0; x<cert.length; x++) {
    if (x > 25) {
      if (x < (cert.length-25)) {
        if (cert[x] === ' ') {
          cleanCert += '\n';
        } else {
          cleanCert += cert[x];
        }
      } else {
        cleanCert += cert[x];
      }
    } else {
      cleanCert += cert[x];
    }
  }

  cleanCert += '\n';
  return cleanCert;
  //return Buffer.from(cleanCert, 'utf-8');
}