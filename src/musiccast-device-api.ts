import { ConfigLoader } from "./config";
import { McCdPlayInfo, McFeatures, McInputId, McNameText, McNetPlayInfo, McResponseCode, McSoundProgram, McTunerPlayInfo, McZoneId } from "./musiccast-types";
import request from "./request";
import { StaticLogger } from "./static-logger";

export module McDeviceApi {

    const log = StaticLogger.CreateLoggerForSource('MusiccastDeviceApi');
    const config = ConfigLoader.Config();
    const requestTimeout = 5000;
    const responseDelay = 1;

    async function SendGetToDevice(ip: string, cmd: string): Promise<any> {
        let req = {
            method: 'GET',
            uri: 'http://' + ip + '/YamahaExtendedControl/v1' + cmd,
            headers: {
                'X-AppName': 'MusicCast/1.0',
                'X-AppPort': config.udpPort
            },
            json: true,
            timeout: requestTimeout
        };
        log.verbose("Device {ip} Get Request {request}", ip, JSON.stringify(req));

        try {
            let response = await request.getAsync(req);
            let body = response.body;
            if (body.response_code === 0) {
                delete body.response_code;
                return body;
            }
            else {
                log.error("Error SendGetToDevice ip: '{ip}' responseCode: '{code} - {codeName}'  cmd: '{cmd}'", ip, body.response_code, McResponseCode[body.response_code], cmd)
                throw {
                    response_code: body.response_code,
                    message: McResponseCode[body.response_code]
                };
            }
        } catch (error) {
            log.error("Error SendGetToDevice ip: '{ip}' error: '{error}'", ip, error)
            throw error;
        }
    };

    export async function SendPostToDevice(ip: string, cmd: string, data: any): Promise<any> {
        let delay: number = responseDelay * 1000;
        let req = {
            method: 'POST',
            uri: 'http://' + ip + '/YamahaExtendedControl/v1' + cmd,
            json: data,
            timeout: requestTimeout
        };
        log.verbose("Device {ip} Post Request {request}", ip, JSON.stringify(req));
        try {
            let response = await request.postAsync(req);
            await new Promise(resolve => setTimeout(resolve, delay));
            let body = response.body;
            if (body.response_code === 0) {
                delete body.response_code;
                return body;
            } else {
                log.error("Error SendPostToDevice ip: '{ip}' responseCode: '{code} - {codeName}' cmd: '{cmd}', data: {data}", ip, body.response_code, McResponseCode[body.response_code], cmd, data)
                throw {
                    response_code: body.response_code,
                    message: McResponseCode[body.response_code]
                };
            }
        } catch (error) {
            log.error("Error SendPostToDevice ip: '{ip}' cmd: '{cmd}' data: '{data}' error: '{error}'", ip, cmd, data, error)
            throw error;
        }
    };

    //-------------Zone related comands----------

    export async function power(ip: string, on: boolean, zone: McZoneId) {
        let command = '/' + zone + '/setPower?power=' + (on ? 'on' : 'standby');
        return SendGetToDevice(ip, command);
    }

    export async function powerToggle(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/setPower?power=toggle';
        return SendGetToDevice(ip, command);
    }

    export async function sleep(ip: string, time: number, zone: McZoneId) {
        let sleep: string;
        if (time < 30) sleep = '0';
        else if (time < 60) sleep = '30';
        else if (time < 90) sleep = '60';
        else if (time < 120) sleep = '90';
        else sleep = '120';
        let command = '/' + zone + '/setSleep?sleep=' + sleep;
        return SendGetToDevice(ip, command);
    }

    export async function setVolumeTo(ip: string, to, zone: McZoneId) {
        let command = '/' + zone + '/setVolume?volume=' + to;
        return SendGetToDevice(ip, command);
    }

    export async function mute(ip: string, on: boolean, zone: McZoneId) {
        let command = '/' + zone + '/setMute?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setInput(ip: string, input: McInputId, zone: McZoneId, mode?) {
        if (mode == null || mode == 'undefined') { mode = '' } else { mode = '&mode=' + mode }
        //check for correct input in calling program
        let command = '/' + zone + '/setInput?input=' + input + mode;
        return SendGetToDevice(ip, command);
    }

    export async function setSound(ip: string, soundprogram: McSoundProgram, zone: McZoneId) {
        //check for correct input in calling program
        let command = '/' + zone + '/setSoundProgram?program=' + soundprogram;
        return SendGetToDevice(ip, command);
    }

