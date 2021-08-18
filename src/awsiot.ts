import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { IClientSubscribeOptions, IClientPublishOptions, IClientOptions } from 'mqtt';
import { Logger } from 'homebridge';

type messageCallback = (topic: string, message: string, packet: string) => void;
type errorCallback = (error: string) => void;

export class AwsIot {
    private mqttServer = 'mqtts://a1s9szm8mw93vy-ats.iot.us-west-2.amazonaws.com:8883';
    private qos:mqtt.QoS = 0;
    private clientID: string;
    private mqttClient: MqttClient;

    // Constructor
    constructor(rootCA: Buffer, privateKey: Buffer, cert: Buffer, messageCallback: messageCallback,
      connectCallback: () => void, errorCallback: errorCallback, log: Logger) {
      const date_ob = new Date();
      this.clientID = 'BDGate' + date_ob.getSeconds();

      log.debug('Initializing AwsIOT...');

      const cliOptions: IClientOptions = {
        clientId: this.clientID,
        clean: true,
        rejectUnauthorized: false,
        ca:rootCA,
        key:privateKey,
        cert:cert,
      };

      //log.debug(cert);
      try {
        this.mqttClient = mqtt.connect(this.mqttServer, cliOptions);
      } catch (e) {
        log.error('Failed to connect to AWSIOT. Verify certificates are valid. ' + e);
        this.mqttClient = mqtt.connect(this.mqttServer);
        return;
      }

      // Register handlers
      this.mqttClient.on('message', messageCallback);
      this.mqttClient.on('connect', connectCallback);
      this.mqttClient.on('error', errorCallback);

      // Subscribe to topic
      const subOptions: IClientSubscribeOptions = {
        qos: this.qos,
      };
      this.mqttClient.subscribe(AwsIotTopic.Status, subOptions);
      log.debug('Initialization Completed!');
    }

    // Publish publishes a message to the given topic
    Publish(topic: AwsIotTopic, message: string) {
      const pubOptions: IClientPublishOptions = {
        qos: this.qos,
        retain: false,
      };
      if (this.mqttClient.connected === true) {
        this.mqttClient.publish(topic, message, pubOptions);
      }
    }
}

export enum AwsIotTopic {
    Command = '$aws/things/tailgate/command',
    Status = '$aws/things/tailgate/status',
}

