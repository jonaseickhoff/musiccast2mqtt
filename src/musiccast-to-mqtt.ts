
import { StaticLogger } from './static-logger';
import mqtt, { MqttClient, IClientPublishOptions } from 'mqtt';
import { Config } from './config';
import { MusiccastDiscoverer, DiscoveredMusiccastDevice } from './musiccast-discoverer';
import { setTimeout, clearTimeout } from 'timers';
import { MusiccastDevice } from './musiccast-device';
import { McZoneId } from './musiccast-features';
import { MusiccastEventListener } from './musiccast-event-listener';


export class MusiccastToMqtt {
    private readonly log = StaticLogger.CreateLoggerForSource('Musiccast2mqtt.main');
    private readonly mcDiscoverer = new MusiccastDiscoverer();

    private readonly mqtt_uri: string;
    private readonly mqtt_prefix: string;
    private readonly mqtt_insecure: boolean;
    private readonly mqtt_retain: boolean;
    private readonly pollingInterval: number;
    private readonly useFriendlyNames: boolean;
    private mqttClient?: MqttClient;
    private mqttConnected: boolean;
    private pollingTimeout: NodeJS.Timeout;

    public static readonly mcDevices: { [device_id: string]: MusiccastDevice } = {};

    constructor(private config: Config) {
        this.mqtt_uri = config.mqtt;
        this.mqtt_prefix = config.prefix;
        this.mqtt_insecure = config.insecure;
        this.mqtt_retain = config.mqttRetain;
        this.mqttConnected = false;
        this.useFriendlyNames = config.friendlynames === 'name';

        this.createDevicesFromIps(config.devices);

        if (config.pollingInterval > 0) {
            this.pollingInterval = config.pollingInterval * 1000;
            this.pollingTimeout = setTimeout(() => this.pollDeviceStatus(), this.pollingInterval);
        }
    }

    public async start(): Promise<boolean> {
        let success: boolean = true
        this.connect();
        return success;
    }

    public stop(): void {
        MusiccastEventListener.DefaultInstance.StopListener();
        clearTimeout(this.pollingTimeout);
        this.mqttClient?.end()
    }

    public deviceUpdated(device: MusiccastDevice, topic: string, payload: any): void {
        let deviceName: string;
        if (this.useFriendlyNames) {
            deviceName = device.name;
        } else {
            deviceName = device.device_id;
        }
        this.publish(`${deviceName}/${topic}`, payload, { retain: this.mqtt_retain, qos: 0 });
    }

    private connect(): void {
        this.log.info('mqtt trying to connect {mqtt_url}', this.mqtt_uri);

        this.mqttClient = mqtt.connect(this.mqtt_uri, {
            clientId: this.mqtt_prefix + '_' + Math.random().toString(16).substr(2, 8),
            will: { topic: this.mqtt_prefix + '/connected', payload: '0', qos: 0, retain: this.mqtt_retain },
            rejectUnauthorized: !this.mqtt_insecure
        });

        this.mqttClient.on('connect', () => {
            this.mqttConnected = true;
            this.log.info('mqtt connected {uri}', this.mqtt_uri);
            this.mqttClient.publish(this.mqtt_prefix + '/connected', '1', { qos: 0, retain: this.mqtt_retain })
            this.log.info('mqtt subscribe {topic1}', this.mqtt_prefix + '/set/#');
            this.mqttClient.subscribe([this.mqtt_prefix + '/set/#']);
        });

        this.mqttClient.on('close', () => {
            if (this.mqttConnected) {
                this.mqttConnected = false;
                this.log.info('mqtt closed ' + this.mqtt_uri);
            }
        });

        this.mqttClient.on('error', err => {
            this.log.error('mqtt', err.toString());
        });

        this.mqttClient.on('offline', () => {
            this.log.error('mqtt offline');
        });

        this.mqttClient.on('reconnect', () => {
            this.log.debug('mqtt reconnect');
        });

        this.mqttClient.on('message', (topic, payload: any) => {
            this.log.debug('mqtt <', topic, payload);
            try {
                payload = payload.toString();
                if (payload.indexOf('{') !== -1 || payload.indexOf('[') !== -1) {
                    try {
                        payload = JSON.parse(payload);
                    } catch (err) {
                        this.log.error(err.toString());
                    }
                } else if (payload === 'false') {
                    payload = false;
                } else if (payload === 'true') {
                    payload = true;
                } else if (!isNaN(payload)) {
                    payload = parseFloat(payload);
                }


                const topics: string[] = topic.split('/');

                switch (topics[1]) {
                    case 'set':
                        switch (topics[2]) {
                            case 'discover':
                                if (payload === 1) {
                                    this.discover();
                                }
                                break;
                            default:
                                if (this.useFriendlyNames) {
                                    const device: MusiccastDevice | undefined = Object.values(MusiccastToMqtt.mcDevices).find(d => d.name === topics[2])
                                    if (device !== undefined) {
                                        device.setMqtt(topic, payload);
                                    }
                                    else {
                                        this.log.error('unknown {2}', topics[2]);

                                    }
                                }
                                else {
                                    if (topics[2] in MusiccastToMqtt.mcDevices) {
                                        let device: MusiccastDevice = MusiccastToMqtt.mcDevices[topics[2]]
                                        device.setMqtt(topic, payload);
                                    }
                                    else {
                                        this.log.error('unknown {2}', topics[2]);
                                    }
                                }
                        };
                        break;
                    default:
                        this.log.error('unknown {1}', topics[1]);
                }
            } catch (error) {
                this.log.error("Error while receiving mqtt message: {error}", error)
            }
        });
    }

