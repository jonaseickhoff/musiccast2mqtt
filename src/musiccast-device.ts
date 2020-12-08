import { MusiccastEventListener } from './musiccast-event-listener';
import { StaticLogger } from './static-logger';
import { McDistributionInfo, McFeatures, McZoneId, McStereoPairInfo, McNetPlayInfo, McTunerPlayInfo, McCdPlayInfo, McEvent, McNameText } from './musiccast-types';
import { ConfigLoader } from './config'
import { MusiccastDeviceManager } from './musiccast-device-manager';
import { McDeviceApi } from './musiccast-device-api';
import request from './request';
import { MusiccastZone } from './musiccast-zone';

interface updateZoneCallback { (zone: MusiccastZone, topic: string, payload: any): void }

export class MusiccastDevice {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastDevice');

    public static async fromIp(ip: string, publishZoneUpdate: updateZoneCallback): Promise<MusiccastDevice | undefined> {
        let log = StaticLogger.CreateLoggerForSource('MusiccastDevice');
        let req = {
            method: 'GET',
            uri: 'http://' + ip + '/YamahaExtendedControl/v1/system/getDeviceInfo',
            json: true,
            timeout: 1000
        };
        log.verbose("Get Device Info Request {request}", JSON.stringify(req));
        try {
            let response = await request.getAsync(req);
            if (response.body.response_code === 0) {
                let device: MusiccastDevice = new MusiccastDevice(response.body.device_id, ip, response.body.model_name, publishZoneUpdate);
                return device;
            }
        }
        catch (error) {
            log.error("Error creating Device from {ip} during: {error}", ip, error);
        }
        return undefined;
    }

    private readonly publishZoneUpdate: updateZoneCallback;

    private readonly useFriendlyNames: boolean;

    private _features: McFeatures;
    private _nameText: McNameText;
    private _stereoPairInfos: McStereoPairInfo;
    private _distributionInfos: McDistributionInfo;
    private _netPlayInfo: McNetPlayInfo;
    private _tunerPlayInfo: McTunerPlayInfo;
    private _cdPlayInfo: McCdPlayInfo;

    private _zones: { [zone in McZoneId]?: MusiccastZone } = {};

    private isInitalized: boolean = false;

    public readonly device_id: string;
    public ip: string;
    public name: string;
    public model: string;


    constructor(device_id: string, ip: string, model: string, publishZoneUpdate: updateZoneCallback) {
        this.device_id = device_id;
        this.ip = ip;
        this.model = model;
        this.publishZoneUpdate = publishZoneUpdate;

        this.useFriendlyNames = ConfigLoader.Config().friendlynames === 'name';

        this.initDevice();
    }

    private async initDevice(): Promise<void> {
        await this.updateNetworkStatus();
        await this.updateFeatures();
        await this.updateNameText();
        await this.updateStereoPairInfo();

        MusiccastEventListener.DefaultInstance.RegisterSubscription(this.device_id, (event: McEvent) => this.parseNewEvent(event))

        this.isInitalized = true;
    }

    public get features(): McFeatures {
        return this._features;
    }

    public get nameText(): McNameText {
        return this._nameText;
    }

    public get distributionInfos(): McDistributionInfo {
        return this._distributionInfos;
    }

    public get stereoPairInfos(): McStereoPairInfo {
        return this._stereoPairInfos;
    }

    public get netPlayInfo(): McNetPlayInfo {
        return this._netPlayInfo;
    }

    public get cdPlayInfo(): McCdPlayInfo {
        return this._cdPlayInfo;
    }

    public get tunerPlayInfo(): McTunerPlayInfo {
        return this._tunerPlayInfo;
    }

    public get zones(): { [zone in McZoneId]?: MusiccastZone } {
        return this._zones;
    }

    public get hasCd(): boolean {
        return this._features.system.input_list.some(i => i.play_info_type === 'cd');
    }

    public get hasTuner(): boolean {
        return this._features.system.input_list.some(i => i.play_info_type === 'tuner');
    }

    /**
     * returns true if device is a slave device in a stereo setup, otherwise false */
    public get isSlave(): boolean {
        if (this._stereoPairInfos?.status !== undefined)
            return this._stereoPairInfos.status.toLowerCase().startsWith("slave");
        else
            return false;
    }

    /** 
     * Returns the master device if isSlave is true, otherwise returns undefinied
     */
    public get master(): MusiccastDevice {
        if (this.isSlave)
            return MusiccastDeviceManager.getInstance().getDeviceByIp(this._stereoPairInfos.pair_info.ip_address)
        else
            return undefined;
    }

    public get id(): string {
        if (this.useFriendlyNames)
            return this.name;
        else
            return this.device_id;
    }

    /* Reading and Parsing Status */

    public async pollDevice(): Promise<void> {
        if (this.isInitalized) {
            for (const zone of this._features.zone) {
                await this.updateStatus(zone.id);
            }
            await this.updateStereoPairInfo();
            await this.updateDistributionInfo();
            await this.updateNetPlayInfo();
            if (this.hasCd)
                await this.updateCdPlayInfo();
            if (this.hasTuner)
                await this.updateTunerPlayInfo();
            this.publishChangedStatus();
        }
    }

