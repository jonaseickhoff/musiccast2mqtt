import { ConfigLoader } from "./config";
import { MusiccastDevice } from "./musiccast-device";
import { McDeviceApi } from "./musiccast-device-api";
import { MusiccastDeviceManager } from "./musiccast-device-manager";
import { McGroupRole, McInputId, McSoundProgram, McStatus, McZoneEvent, McZoneFeatures, McZoneId } from "./musiccast-types";
import { StaticLogger } from "./static-logger";

interface updateCallback { (zone: MusiccastZone, topic: string, payload: any): void }

/** Mqtt Device structure */
interface zoneStatus {
    link: {
        role: McGroupRole,
        clients: string[],
        server: string
    }
    power: string,
    input: string,
    volume: number,
    mute: boolean,
    soundprogram: string,
    player: {
        playback: string,
        albumarturl: string,
        title: string,
        artist: string,
        album: string,
        playtime: number | "",
        totaltime: number | "",
    }
}

export class MusiccastZone {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastZone');

    private readonly useZoneFriendlyNames: boolean;
    private readonly useInputFriendlyNames: boolean;
    private readonly useSoundprogramFriendlyNames: boolean;

    private readonly _device: MusiccastDevice;
    private readonly _features: McZoneFeatures;

    private _linkedClients: MusiccastZone[] = [];
    private _linkedServer: MusiccastZone = null;
    public mcStatus: McStatus;

    private _status: zoneStatus = {
        link: {
            role: undefined,
            clients: [],
            server: undefined
        },
        power: undefined,
        input: undefined,
        volume: undefined,
        mute: undefined,
        soundprogram: undefined,
        player: {
            playback: undefined,
            title: undefined,
            artist: undefined,
            album: undefined,
            albumarturl: undefined,
            playtime: undefined,
            totaltime: undefined,
        }
    }

    private _publishedStatus: zoneStatus = JSON.parse(JSON.stringify(this._status));
    private readonly publishUpdate: updateCallback;

    constructor(device: MusiccastDevice, features: McZoneFeatures, publishUpdate: updateCallback,) {
        let config = ConfigLoader.Config()
        this.useZoneFriendlyNames = config.zoneFriendlynames === 'name';
        this.useInputFriendlyNames = config.inputFriendlynames === 'name';
        this.useSoundprogramFriendlyNames = config.soundprogramFriendlynames === 'name';

        this._device = device;
        this._features = features;

        this.publishUpdate = publishUpdate;
    }

    public get zoneId(): McZoneId {
        return this._features.id;
    }


    public get name(): string {
        if (this.zoneId === McZoneId.Main)
            return this._device.id;
        return this._device.zoneToFriendlyname[this.zoneId]
    }

    public get id(): string {
        if (this.zoneId === McZoneId.Main)
            return this._device.id;
        if (this.useZoneFriendlyNames) {
            return this._device.zoneToFriendlyname[this.zoneId]
        } else {
            return this._device.id + '-' + this.zoneId;
        }
    }

    public get role(): McGroupRole {
        return this._status.link.role;
    }

    public get linkedClients(): MusiccastZone[] {
        return this._linkedClients;
    }

    public get linkedServer(): MusiccastZone {
        return this._linkedServer;
    }

    public get device(): MusiccastDevice {
        return this._device;
    }

    /* Basic Functions*/

    public async power(on: boolean): Promise<void> {
        await McDeviceApi.power(this._device.ip, on, this.zoneId);
    }

    public async sleep(time: number): Promise<void> {
        await McDeviceApi.sleep(this._device.ip, time, this.zoneId);
    }

    public async setInput(input: string): Promise<void> {
        if (this.useInputFriendlyNames)
            input = this._device.friendlynameToInput[input];

        if (this._features.input_list.some(i => i === input)) {
            await McDeviceApi.setInput(this._device.ip, input as McInputId, this.zoneId);
        } else {
            this.log.warn('unkown input "{input}" for device {deviceid} in zone {zone}', input, this._device.id, this.zoneId);
            if (this.useInputFriendlyNames) {
                this.log.warn('input should have been in {friendly_names}', JSON.stringify(this._device.friendlynameToInput));
            } else {
                this.log.warn('input should have been in {input_list}', JSON.stringify(this._features.input_list));
            }
        }
    }

    public async setSoundprogram(soundprogram: string): Promise<void> {
        if (this.useSoundprogramFriendlyNames)
            soundprogram = this._device.friendlynameToSoundprogram[soundprogram];

        if (this._features.sound_program_list.some(i => i === soundprogram)) {
            await McDeviceApi.setSound(this._device.ip, soundprogram as McSoundProgram, this.zoneId);
        } else {
            this.log.warn('unkown soundprogram "{soundprogram}" for device {deviceid} in zone {zone}', soundprogram, this._device.id, this.zoneId);
        }
    }

