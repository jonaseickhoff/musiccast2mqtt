import { StaticLogger } from "./static-logger";
import { MusiccastDevice } from './musiccast-device';
import { ConfigLoader } from "./config";
import { DiscoveredMusiccastDevice, MusiccastDiscoverer } from "./musiccast-discoverer";
import { McGroupRole } from "./musiccast-types";
import { MusiccastZone } from "./musiccast-zone";


export interface IDeviceUpdatedListener {
    onDeviceUpdated(zoneId: string, topic: string, payload: any): void;
}


export class MusiccastDeviceManager {
    private static instance: MusiccastDeviceManager;
    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastGroupMananger');
    private readonly mcDiscoverer: MusiccastDiscoverer = new MusiccastDiscoverer();

    private readonly useFriendlyNames: boolean;
    private readonly pollingInterval: number;
    private pollingTimeout: NodeJS.Timeout;

    private readonly deviceUpdatedSubscriber: IDeviceUpdatedListener[] = [];

    private readonly _mcDevices: { [device_id: string]: MusiccastDevice } = {};

    private constructor() {
        let config = ConfigLoader.Config()
        this.useFriendlyNames = config.friendlynames === 'name';

        for (const device of config.devices) {
            this.createDeviceFromIp(device)
        }

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

    public getZoneById(id: string): MusiccastZone {
        id = id.trim();
        let zone: MusiccastZone;
        for (const device of Object.values(this._mcDevices)) {
            for (const zone of Object.values(device.zones)) {
                if (zone?.id === id)
                    return zone;
            }
        }
        return zone;
    }

    public getServerByGroupId(id: string): MusiccastDevice {
        id = id.trim();
        let device: MusiccastDevice;
        device = Object.values(this._mcDevices).find(d => d.distributionInfos && d.distributionInfos.group_id == id && Object.values(d.zones).some(z => z?.role === McGroupRole.Server))
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
                this._mcDevices[device.device_id] = new MusiccastDevice(device.device_id, device.ip, device.model, (zone, topic, payload) => this.deviceUpdated(zone, topic, payload));
            }
            if (this.useFriendlyNames)
                discoveredDevices.push(this._mcDevices[device.device_id].name);
            else
                discoveredDevices.push(this._mcDevices[device.device_id].device_id);
        });
        return discoveredDevices;
    }


    public async createDeviceFromIp(ip: string) {
        let mcDevice = await MusiccastDevice.fromIp(ip, (zone, topic, payload) => this.deviceUpdated(zone, topic, payload));
        if (mcDevice)
            this._mcDevices[mcDevice.device_id] = mcDevice;
        else
            this.log.error("cannot create musiccast device for ip '{ip}'", ip);
    }

    private async pollDeviceStatus(): Promise<void> {
        this.log.debug("Poll Musiccast device status.")
        try {
            await Promise.all(Object.values(this._mcDevices).map(async (device) => {
                if (device.isInitialized)
                    await device.pollDevice();
            }));
        }
        catch (error) {
            this.log.error("Error polling Musiccast device status: {error}", error);
        }
        this.pollingTimeout = setTimeout(() => this.pollDeviceStatus(), this.pollingInterval);
    }

    public deviceUpdated(zone: MusiccastZone, topic: string, payload: any) {
        this.publishUpdatedDevice(zone.id, topic, payload);
    }

    private publishUpdatedDevice(zoneId: string, topic: string, payload: any) {
        for (const subscriber of this.deviceUpdatedSubscriber) {
            subscriber.onDeviceUpdated(zoneId, topic, payload);
        }
    }
}