    private publish(topic: string, payload: string | any, options: IClientPublishOptions = {} as IClientPublishOptions): void {
        topic = `${this.mqtt_prefix}/${topic}`
        if (typeof payload === 'number')
            payload = payload.toString();
        if (typeof payload === 'boolean')
            payload = payload === true ? 'true' : 'false'
        this.log.verbose('Mqtt publish to {topic} {payload}', topic, payload)
        if (typeof payload !== 'string')
            payload = JSON.stringify(payload);
        this.mqttClient?.publish(topic, payload, options)
    }


    private async pollDeviceStatus(): Promise<void> {
        this.log.debug("Poll Musiccast device status.")
        try {
            await Promise.all(Object.values(MusiccastToMqtt.mcDevices).map(async (device) => {
                await device.pollDevice();
            }));
        }
        catch (error) {
            this.log.error("Error polling Musiccast device status: {error}", error);
        }
        this.pollingTimeout = setTimeout(() => this.pollDeviceStatus(), this.pollingInterval);
    }

    private async discover(): Promise<void> {
        this.publish('discover', { lastDiscover: new Date().toISOString(), discovering: true }, { retain: this.mqtt_retain, qos: 0 });
        let devices: DiscoveredMusiccastDevice[] = await this.mcDiscoverer.discover(15000);
        this.publish('discover', { lastDiscover: new Date().toISOString(), discovering: false, discoveredDevices: devices }, { retain: this.mqtt_retain, qos: 0 });

        devices.forEach(device => {
            if (device.device_id in MusiccastToMqtt.mcDevices) {
                this.log.debug("Update Musiccast device: {device}", JSON.stringify(device));
                MusiccastToMqtt.mcDevices[device.device_id].ip = device.ip;
                MusiccastToMqtt.mcDevices[device.device_id].name = device.name;
                MusiccastToMqtt.mcDevices[device.device_id].model = device.model;
            }
            else {
                this.log.debug("Add new Musiccast device: {device}", JSON.stringify(device));
                MusiccastToMqtt.mcDevices[device.device_id] = new MusiccastDevice(device.device_id, device.ip, device.model, (device, topic, payload) => this.deviceUpdated(device, topic, payload));
            }
        });
    }

    private async createDevicesFromIps(devices: string[]) {
        for (const device of devices) {
            let mcDevice = await MusiccastDevice.fromIp(device, (device, topic, payload) => this.deviceUpdated(device, topic, payload));
            MusiccastToMqtt.mcDevices[mcDevice.device_id] = mcDevice;
        }
    }
}