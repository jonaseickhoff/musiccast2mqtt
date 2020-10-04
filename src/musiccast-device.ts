import { MusiccastEventListener } from './musiccast-event-listener';
import { StaticLogger } from './static-logger';
import { McDistributionInfo, McFeatures, McGroupRole, McZoneId, McStereoPairInfo, McResponseCode } from './musiccast-features';
import { MusiccastGroupMananger } from './musiccast-groupmanager';
import { MusiccastToMqtt } from './musiccast-to-mqtt';
import { ConfigLoader } from './config'


var Promise = require("bluebird");
var request = Promise.promisify(require("@root/request"));
Promise.promisifyAll(request);


interface updateCallback { (device: MusiccastDevice, topic: string, payload: any): void }

export class MusiccastDevice {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastDevice.main');

    public static async fromIp(ip: string, publishUpdate: updateCallback): Promise<MusiccastDevice> {
        let log = StaticLogger.CreateLoggerForSource('MusiccastDevice.main');
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
                let device: MusiccastDevice = new MusiccastDevice(response.body.device_id, ip, response.body.model_name, publishUpdate);
                return device;
            }
        }
        catch (error) {
            log.error("Error creating Device from {ip} during: {error}", ip, error);
        }
        return undefined;
    }

    private readonly responseDelay: number;
    private readonly requestTimeout: number;
    private readonly publishUpdate: updateCallback;
    private readonly useFriendlyNames: boolean;

    private _features: McFeatures;
    private _distributionInfos: McDistributionInfo;
    private _stereoPairInfos: McStereoPairInfo;
    private _role: McGroupRole = McGroupRole.None;
    private _linkedDevices: MusiccastDevice[] = [];


    private status: any = {};
    private isInitalized: boolean = false;
    public readonly device_id: string;
    public ip: string;
    public name: string;
    public model: string;



    constructor(device_id: string, ip: string, model: string, publishUpdate: updateCallback) {
        this.device_id = device_id;
        this.ip = ip;
        this.model = model;
        this.publishUpdate = publishUpdate;

        this.responseDelay = 1;
        this.requestTimeout = 5000;

        this.useFriendlyNames = ConfigLoader.Config().friendlynames === 'name';

        this.initDevice();
    }

    get distributionInfos(): McDistributionInfo {
        return this._distributionInfos;
    }

    get stereoPairInfos(): McStereoPairInfo {
        return this._stereoPairInfos;
    }

    /**
     * returns true if device is a slave device in a stereo setup, otherwise false */
    get isSlave(): boolean {
        if (this._stereoPairInfos?.status !== undefined)
            return this._stereoPairInfos.status.toLowerCase().startsWith("slave");
        else
            return false;
    }

    /** 
     * Returns the master device if isSlave is true, otherwise returns undefinied
     */
    get master(): MusiccastDevice {
        if (this.isSlave)
            return Object.values(MusiccastToMqtt.mcDevices).find(d => d.ip === this._stereoPairInfos.pair_info.ip_address);
        else
            return undefined;
    }

    get role(): McGroupRole {
        return this._role;
    }

    get linkedDevices(): MusiccastDevice[] {
        return this._linkedDevices;
    }

    public async pollDevice(): Promise<void> {
        if (this.isInitalized) {
            try {
                for (const zone of this._features.zone) {
                    await this.updateStatus(zone.id);
                }
                await this.updateDistributionInfo();
                await this.updateStereoPairInfo();
            } catch (error) {
                this.log.error("{device_id}: Error polling device status {error}", this.device_id, error)
            }
        }
    }

    public setMqtt(topic: string, payload) {
        const [prefix, set, deviceId, param1, param2] = topic.split('/');
        if (Object.values(McZoneId).includes(<McZoneId>param1)) {
            let zone: McZoneId = <McZoneId>param1;
            switch (param2) {
                case 'power':
                    this.power(payload, zone);
                    break;
                case 'volume':
                    this.setVolumeTo(payload, zone);
                    break;
                case 'mute':
                    this.mute(payload, zone);
                    break;
                case 'input':
                    this.setInput(payload, zone);
                    break;
                case 'link':
                    var devices = payload;
                    if (this.useFriendlyNames) {
                        devices = payload.map(name => Object.values(MusiccastToMqtt.mcDevices).find(d => d.name === name).device_id)
                    }
                    MusiccastGroupMananger.getInstance().link(this.device_id, devices)
                    break;
                case 'unlink':
                    var devices = payload;
                    if (this.useFriendlyNames) {
                        devices = payload.map(name => Object.values(MusiccastToMqtt.mcDevices).find(d => d.name === name).device_id)
                    }
                    MusiccastGroupMananger.getInstance().unlink(this.device_id, devices)
                    break;
                default:
                    this.log.error("unknown {topic}", topic)
            }
        }
        else {
            this.log.error("wrong topic for device: {device}, topic: {topic}", this.device_id, topic)
        }
    }

    public async updateStatus(zoneId: McZoneId): Promise<void> {
        this.status[zoneId] = await this.getStatus(zoneId);
        this.publishUpdate(this, `${zoneId}/status`, this.status[zoneId]);
        this.parseStatusPart(zoneId, this.status[zoneId]);
    }

    public async updateDistributionInfo(): Promise<void> {
        this._distributionInfos = await this.getDistributionInfo();
        this.publishUpdate(this, `distributionInfo`, this._distributionInfos);

        let clientsWithoutSlaves: MusiccastDevice[] = [];
        for (const client of this._distributionInfos.client_list) {
            const device: MusiccastDevice = Object.values(MusiccastToMqtt.mcDevices).find(d => d.ip === client.ip_address);
            if (device) {
                if (!device.isSlave)
                    clientsWithoutSlaves = [...clientsWithoutSlaves, device];
            }
            else {
                this.log.warn("Unknown client in distributionInfos.client_list {ip}", client.ip_address);
            }
        }
        if (this._distributionInfos.role === McGroupRole.Server ||
            (this._distributionInfos.role === McGroupRole.None && clientsWithoutSlaves.length > 0)) {
            this._role = McGroupRole.Server
            this._linkedDevices = clientsWithoutSlaves;
        }
        else if (this._distributionInfos.role === McGroupRole.Client && !this.isGroupIdEmpty()) {
            this._role = McGroupRole.Client;
            let server: MusiccastDevice = Object.values(MusiccastToMqtt.mcDevices).find(d => d.distributionInfos && d.distributionInfos.group_id == this.distributionInfos.group_id && d.role === McGroupRole.Server)
            if (server) {
                this._linkedDevices = [server];
            }else{
                this.log.warn("cannot find server for group id {id}", this.distributionInfos.group_id)
                this._linkedDevices = [];
            }
        }
        else {
            // group id can be 00000000000000000000000000000000 when input is mc_link. In this case McGroupRole is "client" although not linked to any server device
            this._role = McGroupRole.None;
            this._linkedDevices = [];
        }

        this.publishUpdate(this, `link/role`, this._role);
        let devices: string[];
        if (this.useFriendlyNames) {
            devices = this._linkedDevices.map(d => d.name);
        } else {
            devices = this._linkedDevices.map(d => d.device_id);
        }
        this.publishUpdate(this, `link/devices`, devices);
    }


    private async updateStereoPairInfo(): Promise<void> {
        this._stereoPairInfos = await this.getStereoPairInfo();
        this.publishUpdate(this, `stereoPairInfo`, this._stereoPairInfos);
    }

    private async updateNetworkStatus(): Promise<void> {
        let networkStatus = await this.getNetworkStatus();
        this.log.debug("{device_id} NetworkStatus: {networkStatus}", this.device_id, networkStatus);
        this.name = networkStatus.network_name;
        this.publishUpdate(this, `networkStatus`, networkStatus);
    }

    public isGroupIdEmpty(): boolean {
        return this._distributionInfos.group_id === '00000000000000000000000000000000' || this._distributionInfos.group_id === ''
    }

    private async initDevice(): Promise<void> {
        this.updateNetworkStatus();

        let response = await this.getFeatures();
        delete response.response_code;
        this._features = response;
        this.log.debug("{device_id} Features: {features}", this.device_id, this._features);
        this.publishUpdate(this, `features`, this._features);

        MusiccastEventListener.DefaultInstance.RegisterSubscription(this.device_id, (event: any) => this.parseNewEvent(event))

        this.isInitalized = true;
    }

    private async parseNewEvent(event: any): Promise<void> {
        this.log.verbose("device {device_id} new event: {message}", this.device_id, JSON.stringify(event));
        for (const zone of this._features.zone) {
            if (zone.id in event) {
                this.status[zone.id] = { ...this.status[zone.id], ...event[zone.id] };
                this.publishUpdate(this, `${zone.id}/status`, this.status[zone.id]);
                this.parseZoneEvent(zone.id, event[zone.id]);
            }
        }
        if ('system' in event) {

        }
        if ('tuner' in event) {

        }
        if ('netusb' in event) {

        }
        if ('cd' in event) {

        }
        if ('dist' in event && event.dist.dist_info_updated) {
            this.updateDistributionInfo();
        }
    }

    private parseZoneEvent(zone: McZoneId, event: any) {
        this.parseStatusPart(zone, event)
        if ('status_updated' in event) {
            // Returns whether or not other info has changed than main zone
            // power/input/volume/mute status. If so, pull renewed info using /main/getStatus
            this.updateStatus(zone);
        }
        if ('signal_info_updated' in event) {

        }
    }

    private parseStatusPart(zone: McZoneId, newStatus: any) {
        if ('power' in newStatus) {
            this.publishUpdate(this, `${zone}/power`, newStatus.power)
        }
        if ('input' in newStatus) {
            this.publishUpdate(this, `${zone}/input`, newStatus.input)
        }
        if ('volume' in newStatus) {
            // Returns volume value
            // Values: Value range calculated by minimum/maximum/step
            // values gotten via /system/getFeatures
            this.publishUpdate(this, `${zone}/volume`, newStatus.volume)
        }
        if ('mute' in newStatus) {
            this.publishUpdate(this, `${zone}/mute`, newStatus.mute)
        }
    }

    private async SendGetToDevice(cmd): Promise<any> {
        let req = {
            method: 'GET',
            uri: 'http://' + this.ip + '/YamahaExtendedControl/v1' + cmd,
            headers: {
                'X-AppName': 'MusicCast/1.0',
                'X-AppPort': '41100',
            },
            json: true,
            timeout: this.requestTimeout
        };
        this.log.verbose("Device {name} Get Request {request}", this.name, JSON.stringify(req));

        try {

            let response = await request.getAsync(req);
            let body = response.body;
            if (body.response_code === 0) {
                delete body.response_code;
                return body;
            }
            else {
                this.log.error("Error SendGetToDevice deviceId: '{deviceId}' responseCode: '{code} - {codeName}'  cmd: '{cmd}'", this.device_id, body.response_code, McResponseCode[body.response_code], cmd)
                throw {
                    response_code: body.response_code,
                    message: McResponseCode[body.response_code]
                };
            }
        } catch (error) {
            this.log.error("Error SendGetToDevice deviceId: '{deviceId}' error: '{error}'", this.device_id, error)
        }
    };

    private async SendPostToDevice(cmd, data): Promise<any> {
        let delay: number = this.responseDelay * 1000;
        let req = {
            method: 'POST',
            uri: 'http://' + this.ip + '/YamahaExtendedControl/v1' + cmd,
            json: data,
            timeout: this.requestTimeout
        };
        this.log.verbose("Device {name} Post Request {request}", this.name, JSON.stringify(req));
        try {
            let response = await request.postAsync(req).delay(delay);
            let body = response.body;
            if (body.response_code === 0) {
                delete body.response_code;
                return body;
            } else {
                this.log.error("Error SendPostToDevice deviceId: '{deviceId}' responseCode: '{code} - {codeName}' cmd: '{cmd}', data: {data}", this.device_id, body.response_code, McResponseCode[body.response_code], cmd, data)
                throw {
                    response_code: body.response_code,
                    message: McResponseCode[body.response_code]
                };
            }
        } catch (error) {
            this.log.error("Error SendPostToDevice deviceId: '{deviceId}' cmd: '{cmd}' data: '{data}' error: '{error}'", this.device_id, cmd, data, error)
        }
    };

    //-------------Zone related comands----------

    public async power(on, zone: McZoneId) {
        let command = '/' + zone + '/setPower?power=' + ((on === 'on' || on === true || on === 'true') ? 'on' : 'standby');
        return this.SendGetToDevice(command);
    };
    public async powerOn(zone: McZoneId) {
        let command = '/' + zone + '/setPower?power=on'
        return this.SendGetToDevice(command);
    };
    public async powerOff(zone: McZoneId) {
        let command = '/' + zone + '/setPower?power=standby';
        return this.SendGetToDevice(command);
    };
    public async sleep(val, zone: McZoneId) {
        if (val < 30) val = '0';
        else if (val < 60) val = '30';
        else if (val < 90) val = '60';
        else if (val < 120) val = '90';
        else val = '120';
        let command = '/' + zone + '/setSleep?sleep=' + val;
        return this.SendGetToDevice(command);
    };
    public async setVolumeTo(to, zone: McZoneId) {
        let command = '/' + zone + '/setVolume?volume=' + to;
        return this.SendGetToDevice(command);
    };
    public async mute(on, zone: McZoneId) {
        let command = '/' + zone + '/setMute?enable=' + ((on === 'true' || on === true) ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async muteOn(zone: McZoneId) {
        let command = '/' + zone + '/setMute?enable=true';
        return this.SendGetToDevice(command);
    };
    public async muteOff(zone: McZoneId) {
        let command = '/' + zone + '/setMute?enable=false';
        return this.SendGetToDevice(command);
    };
    public async setInput(input, zone: McZoneId, mode?) {
        if (mode == null || mode == 'undefined') { mode = '' } else { mode = '&mode=' + mode }
        //check for correct input in calling program
        let command = '/' + zone + '/setInput?input=' + input + mode;
        return this.SendGetToDevice(command);
    };
    public async setSound(input, zone: McZoneId) {
        //check for correct input in calling program
        let command = '/' + zone + '/setSoundProgram?program=' + input;
        return this.SendGetToDevice(command);
    };
    public async surround(on, zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async surroundOn(zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=true';
        return this.SendGetToDevice(command);
    };
    public async surroundOff(zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=false';
        return this.SendGetToDevice(command);
    };
    public async setDirect(on, zone: McZoneId) {
        let command = '/' + zone + '/setDirect?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setPureDirect(on, zone: McZoneId) {
        let command = '/' + zone + '/setPureDirect?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setEnhancer(on, zone: McZoneId) {
        let command = '/' + zone + '/setEnhancer?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setClearVoice(on, zone: McZoneId) {
        let command = '/' + zone + '/setClearVoice?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setBassTo(val, zone: McZoneId) {
        let command = '/' + zone + '/setToneControl?mode=manual&bass=' + val;
        return this.SendGetToDevice(command);
    };
    public async setTrebleTo(val, zone: McZoneId) {
        let command = '/' + zone + '/setToneControl?mode=manual&treble=' + val;
        return this.SendGetToDevice(command);
    };
    public async setEqualizer(low, mid, high, zone: McZoneId) {
        let command = '/' + zone + '/setEqualizer?mode=manual&low=' + low + '&mid=' + mid + '&high=' + high;
        return this.SendGetToDevice(command);
    };
    public async setBalance(val, zone: McZoneId) {
        let command = '/' + zone + '/setBalance?value=' + val;
        return this.SendGetToDevice(command);
    };
    public async setSubwooferVolumeTo(val, zone: McZoneId) {
        let command = '/' + zone + '/setSubwooferVolume?volume=' + val;
        return this.SendGetToDevice(command);
    };
    public async setBassExtension(on, zone: McZoneId) {
        let command = '/' + zone + '/setBassExtension?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };

    //get commands
    public async getSignalInfo(zone: McZoneId) {
        let command = '/' + zone + '/getSignalInfo';
        return this.SendGetToDevice(command);
    };

    public async getStatus(zone: McZoneId) {
        let command = '/' + zone + '/getStatus';
        return this.SendGetToDevice(command);
    };

    public async getSoundProgramList(zone: McZoneId) {
        let command = '/' + zone + '/getSoundProgramList';
        return this.SendGetToDevice(command);
    };


    //------------ NetUSB commands --------------

    public async getPresetInfo() {
        let command = '/netusb/getPresetInfo';
        return this.SendGetToDevice(command);
    };
    public async getSettings() {
        let command = '/netusb/getSettings';
        return this.SendGetToDevice(command);
    };
    public async getRecentInfo() {
        let command = '/netusb/getRecentInfo';
        return this.SendGetToDevice(command);
    };
    public async clearRecentInfo() {
        let command = '/netusb/clearRecentInfo';
        return this.SendGetToDevice(command);
    };
    public async setNetPlayback(val) {
        if (!val || val == 'play') val = 'play';
        else if (val == 'stop') val = 'stop';
        else if (val == 'pause') val = 'pause';
        else if (val == 'play_pause') val = 'play_pause';
        else if (val == 'previous') val = 'previous';
        else if (val == 'next') val = 'next';
        else if (val == 'frw_start') val = 'fast_reverse_start';
        else if (val == 'frw_end') val = 'fast_reverse_end';
        else if (val == 'ffw_start') val = 'fast_forward_start';
        else if (val == 'ffw_end') val = 'fast_forward_end';
        let command = '/netusb/setPlayback?playback=' + val;
        return this.SendGetToDevice(command);
    };
    public async toggleNetRepeat() {
        let command = '/netusb/toggleRepeat';
        return this.SendGetToDevice(command);
    };
    public async toggleNetShuffle() {
        let command = '/netusb/toggleShuffle';
        return this.SendGetToDevice(command);
    };
    public async recallPreset(val, zone) {
        if (!val) val = '1';
        let command = '/netusb/recallPreset?zone=' + zone + '&num=' + val;
        return this.SendGetToDevice(command);
    };
    public async stopNet() {
        let command = '/netusb/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    public async pauseNet() {
        let command = '/netusb/setPlayback?playback=pause';
        return this.SendGetToDevice(command);
    };
    public async playNet() {
        let command = '/netusb/setPlayback?playback=play';
        return this.SendGetToDevice(command);
    };
    public async nextNet() {
        let command = '/netusb/setPlayback?playback=next';
        return this.SendGetToDevice(command);
    };
    public async prevNet() {
        let command = '/netusb/setPlayback?playback=previous';
        return this.SendGetToDevice(command);
    };
    public async frwNet(state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/netusb/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return this.SendGetToDevice(command);
    };
    public async ffwNet(state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/netusb/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return this.SendGetToDevice(command);
    };
    //----------- NETUSB list info -------------
    public async getListInfo(input, index, size, lang) {
        if (size == null || size == 'undefined') { size = '8' }
        if (lang == null || lang == 'undefined') { lang = '' } else { lang = '&lang=' + lang; }
        let command = '/netusb/getListInfo?input=' + input + '&index=' + index + '&size=' + size + lang;
        return this.SendGetToDevice(command);
    };
    public async setListControl(listId, type, index, zone) {
        if (index == null || index == 'undefined') { index = '' } else { index = '&index=' + index; }
        if (zone == null || zone == 'undefined') { zone = '' } else { zone = '&zone=' + zone; }
        let command = '/netusb/setListControl?list_id=' + listId + '&type=' + type + index + zone;
        return this.SendGetToDevice(command);
    };
    //------------ NETUSB + CD commands ------------
    public async getPlayInfo(val) {
        let command: string;
        if (val === 'cd') {
            command = '/cd/getPlayInfo';
        } else {
            command = '/netusb/getPlayInfo';
        }
        return this.SendGetToDevice(command);
    };

    //------------ CD commands ------------

    public async setCDPlayback(val) {
        if (!val || val == 'play') val = 'play';
        else if (val == 'stop') val = 'stop';
        else if (val == 'pause') val = 'pause';
        else if (val == 'play_pause') val = 'play_pause';
        else if (val == 'previous') val = 'previous';
        else if (val == 'next') val = 'next';
        else if (val == 'frw_start') val = 'fast_reverse_start';
        else if (val == 'frw_end') val = 'fast_reverse_end';
        else if (val == 'ffw_start') val = 'fast_forward_start';
        else if (val == 'ffw_end') val = 'fast_forward_end';
        let command = '/cd/setPlayback?playback=' + val;
        return this.SendGetToDevice(command);
    };
    public async toggleTray() {
        let command = '/cd/toggleTray';
        return this.SendGetToDevice(command);
    };
    public async toggleCDRepeat() {
        let command = '/cd/toggleRepeat';
        return this.SendGetToDevice(command);
    };
    public async toggleCDShuffle() {
        let command = '/cd/toggleShuffle';
        return this.SendGetToDevice(command);
    };
    public async stopCD() {
        let command = '/cd/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    public async pauseCD() {
        let command = '/cd/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    public async playCD() {
        let command = '/cd/setPlayback?playback=play';
        return this.SendGetToDevice(command);
    };
    public async nextCD() {
        let command = '/cd/setPlayback?playback=next';
        return this.SendGetToDevice(command);
    };
    public async prevCD() {
        let command = '/cd/setPlayback?playback=previous';
        return this.SendGetToDevice(command);
    };
    public async frwCD(state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/cd/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return this.SendGetToDevice(command);
    };
    public async ffwCD(state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/cd/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return this.SendGetToDevice(command);
    };


    //-------------System commands------
    public async getDeviceInfo() {
        let command = '/system/getDeviceInfo';
        return this.SendGetToDevice(command);
    };
    public async getFeatures() {
        let command = '/system/getFeatures';
        return this.SendGetToDevice(command);
    };
    public async getNetworkStatus() {
        let command = '/system/getNetworkStatus';
        return this.SendGetToDevice(command);
    };
    public async getFuncStatus() {
        let command = '/system/getFuncStatus';
        return this.SendGetToDevice(command);
    };
    public async getNameText(zone) {
        let command = '/system/getNameText?id=' + zone;
        return this.SendGetToDevice(command);
    };
    public async getLocationInfo() {
        let command = '/system/getLocationInfo';
        return this.SendGetToDevice(command);
    };
    public async getStereoPairInfo() {
        let command = '/system/getStereoPairInfo';
        return this.SendGetToDevice(command);
    };
    public async setAutoPowerStandby(state, zone) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setAutoPowerStandby?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setHdmiOut1(state, zone) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setHdmiOut1?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setHdmiOut2(state, zone) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setHdmiOut2?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };

    //-----------  advanced ------------

    public async setLinkControl(control, zone) {
        let command = '/' + zone + '/setLinkControl?control=' + control;
        return this.SendGetToDevice(command);
    };
    public async setLinkAudioDelay(delay, zone) {
        let command = '/' + zone + '/setLinkAudioDelay?delay=' + delay;
        return this.SendGetToDevice(command);
    };
    public async setLinkAudioQuality(mode, zone) {
        let command = '/' + zone + '/setLinkAudioQuality?delay=' + mode;
        return this.SendGetToDevice(command);
    };
    public async getDistributionInfo() {
        let command = '/dist/getDistributionInfo';
        return this.SendGetToDevice(command);
    };
    public async setServerInfo(group_id: string, zone: McZoneId, type: "add" | "remove", client_list: string[]) {
        let command = '/dist/setServerInfo';
        return this.SendPostToDevice(command, { group_id, zone, type, client_list });
    };
    public async setClientInfo(group_id: string, zone: McZoneId[], server_ip_address?: string) {
        let command = '/dist/setClientInfo';
        return this.SendPostToDevice(command, { group_id, zone, server_ip_address });
    };
    public async startDistribution(num: 0 | 1 | 2) {
        let command = '/dist/startDistribution?num=' + num;
        return this.SendGetToDevice(command);
    };
    public async stopDistribution() {
        let command = '/dist/stopDistribution';
        return this.SendGetToDevice(command);
    };
    public async setGroupName(name: string) {
        let command = '/dist/setGroupName';
        return this.SendPostToDevice(command, { name: name });
    };

    //-----------  Tuner ------------
    public async getTunerPresetInfo(band) {
        let command = '/tuner/getPresetInfo?band=' + band;
        return this.SendGetToDevice(command);
    };
    public async getTunerPlayInfo() {
        let command = '/tuner/getPlayInfo';
        return this.SendGetToDevice(command);
    };
    public async setBand(band) {
        let command = '/tuner/setBand?band=' + band;
        return this.SendGetToDevice(command);
    };
    public async setFreqDirect(band, freq) {
        let command = '/tuner/setFreq?band=' + band + '&tuning=direct&num=' + freq;
        return this.SendGetToDevice(command);
    };
    public async switchPresetTuner(direction) {
        let command = '/tuner/switchPreset?dir=' + direction;
        return this.SendGetToDevice(command);
    };
    public async setDabService(direction) {
        let command = '/tuner/setDabService?dir=' + direction;
        return this.SendGetToDevice(command);
    };

    //-----------  Clock ------------    
    public async getClockSettings() {
        let command = '/clock/getSettings';
        return this.SendGetToDevice(command);
    };
    public async setClockAutoSync(state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/clock/setAutoSync?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    public async setClockDateTime(datetime) {
        let command = '/clock/setDateAndTime?date_time=' + datetime;
        return this.SendGetToDevice(command);
    };
    public async setClockFormat(format) {
        let command = '/clock/setClockFormat?format=' + format;
        return this.SendGetToDevice(command);
    }
    public async setAlarmSettings(data) {
        let command = '/clock/SetAlarmSettings';
        return this.SendPostToDevice(command, data);
    };
}