    /** Player specifig functions */

    public async play(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.playNet(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.playCD(this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot play in this input");
        }
    }

    public async pause(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.pauseNet(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.pauseCD(this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot pause in this input");
        }
    }

    public async stop(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.stopNet(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.stopCD(this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot stop in this input");
        }
    }

    public async next(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.nextNet(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.nextCD(this._device.ip);
                break;
            case 'tuner':
                await McDeviceApi.switchPresetTuner(this._device.ip, "next");
                break;
            default:
                this.log.warn("cannot play next in this input");
        }
    }

    public async previous(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.prevNet(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.prevCD(this._device.ip);
                break;
            case 'tuner':
                await McDeviceApi.switchPresetTuner(this._device.ip, "previous");
                break;
            default:
                this.log.warn("cannot play previous in this input");
        }
    }

    public async playPosition(position: number) {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.setNetPlayPosition(this._device.ip, position);
                break;
            case 'cd':           
            case 'tuner':            
            default:
                this.log.warn("cannot set playposition in this input");
        }
      throw new Error("Method not implemented.");
    }

    public async setRepeat(mode: string,): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.setNetRepeat(mode, this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.setCDRepeat(mode, this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot set repeat mode in this input");
        }
    }

    public async toggleRepeat(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.toggleNetRepeat(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.toggleCDRepeat(this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot toggle repeate mode in this input");
        }
    }

    public async setShuffle(mode: string,): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.setNetShuffle(mode, this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.setCDShuffle(mode, this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot set shuffle mode in this input");
        }
    }

    public async toggleShuffle(): Promise<void> {
        let playinfo = this.getPlayInfo();
        switch (playinfo) {
            case 'netusb':
                await McDeviceApi.toggleNetShuffle(this._device.ip);
                break;
            case 'cd':
                await McDeviceApi.toggleCDShuffle(this._device.ip);
                break;
            case 'tuner':
            default:
                this.log.warn("cannot toggle shuffle mode in this input");
        }
    }


    private getPlayInfo(): "none" | "tuner" | "netusb" | "cd" {
        return this._device.inputToPlayinfoType[this.getInput()]
    }

    private getInput(): McInputId {
        return this.mcStatus.input
    }

    /* Control Volume */

    public async setVolume(volume: number): Promise<void> {
        let level: number = Math.round(volume / 100 * (this.getVolumeMax() - this.getVolumeMin()));
        if (level < this.getVolumeMin())
            level = this.getVolumeMin();
        else if (level > this.getVolumeMax())
            level = this.getVolumeMax();
        await McDeviceApi.setVolumeTo(this._device.ip, level, this.zoneId);
    }

    public async volumeDown(): Promise<void> {
        let levelDown: number = this.getVolume() - this.getVolumeStep();
        if (levelDown < this.getVolumeMin())
            levelDown = this.getVolumeMin();
        else if (levelDown > this.getVolumeMax())
            levelDown = this.getVolumeMax();
        await McDeviceApi.setVolumeTo(this._device.ip, levelDown, this.zoneId);
    }

    public async volumeUp(): Promise<void> {
        let levelUp: number = this.getVolume() + this.getVolumeStep();
        if (levelUp < this.getVolumeMin())
            levelUp = this.getVolumeMin();
        else if (levelUp > this.getVolumeMax())
            levelUp = this.getVolumeMax();
        await McDeviceApi.setVolumeTo(this._device.ip, levelUp, this.zoneId);
    }

    public async mute(enabled: boolean): Promise<void> {
        await McDeviceApi.mute(this._device.ip, enabled, this.zoneId)
    }

    private getVolume(): number {
        return this.mcStatus.volume;
    }

    private getVolumeMin(): number {
        return this._features.range_step.find(r => r.id == "volume")?.min;
    }

    private getVolumeMax(): number {
        return this._features.range_step.find(r => r.id == "volume")?.max;
    }

    private getVolumeStep(): number {
        return this._features.range_step.find(r => r.id == "volume")?.step;
    }




    /* Reading and Parsing Status */

    public parseZoneEvent(event: McZoneEvent){
        this.mcStatus = { ...this.mcStatus, ...event };
        if ('status_updated' in event) {
            // Returns whether or not other info has changed than main zone
            // power/input/volume/mute status. If so, pull renewed info using /main/getStatus
            this.device.updateStatus(this.zoneId);
        }
        if ('signal_info_updated' in event) {
        }
    }

    private parsePlayInfo(): void {
        if (!this.mcStatus)
            return;
        let playInfoType = this._device.inputToPlayinfoType[this.mcStatus.input];
        let playtime = -60000
        let totaltime = 0
        switch (playInfoType) {
            case 'netusb':
                if (!this._device.netPlayInfo) {
                    this.log.error("No netusbPlayInfo although netusb input selected");
                    return;
                }
                this._status.player.playback = this._device.netPlayInfo.playback || "";
                this._status.player.title = this._device.netPlayInfo.track || "";
                this._status.player.artist = this._device.netPlayInfo.artist || "";
                this._status.player.album = this._device.netPlayInfo.album || "";
                this._status.player.albumarturl = this._device.netPlayInfo.albumart_url ? `http://${this._device.ip}${this._device.netPlayInfo.albumart_url}` : "";
                playtime = this._device.netPlayInfo.play_time;
                totaltime = this._device.netPlayInfo.total_time;
                break;
            case 'cd':
                if (!this._device.cdPlayInfo) {
                    this.log.error("No cdPlayInfo although cd input selected");
                    return;
                }
                this._status.player.playback = this._device.cdPlayInfo.playback || "";
                this._status.player.title = this._device.cdPlayInfo.track || "";
                this._status.player.artist = this._device.cdPlayInfo.artist || "";
                this._status.player.album = this._device.cdPlayInfo.album || "";
                this._status.player.albumarturl = "";
                playtime = this._device.cdPlayInfo.play_time;
                totaltime = this._device.cdPlayInfo.total_time;
                break;
            case 'tuner':
                if (!this._device.tunerPlayInfo) {
                    this.log.error("No tunerPlayInfo although tuner input selected");
                    return;
                }
                switch (this._device.tunerPlayInfo.band) {
                    case 'am':
                        this._status.player.title = this._device.tunerPlayInfo.am.freq?.toString() || "";
                        this._status.player.artist = this._device.tunerPlayInfo.am.preset?.toString() || "";
                        break;
                    case 'fm':
                        if ('rds' in this._device.tunerPlayInfo) {
                            this._status.player.title = this._device.tunerPlayInfo.rds.radio_text_a || "";
                            this._status.player.artist = this._device.tunerPlayInfo.rds.radio_text_b || "";
                        } else {
                            this._status.player.title = this._device.tunerPlayInfo.fm.freq?.toString() || "";
                            this._status.player.artist = this._device.tunerPlayInfo.fm.preset?.toString() || "";
                        }
                        break;
                    case 'dab':
                        this._status.player.title = this._device.tunerPlayInfo.dab.ensemble_label || "";
                        this._status.player.artist = this._device.tunerPlayInfo.dab.dls || "";
                        break;
                    default:
                }
                this._status.player.album = "";
                this._status.player.albumarturl = "";
                this._status.player.playback = "";
                break;
            case 'none':
            default:
                this._status.player = {
                    playback: "",
                    title: "",
                    artist: "",
                    album: "",
                    albumarturl: "",
                    playtime: "",
                    totaltime: "",
                }
        }
        this._status.player.totaltime = totaltime !== 0 ? totaltime : "";
        this._status.player.playtime = playtime !== -60000 ? playtime : "";
        if (this.role == McGroupRole.Client && this.linkedServer?._status?.player?.albumarturl) {
            this._status.player.albumarturl = this.linkedServer._status.player.albumarturl;
        }
    }

    private parseStatusPart() {
        if (!this.mcStatus)
            return;
        if ('power' in this.mcStatus) {
            this._status.power = this.mcStatus.power;
        }
        if ('input' in this.mcStatus) {
            if (this.useInputFriendlyNames)
                this._status.input = this._device.inputToFriendlyname[this.mcStatus.input];
            else
                this._status.input = this.mcStatus.input;
        }
        if ('volume' in this.mcStatus) {
            let volume = Math.round(this.mcStatus.volume / (this.getVolumeMax() - this.getVolumeMin()) * 100);
            this._status.volume = volume;
        }
        if ('mute' in this.mcStatus) {
            this._status.mute = this.mcStatus.mute;
        }
        if ('sound_program' in this.mcStatus) {
            if (this.useSoundprogramFriendlyNames)
                this._status.soundprogram = this._device.soundprogramToFriendlyname[this.mcStatus.sound_program];
            else
                this._status.soundprogram = this.mcStatus.sound_program;
        }
    }

    public calculateLinkState() {
        if (!this._device.distributionInfos)
            return;

        // Part for settings state for multizone receiver
        if (this.zoneId !== McZoneId.Main && this._status.input === McInputId.MAIN_SYNC) {
            this._status.link.role = McGroupRole.Client;
            this._linkedClients = [];
            this._linkedServer = this._device.zones[McZoneId.Main];
        }
        else {
            let clientsWithoutSlaves: MusiccastDevice[] = [];
            let distributionInfos = this._device.distributionInfos;
            let server_zoneId = this._device.distributionInfos.server_zone;
            for (const client of distributionInfos.client_list) {
                const device: MusiccastDevice = MusiccastDeviceManager.getInstance().getDeviceByIp(client.ip_address);
                if (device) {
                    if (!device.isSlave)
                        clientsWithoutSlaves = [...clientsWithoutSlaves, device];
                }
                else {
                    this.log.warn("Unknown client in distributionInfos.client_list {ip}", client.ip_address);
                }
            }
            if ((distributionInfos.role === McGroupRole.Server || (distributionInfos.role === McGroupRole.None && clientsWithoutSlaves.length > 0))
                && server_zoneId === this.zoneId) {
                this._status.link.role = McGroupRole.Server
                this._linkedClients = clientsWithoutSlaves.reduce((result, client) => result.concat(Object.values(client.zones).filter(c => c.mcStatus.input === McInputId.MC_LINK)), <MusiccastZone[]>[]);
                this._linkedServer = null;
                let syncedZonesOnSameDevice = Object.values(this._device.zones).filter(z => z !== this && z.mcStatus.input === McInputId.MAIN_SYNC)
                this._linkedClients = this._linkedClients.concat(syncedZonesOnSameDevice);
            }
            else if (distributionInfos.role === McGroupRole.Client && !this._device.isGroupIdEmpty() && this.mcStatus.input === McInputId.MC_LINK) {
                this._status.link.role = McGroupRole.Client;
                let server: MusiccastDevice = MusiccastDeviceManager.getInstance().getServerByGroupId(distributionInfos?.group_id);
                if (server) {
                    this._linkedServer = server.zones[server.distributionInfos.server_zone];
                } else {
                    this.log.warn("cannot find server for group id {id}", distributionInfos.group_id)
                    this._linkedServer = null;
                }
                this._linkedClients = [];
            }
            else {
                // group id can be 00000000000000000000000000000000 when input is mc_link. In this case McGroupRole is "client" although not linked to any server device
                this._status.link.role = McGroupRole.None;
                this._linkedClients = [];
                this._linkedServer = null;
            }
        }

        this._status.link.clients = this._linkedClients.map(d => d.id);
        this._status.link.server = this._linkedServer == null ? "" : this._linkedServer.id;

    }

    /* publishing MQTT Data */

    public publishFeatures(): void {
        if (this.useInputFriendlyNames) {
            this.publishUpdate(this, "features/input", this._features.input_list.map(id => this._device.inputToFriendlyname[id]));
        } else {
            this.publishUpdate(this, "features/input", this._features.input_list);
        }
        if (this._features.sound_program_list)
            if (this.useSoundprogramFriendlyNames) {
                this.publishUpdate(this, "features/soundprogram", this._features.sound_program_list.map(id => this._device.soundprogramToFriendlyname[id]));
            } else {
                this.publishUpdate(this, "features/soundprogram", this._features.sound_program_list);
            }
    }

    public async publishChangedStatus(): Promise<void> {
        this.parseStatusPart();
        this.parsePlayInfo();
        this.calculateLinkState();
        let deviceStatus = JSON.parse(JSON.stringify(this._status));
        let publishedStatus = JSON.parse(JSON.stringify(this._publishedStatus));

        this.compareAndPublish('', deviceStatus, publishedStatus);

        this._publishedStatus = deviceStatus;
    }

    private compareAndPublish(prevTopic: string, newValue: object, oldValue: object) {
        for (let key of Object.keys(newValue)) {
            let topic = prevTopic === '' ? key : `${prevTopic}/${key}`;
            let oldVal = oldValue[key];
            let newVal = newValue[key];
            if (typeof newVal === 'object') {
                if (Array.isArray(newVal)) {
                    if (newVal.length !== oldVal.length ||
                        !newVal.every((val, index) => val === oldVal[index]))
                        this.publishUpdate(this, topic, newVal)

                } else {
                    this.compareAndPublish(`${topic}`, newVal, oldVal);
                }
            } else if (newVal !== oldVal) {
                this.publishUpdate(this, topic, newVal)
            }
        }
    }

}