    export async function surround(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function surroundOn(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=true';
        return SendGetToDevice(ip, command);
    }

    export async function surroundOff(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/set3dSurround?enable=false';
        return SendGetToDevice(ip, command);
    }

    export async function setDirect(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/setDirect?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setPureDirect(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/setPureDirect?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setEnhancer(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/setEnhancer?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setClearVoice(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/setClearVoice?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setBassTo(ip: string, val, zone: McZoneId) {
        let command = '/' + zone + '/setToneControl?mode=manual&bass=' + val;
        return SendGetToDevice(ip, command);
    }

    export async function setTrebleTo(ip: string, val, zone: McZoneId) {
        let command = '/' + zone + '/setToneControl?mode=manual&treble=' + val;
        return SendGetToDevice(ip, command);
    }

    export async function setEqualizer(ip: string, low, mid, high, zone: McZoneId) {
        let command = '/' + zone + '/setEqualizer?mode=manual&low=' + low + '&mid=' + mid + '&high=' + high;
        return SendGetToDevice(ip, command);
    }

    export async function setBalance(ip: string, val, zone: McZoneId) {
        let command = '/' + zone + '/setBalance?value=' + val;
        return SendGetToDevice(ip, command);
    }

    export async function setSubwooferVolumeTo(ip: string, val, zone: McZoneId) {
        let command = '/' + zone + '/setSubwooferVolume?volume=' + val;
        return SendGetToDevice(ip, command);
    }

    export async function setBassExtension(ip: string, on, zone: McZoneId) {
        let command = '/' + zone + '/setBassExtension?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    //get commands
    export async function getSignalInfo(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/getSignalInfo';
        return SendGetToDevice(ip, command);
    }

    export async function getStatus(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/getStatus';
        return SendGetToDevice(ip, command);
    }

    export async function getSoundProgramList(ip: string, zone: McZoneId) {
        let command = '/' + zone + '/getSoundProgramList';
        return SendGetToDevice(ip, command);
    }


    //------------ NetUSB commands --------------

    export async function getPresetInfo(ip: string) {
        let command = '/netusb/getPresetInfo';
        return SendGetToDevice(ip, command);
    }

    export async function getNetPlayInfo(ip: string): Promise<McNetPlayInfo> {
        let command = '/netusb/getPlayInfo';
        let response: McNetPlayInfo = await SendGetToDevice(ip, command);
        return response;
    }

    export async function getSettings(ip: string) {
        let command = '/netusb/getSettings';
        return SendGetToDevice(ip, command);
    }

    export async function getRecentInfo(ip: string) {
        let command = '/netusb/getRecentInfo';
        return SendGetToDevice(ip, command);
    }

    export async function clearRecentInfo(ip: string) {
        let command = '/netusb/clearRecentInfo';
        return SendGetToDevice(ip, command);
    }

    export async function setNetPlayback(ip: string, val) {
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
        return SendGetToDevice(ip, command);
    }

    export async function toggleNetRepeat(ip: string) {
        let command = '/netusb/toggleRepeat';
        return SendGetToDevice(ip, command);
    }

    export async function setNetRepeat(mode: string, ip: string) {
        let command = '/netusb/setRepeat?mode=' + mode;
        return SendGetToDevice(ip, command);
    }

    export async function toggleNetShuffle(ip: string) {
        let command = '/netusb/toggleShuffle';
        return SendGetToDevice(ip, command);
    }

    export async function setNetShuffle(mode: string, ip: string) {
        let command = '/netusb/setShuffle?mode=' + mode;
        return SendGetToDevice(ip, command);
    }

    export async function recallPreset(ip: string, val, zone) {
        if (!val) val = '1';
        let command = '/netusb/recallPreset?zone=' + zone + '&num=' + val;
        return SendGetToDevice(ip, command);
    }

    export async function stopNet(ip: string) {
        let command = '/netusb/setPlayback?playback=stop';
        return SendGetToDevice(ip, command);
    }

    export async function pauseNet(ip: string) {
        let command = '/netusb/setPlayback?playback=pause';
        return SendGetToDevice(ip, command);
    }

    export async function playNet(ip: string) {
        let command = '/netusb/setPlayback?playback=play';
        return SendGetToDevice(ip, command);
    }

    export async function nextNet(ip: string) {
        let command = '/netusb/setPlayback?playback=next';
        return SendGetToDevice(ip, command);
    }

    export async function prevNet(ip: string) {
        let command = '/netusb/setPlayback?playback=previous';
        return SendGetToDevice(ip, command);
    }

    export async function setNetPlayPosition(ip: string, position: number){
        let command = '/netusb/setPlayPosition?position=' + position.toString()
        return SendGetToDevice(ip, command);
    }

    export async function frwNet(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/netusb/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return SendGetToDevice(ip, command);
    }

    export async function ffwNet(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/netusb/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return SendGetToDevice(ip, command);
    }

    //----------- NETUSB list info -------------
    export async function getListInfo(ip: string, input, index, size, lang) {
        if (size == null || size == 'undefined') { size = '8' }
        if (lang == null || lang == 'undefined') { lang = '' } else { lang = '&lang=' + lang; }
        let command = '/netusb/getListInfo?input=' + input + '&index=' + index + '&size=' + size + lang;
        return SendGetToDevice(ip, command);
    }

    export async function setListControl(ip: string, listId, type, index, zone) {
        if (index == null || index == 'undefined') { index = '' } else { index = '&index=' + index; }
        if (zone == null || zone == 'undefined') { zone = '' } else { zone = '&zone=' + zone; }
        let command = '/netusb/setListControl?list_id=' + listId + '&type=' + type + index + zone;
        return SendGetToDevice(ip, command);
    }


    //------------ CD commands ------------

    export async function getCdPlayInfo(ip: string): Promise<McCdPlayInfo> {
        let command = '/cd/getPlayInfo';
        let response: any = await SendGetToDevice(ip, command);
        return response;
    }

    export async function setCDPlayback(ip: string, val) {
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
        return SendGetToDevice(ip, command);
    }

    export async function toggleTray(ip: string) {
        let command = '/cd/toggleTray';
        return SendGetToDevice(ip, command);
    }

    export async function toggleCDRepeat(ip: string) {
        let command = '/cd/toggleRepeat';
        return SendGetToDevice(ip, command);
    }

    export async function setCDRepeat(mode: string, ip: string) {
        let command = '/cd/setRepeat?mode=' + mode;
        return SendGetToDevice(ip, command);
    }

    export async function toggleCDShuffle(ip: string) {
        let command = '/cd/toggleShuffle';
        return SendGetToDevice(ip, command);
    }

    export async function setCDShuffle(mode: string, ip: string) {
        let command = '/cd/setShuffle?mode=' + mode;
        return SendGetToDevice(ip, command);
    }

    export async function stopCD(ip: string) {
        let command = '/cd/setPlayback?playback=stop';
        return SendGetToDevice(ip, command);
    }

    export async function pauseCD(ip: string) {
        let command = '/cd/setPlayback?playback=stop';
        return SendGetToDevice(ip, command);
    }

    export async function playCD(ip: string) {
        let command = '/cd/setPlayback?playback=play';
        return SendGetToDevice(ip, command);
    }

    export async function nextCD(ip: string) {
        let command = '/cd/setPlayback?playback=next';
        return SendGetToDevice(ip, command);
    }

    export async function prevCD(ip: string) {
        let command = '/cd/setPlayback?playback=previous';
        return SendGetToDevice(ip, command);
    }

    export async function frwCD(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/cd/setDirect?playback=' + (on ? 'fast_reverse_start' : 'fast_reverse_end');
        return SendGetToDevice(ip, command);
    }

    export async function ffwCD(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/cd/setDirect?playback=' + (on ? 'fast_forward_start' : 'fast_forward_end');
        return SendGetToDevice(ip, command);
    }
    
    //-------------System commands------
    export async function getDeviceInfo(ip: string) {
        let command = '/system/getDeviceInfo';
        return SendGetToDevice(ip, command);
    }

    export async function getFeatures(ip: string): Promise<McFeatures> {
        let command = '/system/getFeatures';
        return SendGetToDevice(ip, command);
    }

    export async function getNetworkStatus(ip: string) {
        let command = '/system/getNetworkStatus';
        return SendGetToDevice(ip, command);
    }

    export async function getFuncStatus(ip: string) {
        let command = '/system/getFuncStatus';
        return SendGetToDevice(ip, command);
    }

    export async function getNameText(ip: string): Promise<McNameText> {
        let command = '/system/getNameText';
        return SendGetToDevice(ip, command);
    }

    export async function getNameTextForId(ip: string, id) {
        let command = '/system/getNameText?id=' + id;
        return SendGetToDevice(ip, command);
    }

    export async function getLocationInfo(ip: string) {
        let command = '/system/getLocationInfo';
        return SendGetToDevice(ip, command);
    }

    export async function getStereoPairInfo(ip: string) {
        let command = '/system/getStereoPairInfo';
        return SendGetToDevice(ip, command);
    }

    export async function setAutoPowerStandby(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setAutoPowerStandby?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setHdmiOut1(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setHdmiOut1?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setHdmiOut2(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/system/setHdmiOut2?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    //-----------  advanced ------------

    export async function setLinkControl(ip: string, control, zone) {
        let command = '/' + zone + '/setLinkControl?control=' + control;
        return SendGetToDevice(ip, command);
    }

    export async function setLinkAudioDelay(ip: string, delay, zone) {
        let command = '/' + zone + '/setLinkAudioDelay?delay=' + delay;
        return SendGetToDevice(ip, command);
    }

    export async function setLinkAudioQuality(ip: string, mode, zone) {
        let command = '/' + zone + '/setLinkAudioQuality?delay=' + mode;
        return SendGetToDevice(ip, command);
    }

    export async function getDistributionInfo(ip: string) {
        let command = '/dist/getDistributionInfo';
        return SendGetToDevice(ip, command);
    }

    export async function setServerInfo(ip: string, group_id: string, zone: McZoneId, type: "add" | "remove", client_list: string[]) {
        let command = '/dist/setServerInfo';
        return SendPostToDevice(ip, command, { group_id, zone, type, client_list });
    }

    export async function setClientInfo(ip: string, group_id: string, zone: McZoneId[], server_ip_address?: string) {
        let command = '/dist/setClientInfo';
        return SendPostToDevice(ip, command, { group_id, zone, server_ip_address });
    }

    export async function startDistribution(ip: string, num: 0 | 1 | 2) {
        let command = '/dist/startDistribution?num=' + num;
        return SendGetToDevice(ip, command);
    }

    export async function stopDistribution(ip: string) {
        let command = '/dist/stopDistribution';
        return SendGetToDevice(ip, command);
    }

    export async function setGroupName(ip: string, name: string) {
        let command = '/dist/setGroupName';
        return SendPostToDevice(ip, command, { name: name });
    }

    //-----------  Tuner ------------
    export async function getTunerPresetInfo(ip: string, band) {
        let command = '/tuner/getPresetInfo?band=' + band;
        return SendGetToDevice(ip, command);
    }

    export async function getTunerPlayInfo(ip: string): Promise<McTunerPlayInfo> {
        let command = '/tuner/getPlayInfo';
        let response: McTunerPlayInfo = await SendGetToDevice(ip, command);
        return response;
    }

    export async function setBand(ip: string, band) {
        let command = '/tuner/setBand?band=' + band;
        return SendGetToDevice(ip, command);
    }

    export async function setFreqDirect(ip: string, band, freq) {
        let command = '/tuner/setFreq?band=' + band + '&tuning=direct&num=' + freq;
        return SendGetToDevice(ip, command);
    }

    export async function switchPresetTuner(ip: string, direction: "next" | "previous") {
        let command = '/tuner/switchPreset?dir=' + direction;
        return SendGetToDevice(ip, command);
    }

    export async function setDabService(ip: string, direction) {
        let command = '/tuner/setDabService?dir=' + direction;
        return SendGetToDevice(ip, command);
    }


    //-----------  Clock ------------    
    export async function getClockSettings(ip: string) {
        let command = '/clock/getSettings';
        return SendGetToDevice(ip, command);
    }

    export async function setClockAutoSync(ip: string, state) {
        let on;
        if (state === '1' || state === true || state === 1 || state === 'true') {
            on = 1;
        }
        else { on = 0; }
        let command = '/clock/setAutoSync?enable=' + (on ? 'true' : 'false');
        return SendGetToDevice(ip, command);
    }

    export async function setClockDateTime(ip: string, datetime) {
        let command = '/clock/setDateAndTime?date_time=' + datetime;
        return SendGetToDevice(ip, command);
    }

    export async function setClockFormat(ip: string, format) {
        let command = '/clock/setClockFormat?format=' + format;
        return SendGetToDevice(ip, command);
    }
    export async function setAlarmSettings(ip: string, data) {
        let command = '/clock/SetAlarmSettings';
        return SendPostToDevice(ip, command, data);
    }
}