import { StaticLogger } from "./static-logger";
import { MusiccastDevice } from './musiccast-device';
import { ConfigLoader } from "./config";
import { DiscoveredMusiccastDevice, MusiccastDiscoverer } from "./musiccast-discoverer";
import { McGroupRole } from "./musiccast-features";


export interface IDeviceUpdatedListener {
    onDeviceUpdated(deviceId: string, topic: string, payload: any): void;
}


export class MusiccastDeviceManager {
    private static instance: MusiccastDeviceManager;
    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastGroupMananger.main');
    private readonly mcDiscoverer: MusiccastDiscoverer = new MusiccastDiscoverer();

    private readonly useFriendlyNames: boolean;
    private readonly pollingInterval: number;
    private pollingTimeout: NodeJS.Timeout;

    private readonly deviceUpdatedSubscriber: IDeviceUpdatedListener[] = [];

    private readonly _mcDevices: { [device_id: string]: MusiccastDevice } = {};

    private constructor() {
        let config = ConfigLoader.Config()
        this.useFriendlyNames = config.friendlynames === 'name';

        if (config.pollingInterval > 0) {
            this.pollingInterval = config.pollingInterval * 1000;
            this.pollingTimeout = setTimeout(() => this.pollDeviceStatus(), this.pollingInterval);
        }
    }

    public static getInstance(): MusiccastDeviceManager {
        if (!MusiccastDeviceManager.instance) {
            MusiccastDeviceManager.instance = new MusiccastDeviceManager();
        }
        return MusiccastDeviceManager.instance;


    }

    public dispose() {
        clearTimeout(this.pollingTimeout);
    }

    public subscribe(subsciber: IDeviceUpdatedListener) {
        const isExist = this.deviceUpdatedSubscriber.includes(subsciber);
        if (isExist) {
            console.log('deviceUpdatedSubscriber has been attached already.');
            return
        }
        this.deviceUpdatedSubscriber.push(subsciber);
    }

    public unsubscribe(subsciber: IDeviceUpdatedListener) {
        const subscriberIndex = this.deviceUpdatedSubscriber.indexOf(subsciber);
        if (subscriberIndex === -1) {
            return console.log('Nonexistent deviceUpdatedSubscriber.');
        }
        this.deviceUpdatedSubscriber.splice(subscriberIndex, 1);
    }

    public getDeviceByIp(ip: string): MusiccastDevice {
        let device = Object.values(this._mcDevices).find(d => d.ip === ip);
        return device;
    }

    public getDeviceById(id: string): MusiccastDevice {
        let device: MusiccastDevice;
        if (this.useFriendlyNames) {
            device = Object.values(this._mcDevices).find(d => d.name === id)
        }
        else {
            device = this._mcDevices[id]
        }
        return device;
    }

    public getServerByGroupId(id: string): MusiccastDevice {
        let device: MusiccastDevice;
        device = Object.values(this._mcDevices).find(d => d.distributionInfos && d.distributionInfos.group_id == id && d.role === McGroupRole.Server)
        return device;
    }

    public async discover(): Promise<string[]> {
        let devices: DiscoveredMusiccastDevice[] = await this.mcDiscoverer.discover(15000);
        let discoveredDevices: string[] = []
        devices.forEach(device => {
            if (device.device_id in this._mcDevices) {
                this.log.debug("Update Musiccast device: {device}", JSON.stringify(device));
                this._mcDevices[device.device_id].ip = device.ip;
                this._mcDevices[device.device_id].name = device.name;
                this._mcDevices[device.device_id].model = device.model;
            }
            else {
                this.log.debug("Add new Musiccast device: {device}", JSON.stringify(device));
                this._mcDevices[device.device_id] = new MusiccastDevice(device.device_id, device.ip, device.model, (device, topic, payload) => this.deviceUpdated(device, topic, payload));
            }
            if (this.useFriendlyNames)
                discoveredDevices.push(this._mcDevices[device.device_id].name);
            else
                discoveredDevices.push(this._mcDevices[device.device_id].device_id);
        });
        return discoveredDevices;
    }


    public async createDeviceFromIp(ip: string) {
        let mcDevice = await MusiccastDevice.fromIp(ip, (device, topic, payload) => this.deviceUpdated(device, topic, payload));
        this._mcDevices[mcDevice.device_id] = mcDevice;
    }

    private async pollDeviceStatus(): Promise<void> {
        this.log.debug("Poll Musiccast device status.")
        try {
            await Promise.all(Object.values(this._mcDevices).map(async (device) => {
                await device.pollDevice();
            }));
        }
        catch (error) {
            this.log.error("Error polling Musiccast device status: {error}", error);
        }
        this.pollingTimeout = setTimeout(() => this.pollDeviceStatus(), this.pollingInterval);
    }

    public deviceUpdated(device: MusiccastDevice, topic: string, payload: any) {
        let deviceId = this.useFriendlyNames ? device.name : device.device_id;
        this.publishUpdatedDevice(deviceId, topic, payload);
    }

    private publishUpdatedDevice(deviceId: string, topic: string, payload: any) {
        for (const subscriber of this.deviceUpdatedSubscriber) {
            subscriber.onDeviceUpdated(deviceId, topic, payload);
        }
    }
}