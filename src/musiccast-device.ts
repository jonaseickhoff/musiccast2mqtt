import { MusiccastEventListener } from './musiccast-event-listener';
import { StaticLogger } from './static-logger';
import { McDistributionInfo, McFeatures, McZoneId } from './musiccast-features';

var Promise = require("bluebird");
var request = Promise.promisify(require("@root/request"));
Promise.promisifyAll(request);


interface updateCallback { (device: MusiccastDevice, topic: string, payload: any): void }

export class MusiccastDevice {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastDevice.main');

    private readonly responseDelay: number;
    private readonly requestTimeout: number;
    private readonly catchRequestErrors: boolean;
    private readonly publishUpdate: updateCallback;

    private features: McFeatures;
    private distributionInfos: McDistributionInfo;
    private status: any = {};
    private isInitalized: boolean = false;

    public readonly device_id: string;
    public ip: string;
    public name: string;
    public model: string;

    constructor(device_id: string, ip: string, name: string, model: string, publishUpdate: updateCallback) {
        this.device_id = device_id;
        this.ip = ip;
        this.name = name;
        this.model = model;
        this.publishUpdate = publishUpdate;

        this.responseDelay = 1;
        this.requestTimeout = 5000;
        this.catchRequestErrors = true

        MusiccastEventListener.DefaultInstance.RegisterSubscription(this.device_id, (event: any) => this.parseNewEvent(event))
        this.initDevice();
    }

    public async pollDevice(): Promise<void> {
        if (this.isInitalized) {
            try {
                for (const zone of this.features.zone) {
                    await this.updateStatus(zone.id);
                    await this.updateDistributionInfo();
                }
            } catch (error) {
                this.log.error("{device_id}: Error polling device status {error}", this.device_id, error)
            }
        }
    }