    public async updateStatus(zoneId: McZoneId): Promise<void> {
        try {
            this._zones[zoneId].mcStatus = await McDeviceApi.getStatus(this.ip, zoneId);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/${zoneId}/status`, this._zones[zoneId].mcStatus);
        } catch (error) {
            this.log.error("{device_id}: Error polling device status in zone {zone}. Error: {error}", this.id, zoneId, error)
        }
    }

    public async updateDistributionInfo(): Promise<void> {
        try {
            this._distributionInfos = await McDeviceApi.getDistributionInfo(this.ip);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/distributionInfo`, this._distributionInfos);



        } catch (error) {
            this.log.error("{device_id}: Error update distribution infos {error}", this.id, error)
        }
    }

    private async updateStereoPairInfo(): Promise<void> {
        try {
            this._stereoPairInfos = await McDeviceApi.getStereoPairInfo(this.ip);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/stereoPairInfo`, this._stereoPairInfos);
        } catch (error) {
            this.log.error("{device_id}: Error update stereo pair info. Error: {error}", this.id, error)
        }
    }

    private async updateFeatures(): Promise<void> {
        try {
            this._features = await McDeviceApi.getFeatures(this.ip);
            this.log.debug("{device_id} Features: {features}", this.device_id, this._features);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/features`, this._features);
            for (let zone of this._features.zone) {
                this._zones[zone.id] = new MusiccastZone(this, zone, (zone, topic, payload) => this.zoneUpdated(zone, topic, payload));
            }
        } catch (error) {
            this.log.error("{device_id}: Error update features. Error: {error}", this.id, error)
        }
    }

    private async updateNameText(): Promise<void> {
        try {
            this._nameText = await McDeviceApi.getNameText(this.ip);
            this.log.debug("{device_id} NameText: {nameText}", this.device_id, this._nameText);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/nameText`, this._nameText);
        } catch (error) {
            this.log.error("{device_id}: Error update nameText. Error: {error}", this.id, error)
        }
    }

    private async updateNetworkStatus(): Promise<void> {
        try {
            let networkStatus = await McDeviceApi.getNetworkStatus(this.ip);
            this.name = networkStatus.network_name;
            this.log.debug("{device_id} NetworkStatus: {networkStatus}", this.id, networkStatus);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/networkStatus`, networkStatus);
        } catch (error) {
            this.log.error("{device_id}: Error update network status. Error: {error}", this.id, error)
        }
    }

    private async updateNetPlayInfo(): Promise<void> {
        try {
            this._netPlayInfo = await McDeviceApi.getNetPlayInfo(this.ip);
            this.log.debug("{device_id} netusb playinfo: {playInfo}", this.id, this._netPlayInfo);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/netusbPlayInfo`, this._netPlayInfo);
        } catch (error) {
            this.log.error("{device_id}: Error update netusb playinfo. Error: {error}", this.id, error)
        }
    }

    private async updateTunerPlayInfo(): Promise<void> {
        try {
            this._tunerPlayInfo = await McDeviceApi.getTunerPlayInfo(this.ip);
            this.log.debug("{device_id} tuner playinfo: {playInfo}", this.id, this._tunerPlayInfo);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/tunerPlayInfo`, this._tunerPlayInfo);
        } catch (error) {
            this.log.error("{device_id}: Error update tuner playinfo. Error: {error}", this.id, error)
        }
    }

    private async updateCdPlayInfo(): Promise<void> {
        try {
            this._cdPlayInfo = await McDeviceApi.getCdPlayInfo(this.ip);
            this.log.debug("{device_id} cd playinfo: {playInfo}", this.id, this._cdPlayInfo);
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/cdPlayInfo`, this._cdPlayInfo);
        } catch (error) {
            this.log.error("{device_id}: Error update cd playinfo. Error: {error}", this.id, error)
        }
    }

    public isGroupIdEmpty(): boolean {
        return this._distributionInfos.group_id === '00000000000000000000000000000000' || this._distributionInfos.group_id === ''
    }

    private async parseNewEvent(event: McEvent): Promise<void> {
        this.log.verbose("device {device_id} new event: {message}", this.id, JSON.stringify(event));
        for (const zone of this._features.zone) {
            if (zone.id in event) {
                this._zones[zone.id].mcStatus = { ...this._zones[zone.id].mcStatus, ...event[zone.id] };
                this.zoneUpdated(this.zones[McZoneId.Main], `debug/${zone.id}/status`, this._zones[zone.id].mcStatus);
                this.parseZoneEvent(zone.id, event[zone.id]);
            }
        }
        if ('system' in event) {
            if (event.system.stereo_pair_info_updated) {
                this.updateStereoPairInfo().then(() => this.publishChangedStatus());
            }
        }
        if ('tuner' in event) {
            if (event.tuner.play_info_updated) {
                this.updateTunerPlayInfo().then(() => this.publishChangedStatus());
            }
        }
        if ('netusb' in event) {
            if ('play_info_updated' in event.netusb) {
                this.updateNetPlayInfo().then(() => this.publishChangedStatus());
            }
        }
        if ('cd' in event) {
            if (event.cd.play_info_updated) {
                this.updateCdPlayInfo().then(() => this.publishChangedStatus());
            }
        }
        if ('dist' in event && event.dist.dist_info_updated) {
            this.updateDistributionInfo().then(() => this.publishChangedStatus());
        }
        this.publishChangedStatus();
    }

    private parseZoneEvent(zone: McZoneId, event: any) {
        if ('status_updated' in event) {
            // Returns whether or not other info has changed than main zone
            // power/input/volume/mute status. If so, pull renewed info using /main/getStatus
            this.updateStatus(zone);
        }
        if ('signal_info_updated' in event) {
        }
    }


    private publishChangedStatus() {
        if (this.isInitalized)
            Object.values(this._zones).forEach(zone => zone.publishChangedStatus())
    }

    private zoneUpdated(zone: MusiccastZone, topic: string, payload: any) {
        if (this.isInitalized)
            this.publishZoneUpdate(zone, topic, payload);
    }

}