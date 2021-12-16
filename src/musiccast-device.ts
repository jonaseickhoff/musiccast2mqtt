import { MusiccastEventListener } from './musiccast-event-listener';
import { StaticLogger } from './static-logger';
import { McDistributionInfo, McFeatures, McZoneId, McStereoPairInfo, McNetPlayInfo, McTunerPlayInfo, McCdPlayInfo, McEvent, McInputId, McSoundProgram } from './musiccast-types';
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

    private _inputToFriendlyname: { [key: string]: string } = {}
    private _friendlynameToInput: { [key: string]: McInputId } = {}

    private _inputToPlayinfoType: { [key: string]: "none" | "tuner" | "netusb" | "cd" } = {}

    private _soundprogramToFriendlyname: { [key: string]: string } = {}
    private _friendlynameToSoundprogram: { [key: string]: McSoundProgram } = {}

    private _zoneToFriendlyname: { [key: string]: string } = {}
    private _friendlynameToZone: { [key: string]: McZoneId } = {}



    private _features: McFeatures;
    private _stereoPairInfos: McStereoPairInfo;
    private _distributionInfos: McDistributionInfo;
    private _netPlayInfo: McNetPlayInfo;
    private _tunerPlayInfo: McTunerPlayInfo;
    private _cdPlayInfo: McCdPlayInfo;

    private _zones: { [zone in McZoneId]?: MusiccastZone } = {};

    private _isInitalized: boolean = false;

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
        // inital get all available infos
        await this.updateNetworkStatus();
        await this.updateNameText();
        await this.updateFeatures();
        await this.updateStereoPairInfo();
        await this.updateNetPlayInfo();
        if (this.hasCd)
            await this.updateCdPlayInfo();
        if (this.hasTuner)
            await this.updateTunerPlayInfo();      
        for (const zone of this._features.zone) {
            await this.updateStatus(zone.id);
        }
        MusiccastEventListener.DefaultInstance.RegisterSubscription(this.device_id, (event: McEvent) => this.parseNewEvent(event))
        this._isInitalized = true;
        for (let zone of Object.values(this._zones)) {
            zone.publishFeatures();
        }
    }

    public get features(): McFeatures {
        return this._features;
    }

    public get zoneToFriendlyname(): { [key: string]: string } {
        return this._zoneToFriendlyname;
    }

    public get friendlynameToZone(): { [key: string]: McZoneId } {
        return this._friendlynameToZone;
    }

    public get inputToFriendlyname(): { [key: string]: string } {
        return this._inputToFriendlyname;
    }

    public get friendlynameToInput(): { [key: string]: McInputId } {
        return this._friendlynameToInput;
    }

    public get soundprogramToFriendlyname(): { [key: string]: string } {
        return this._soundprogramToFriendlyname;
    }

    public get friendlynameToSoundprogram(): { [key: string]: McSoundProgram } {
        return this._friendlynameToSoundprogram;
    }

    public get inputToPlayinfoType(): { [key: string]: "none" | "tuner" | "netusb" | "cd" } {
        return this._inputToPlayinfoType;
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

    public get isInitialized(): boolean {
        return this._isInitalized
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
        if (this._isInitalized) {
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
            this._features.system.input_list.forEach(i => this._inputToPlayinfoType[i.id] = i.play_info_type);
            this.log.debug("{device_id} Features: {features}", this.device_id, JSON.stringify(this._features));
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
            let nameText = await McDeviceApi.getNameText(this.ip);
            this.log.debug("{device_id} NameText: {nameText}", this.device_id, JSON.stringify(nameText));
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/nameText`, nameText);
            nameText.input_list.forEach(l => {
                this._inputToFriendlyname[l.id] = l.text;
                this._friendlynameToInput[l.text] = l.id;
            })
            nameText.sound_program_list.forEach(l => {
                this._soundprogramToFriendlyname[l.id] = l.text;
                this._friendlynameToSoundprogram[l.text] = l.id;
            })
            nameText.zone_list.forEach(l => {
                this._zoneToFriendlyname[l.id] = l.text;
                this._friendlynameToZone[l.text] = l.id;
            })
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
            this.log.debug("{device_id} netusb playinfo: {playInfo}", this.id, JSON.stringify(this._netPlayInfo));
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/netusbPlayInfo`, this._netPlayInfo);
        } catch (error) {
            this.log.error("{device_id}: Error update netusb playinfo. Error: {error}", this.id, error)
        }
    }

    private async updateTunerPlayInfo(): Promise<void> {
        try {
            this._tunerPlayInfo = await McDeviceApi.getTunerPlayInfo(this.ip);
            this.log.debug("{device_id} tuner playinfo: {playInfo}", this.id, JSON.stringify(this._tunerPlayInfo));
            this.zoneUpdated(this.zones[McZoneId.Main], `debug/tunerPlayInfo`, this._tunerPlayInfo);
        } catch (error) {
            this.log.error("{device_id}: Error update tuner playinfo. Error: {error}", this.id, error)
        }
    }

    private async updateCdPlayInfo(): Promise<void> {
        try {
            this._cdPlayInfo = await McDeviceApi.getCdPlayInfo(this.ip);
            this.log.debug("{device_id} cd playinfo: {playInfo}", this.id, JSON.stringify(this._cdPlayInfo));
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
                this.zones[zone.id].parseZoneEvent(event[zone.id])
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
            if (event.netusb.play_info_updated) {
                this.updateNetPlayInfo().then(() => this.publishChangedStatus());
            }
            if (event.netusb.play_time) {
                this._netPlayInfo.play_time = event.netusb.play_time;
            }
        }
        if ('cd' in event) {
            if (event.cd.play_info_updated) {
                this.updateCdPlayInfo().then(() => this.publishChangedStatus());
            }
            if (event.cd.play_time) {
                this._cdPlayInfo.play_time = event.cd.play_time;
            }
        }
        if ('dist' in event && event.dist.dist_info_updated) { 
            this.updateDistributionInfo().then(() => this.publishChangedStatus());
        }
        this.publishChangedStatus();
    }

    private publishChangedStatus() {
        if (this._isInitalized)
            Object.values(this._zones).forEach(zone => zone.publishChangedStatus())
    }

    private zoneUpdated(zone: MusiccastZone, topic: string, payload: any) {
        if (this._isInitalized)
            this.publishZoneUpdate(zone, topic, payload);
    }

}