    public setMqtt(topic: string, payload) {
        const [prefix, set, deviceId, param1, param2] = topic.split('/');
        if (this.device_id === deviceId && Object.values(McZoneId).includes(<McZoneId>param1)) {
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
                default:
                    this.log.error("unknown {topic}", topic)
            }
        }
        else {
            this.log.error("wrong topic for device: {device}, topic: {topic}", this.device_id, topic)
        }
    }



    private async updateStatus(zoneId: McZoneId) {
        this.status[zoneId] = await this.getStatus(zoneId);
        this.publishUpdate(this, `${zoneId}/status`, this.status[zoneId]);
        this.parseStatusPart(zoneId, this.status[zoneId]);
    }

    private async updateDistributionInfo() {
        this.distributionInfos = await this.getDistributionInfo();
        this.publishUpdate(this, `distributionInfo`, this.distributionInfos);
    }

    private async initDevice(): Promise<void> {
        this.features = await this.getFeatures();
        this.log.debug("{device_id} Features: {features}", this.device_id, this.features);
        this.isInitalized = true;
    }


    private async parseNewEvent(event: any): Promise<void> {
        this.log.debug("device {device_id} new event: {message}", this.device_id, event);
        for (const zone of this.features.zone) {
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

    private async SendGetToDevice(cmd) {
        var delay = 0;
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

        var prom = request.getAsync(req).delay(delay).then(response => response.body)
        if (this.catchRequestErrors === true)
            prom.catch(console.log.bind(console));

        return prom

    };

    private async SendPostToDevice(cmd, data) {
        let delay: number = this.responseDelay * 1000;
        var req = {
            method: 'POST',
            uri: 'http://' + this.ip + '/YamahaExtendedControl/v1' + cmd,
            body: data,
            timeout: this.requestTimeout
        };
        this.log.verbose("Device {name} Post Request {request}", this.name, JSON.stringify(req));

        var prom = request.postAsync(req).delay(delay).then(response => response.body)
        if (this.catchRequestErrors === true)
            prom.catch(console.log.bind(console));

        return prom
    };


    // ---- zone number to string
    private getZone(zone?: McZoneId) {
        // if (!zone) return "main";
        // if (zone.length == 1) {
        //     zone = zone.replace("/^1", "main");
        //     zone = zone.replace("/^2", "zone2");
        //     zone = zone.replace("/^3", "zone3");
        //     zone = zone.replace("/^4", "zone4");
        // }
        // switch (zone) {
        //     case 1:
        //         zone = "main";
        //         break;
        //     case 2: case 3: case 4:
        //         zone = "zone" + zone;
        // }
        return zone;
    }

    //-------------Zone related comands----------

    power = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setPower?power=' + ((on === 'on' || on === true || on === 'true') ? 'on' : 'standby');
        return this.SendGetToDevice(command);
    };
    powerOn = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setPower?power=on'
        return this.SendGetToDevice(command);
    };
    powerOff = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setPower?power=standby';
        return this.SendGetToDevice(command);
    };
    sleep = function (val, zone?: McZoneId) {
        if (val < 30) val = '0';
        else if (val < 60) val = '30';
        else if (val < 90) val = '60';
        else if (val < 120) val = '90';
        else val = '120';
        var command = '/' + this.getZone(zone) + '/setSleep?sleep=' + val;
        return this.SendGetToDevice(command);
    };
    setVolumeTo = function (to, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setVolume?volume=' + to;
        return this.SendGetToDevice(command);
    };
    mute = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setMute?enable=' + ((on === 'true' || on === true) ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    muteOn = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setMute?enable=true';
        return this.SendGetToDevice(command);
    };
    muteOff = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setMute?enable=false';
        return this.SendGetToDevice(command);
    };
    setInput = function (input, zone?: McZoneId, mode?) {
        if (mode == null || mode == 'undefined') { mode = '' } else { mode = '&mode=' + mode }
        //check for correct input in calling program
        var command = '/' + this.getZone(zone) + '/setInput?input=' + input + mode;
        return this.SendGetToDevice(command);
    };
    setSound = function (input, zone?: McZoneId) {
        //check for correct input in calling program
        var command = '/' + this.getZone(zone) + '/setSoundProgram?program=' + input;
        return this.SendGetToDevice(command);
    };
    surround = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/set3dSurround?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    surroundOn = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/set3dSurround?enable=true';
        return this.SendGetToDevice(command);
    };
    surroundOff = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/set3dSurround?enable=false';
        return this.SendGetToDevice(command);
    };
    setDirect = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setDirect?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setPureDirect = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setPureDirect?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setEnhancer = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setEnhancer?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setClearVoice = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setClearVoice?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setBassTo = function (val, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setToneControl?mode=manual&bass=' + val;
        return this.SendGetToDevice(command);
    };
    setTrebleTo = function (val, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setToneControl?mode=manual&treble=' + val;
        return this.SendGetToDevice(command);
    };
    setEqualizer = function (low, mid, high, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setEqualizer?mode=manual&low=' + low + '&mid=' + mid + '&high=' + high;
        return this.SendGetToDevice(command);
    };
    setBalance = function (val, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setBalance?value=' + val;
        return this.SendGetToDevice(command);
    };
    setSubwooferVolumeTo = function (val, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setSubwooferVolume?volume=' + val;
        return this.SendGetToDevice(command);
    };
    setBassExtension = function (on, zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/setBassExtension?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };

    //get commands
    getSignalInfo = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/getSignalInfo';
        return this.SendGetToDevice(command);
    };

    getStatus = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/getStatus';
        return this.SendGetToDevice(command);
    };

    getSoundProgramList = function (zone?: McZoneId) {
        var command = '/' + this.getZone(zone) + '/getSoundProgramList';
        return this.SendGetToDevice(command);
    };


    //------------ NetUSB commands --------------

    getPresetInfo = function () {
        var command = '/netusb/getPresetInfo';
        return this.SendGetToDevice(command);
    };
    getSettings = function () {
        var command = '/netusb/getSettings';
        return this.SendGetToDevice(command);
    };
    getRecentInfo = function () {
        var command = '/netusb/getRecentInfo';
        return this.SendGetToDevice(command);
    };
    clearRecentInfo = function () {
        var command = '/netusb/clearRecentInfo';
        return this.SendGetToDevice(command);
    };
    setNetPlayback = function (val) {
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
        var command = '/netusb/setPlayback?playback=' + val;
        return this.SendGetToDevice(command);
    };
    toggleNetRepeat = function () {
        var command = '/netusb/toggleRepeat';
        return this.SendGetToDevice(command);
    };
    toggleNetShuffle = function () {
        var command = '/netusb/toggleShuffle';
        return this.SendGetToDevice(command);
    };
    recallPreset = function (val, zone) {
        if (!val) val = '1';
        var command = '/netusb/recallPreset?zone=' + this.getZone(zone) + '&num=' + val;
        return this.SendGetToDevice(command);
    };
    stopNet = function () {
        var command = '/netusb/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    pauseNet = function () {
        var command = '/netusb/setPlayback?playback=pause';
        return this.SendGetToDevice(command);
    };
    playNet = function () {
        var command = '/netusb/setPlayback?playback=play';
        return this.SendGetToDevice(command);
    };
    nextNet = function () {
        var command = '/netusb/setPlayback?playback=next';
        return this.SendGetToDevice(command);
    };
    prevNet = function () {
        var command = '/netusb/setPlayback?playback=previous';
        return this.SendGetToDevice(command);
    };
    frwNet = function (state) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/netusb/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return this.SendGetToDevice(command);
    };
    ffwNet = function (state) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/netusb/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return this.SendGetToDevice(command);
    };
    //----------- NETUSB list info -------------
    getListInfo = function (input, index, size, lang) {
        if (size == null || size == 'undefined') { size = '8' }
        if (lang == null || lang == 'undefined') { lang = '' } else { lang = '&lang=' + lang; }
        var command = '/netusb/getListInfo?input=' + input + '&index=' + index + '&size=' + size + lang;
        return this.SendGetToDevice(command);
    };
    setListControl = function (listId, type, index, zone) {
        if (index == null || index == 'undefined') { index = '' } else { index = '&index=' + index; }
        if (zone == null || zone == 'undefined') { zone = '' } else { zone = '&zone=' + zone; }
        var command = '/netusb/setListControl?list_id=' + listId + '&type=' + type + index + zone;
        return this.SendGetToDevice(command);
    };
    //------------ NETUSB + CD commands ------------
    getPlayInfo = function (val) {
        if (val === 'cd') {
            var command = '/cd/getPlayInfo';
        } else {
            var command = '/netusb/getPlayInfo';
        }
        return this.SendGetToDevice(command);
    };

    //------------ CD commands ------------

    setCDPlayback = function (val) {
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
        var command = '/cd/setPlayback?playback=' + val;
        return this.SendGetToDevice(command);
    };
    toggleTray = function () {
        var command = '/cd/toggleTray';
        return this.SendGetToDevice(command);
    };
    toggleCDRepeat = function () {
        var command = '/cd/toggleRepeat';
        return this.SendGetToDevice(command);
    };
    toggleCDShuffle = function () {
        var command = '/cd/toggleShuffle';
        return this.SendGetToDevice(command);
    };
    stopCD = function () {
        var command = '/cd/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    pauseCD = function () {
        var command = '/cd/setPlayback?playback=stop';
        return this.SendGetToDevice(command);
    };
    playCD = function () {
        var command = '/cd/setPlayback?playback=play';
        return this.SendGetToDevice(command);
    };
    nextCD = function () {
        var command = '/cd/setPlayback?playback=next';
        return this.SendGetToDevice(command);
    };
    prevCD = function () {
        var command = '/cd/setPlayback?playback=previous';
        return this.SendGetToDevice(command);
    };
    frwCD = function (state) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/cd/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return this.SendGetToDevice(command);
    };
    ffwCD = function (state) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/cd/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return this.SendGetToDevice(command);
    };


    //-------------System commands------
    getDeviceInfo = function () {
        var command = '/system/getDeviceInfo';
        return this.SendGetToDevice(command);
    };
    getFeatures = function () {
        var command = '/system/getFeatures';
        return this.SendGetToDevice(command);
    };
    getNetworkStatus = function () {
        var command = '/system/getNetworkStatus';
        return this.SendGetToDevice(command);
    };
    getFuncStatus = function () {
        var command = '/system/getFuncStatus';
        return this.SendGetToDevice(command);
    };
    getNameText = function (zone) {
        var command = '/system/getNameText?id=' + zone;
        return this.SendGetToDevice(command);
    };
    getLocationInfo = function () {
        var command = '/system/getLocationInfo';
        return this.SendGetToDevice(command);
    };
    setAutoPowerStandby = function (state, zone) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/system/setAutoPowerStandby?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setHdmiOut1 = function (state, zone) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/system/setHdmiOut1?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setHdmiOut2 = function (state, zone) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/system/setHdmiOut2?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };

    //-----------  advanced ------------

    setLinkControl = function (control, zone) {
        var command = '/' + this.getZone(zone) + '/setLinkControl?control=' + control;
        return this.SendGetToDevice(command);
    };
    setLinkAudioDelay = function (delay, zone) {
        var command = '/' + this.getZone(zone) + '/setLinkAudioDelay?delay=' + delay;
        return this.SendGetToDevice(command);
    };
    setLinkAudioQuality = function (mode, zone) {
        var command = '/' + this.getZone(zone) + '/setLinkAudioQuality?delay=' + mode;
        return this.SendGetToDevice(command);
    };
    getDistributionInfo = function () {
        var command = '/dist/getDistributionInfo';
        return this.SendGetToDevice(command);
    };
    setServerInfo = function (data) {
        var command = '/dist/setServerInfo';
        return this.SendPostToDevice(command, data);
    };
    setClientInfo = function (data) {
        var command = '/dist/setClientInfo';
        return this.SendPostToDevice(command, data);
    };
    startDistribution = function (num) {
        var command = '/dist/startDistribution?num=' + num;
        return this.SendGetToDevice(command);
    };
    stopDistribution = function () {
        var command = '/dist/stopDistribution';
        return this.SendGetToDevice(command);
    };
    setGroupName = function (name) {
        var command = '/dist/setGroupName';
        return this.SendPostToDevice(command, name);
    };

    //-----------  Tuner ------------
    getTunerPresetInfo = function (band) {
        var command = '/tuner/getPresetInfo?band=' + band;
        return this.SendGetToDevice(command);
    };
    getTunerPlayInfo = function () {
        var command = '/tuner/getPlayInfo';
        return this.SendGetToDevice(command);
    };
    setBand = function (band) {
        var command = '/tuner/setBand?band=' + band;
        return this.SendGetToDevice(command);
    };
    setFreqDirect = function (band, freq) {
        var command = '/tuner/setFreq?band=' + band + '&tuning=direct&num=' + freq;
        return this.SendGetToDevice(command);
    };
    switchPresetTuner = function (direction) {
        var command = '/tuner/switchPreset?dir=' + direction;
        return this.SendGetToDevice(command);
    };
    setDabService = function (direction) {
        var command = '/tuner/setDabService?dir=' + direction;
        return this.SendGetToDevice(command);
    };

    //-----------  Clock ------------    
    getClockSettings = function () {
        var command = '/clock/getSettings';
        return this.SendGetToDevice(command);
    };
    setClockAutoSync = function (state) {
        var on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        var command = '/clock/setAutoSync?enable=' + (on ? 'true' : 'false');
        return this.SendGetToDevice(command);
    };
    setClockDateTime = function (datetime) {
        var command = '/clock/setDateAndTime?date_time=' + datetime;
        return this.SendGetToDevice(command);
    };
    setClockFormat = function (format) {
        var command = '/clock/setClockFormat?format=' + format;
        return this.SendGetToDevice(command);
    }
    setAlarmSettings = function (data) {
        var command = '/clock/SetAlarmSettings';
        return this.SendPostToDevice(command, data);
    };
}
