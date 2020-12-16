import { StaticLogger } from './static-logger'
import { McGroupRole, McInputId, McZoneId } from './musiccast-types'
import { MusiccastDeviceManager } from './musiccast-device-manager';
import { McDeviceApi } from './musiccast-device-api';
import { MusiccastZone } from './musiccast-zone';
import { queue } from './async_queue';

export class MusiccastGroupMananger {

    private static instance: MusiccastGroupMananger;
    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastGroupMananger');
    private readonly mcDeviceManager = MusiccastDeviceManager.getInstance();
    private readonly queue = queue(1);

    private constructor() {
    }

    public static getInstance(): MusiccastGroupMananger {
        if (!MusiccastGroupMananger.instance) {
            MusiccastGroupMananger.instance = new MusiccastGroupMananger();
        }
        return MusiccastGroupMananger.instance;
    }

    public async queuelinkById(server_zone: MusiccastZone, client_ids: string[]): Promise<void> {
        this.queue.push(async () => await this.link(server_zone, client_ids.map(id => this.mcDeviceManager.getZoneById(id))))
    }

    public async queueunlinkById(server_zone: MusiccastZone, client_ids: string[]): Promise<void> {
        this.queue.push(async () => await this.unlink(server_zone, client_ids.map(id => this.mcDeviceManager.getZoneById(id))))
    }

    public async queuesetLinksById(server_zone: MusiccastZone, client_ids: string[]): Promise<void> {
        this.queue.push(async () => await this.setLinks(server_zone, client_ids.map(id => this.mcDeviceManager.getZoneById(id))))
    }

    public async queueunlinkFromServer(client_zone: MusiccastZone): Promise<void> {
        this.queue.push(async () => await this.unlinkFromServer(client_zone))
    }

    private async unlinkFromServer(client_zone: MusiccastZone): Promise<void> {
        if (typeof (client_zone) === 'undefined') {
            this.log.warn("unlinkFromServer() client_zone is undefined");
            return;
        }
        if (client_zone.role === McGroupRole.Client) {
            const server_zone = client_zone.linkedServer;
            if (server_zone)
                await this.unlink(server_zone, [client_zone]);
            else
                this.log.info("unlinkFromServer was called although there is no server");
        } else {
            this.log.info("device is no client");
        }
    }

    private async setLinks(server_zone: MusiccastZone, client_zones: MusiccastZone[]): Promise<void> {
        this.log.info("Start link")
        let linkedClients = server_zone.linkedClients;
        let removedClients = linkedClients.filter(d => !client_zones.includes(d));
        let addedClients = client_zones.filter(d => !linkedClients.includes(d));
        if (removedClients.length > 0)
            await this.unlink(server_zone, removedClients);
        if (addedClients.length > 0)
            await this.link(server_zone, addedClients);
        this.log.info("DONE link")

    }

    private async link(server_zone: MusiccastZone, client_zones: MusiccastZone[]): Promise<void> {
        if (typeof (server_zone) === 'undefined') {
            this.log.warn("link() server_zone is undefined");
            return;
        }

        client_zones = client_zones.filter(d => typeof (d) !== 'undefined');
        if (client_zones.length === 0) {
            this.log.warn("link() client_zones length === 0");
            return;
        }

        let createNewGroup: boolean = true;
        let server_groupId: string;
        if (server_zone.role === McGroupRole.Client) {
            // could be a problem, because after unlinking input is mc_link. mc_link cannot be distributed. The input needs to be changed before becoming a server
            this.log.debug("server_zone {zone} is a client", server_zone.id)
            await this.unlinkFromServer(server_zone);
            await server_zone.device.updateDistributionInfo();
        }
        if (server_zone.role === McGroupRole.None || server_zone.device.isGroupIdEmpty()) {
            // generate group id
            this.log.debug("server_zone {zone} is not distributing, create new group id", server_zone.id)
            server_groupId = this.createGroupId();
        }
        else if (server_zone.role === McGroupRole.Server) {
            // use existing group id
            this.log.debug("server_zone {zone} is already distributing", server_zone.id)
            server_groupId = server_zone.device.distributionInfos.group_id;
            createNewGroup = false;
        }


        let wronglinkedZones: { [group_id: string]: MusiccastZone[] } = {};
        let unlinkedZones: MusiccastZone[] = [];

        for (const client_zone of client_zones.filter(d => d.role === McGroupRole.Server)) {
            this.log.debug("client_zone {zone} is server. Has to unlink all clients before linking", client_zone.id)
            await this.unlinkAllClients(client_zone);
            unlinkedZones = [...unlinkedZones, client_zone];
        }

        for (const client_zone of client_zones.filter(d => d.role === McGroupRole.Client)) {
            const group_id = client_zone.device.distributionInfos.group_id
            if (group_id !== server_groupId) {
                this.log.debug("client_zone {zone} is already linked with other server. Has to be unlinked before new linking", client_zone.id)
                let groupClients: MusiccastZone[] = wronglinkedZones[group_id] || []
                wronglinkedZones[group_id] = [...groupClients, client_zone]
                unlinkedZones = [...unlinkedZones, client_zone];
            }
            else {
                this.log.debug("client_zone {zone} is already linked with server", client_zone.id)
            }
        }

        for (const client_zone of client_zones.filter(d => d.role === McGroupRole.None)) {
            this.log.debug("client_zone {zone} is ready to be linked", client_zone.id)
            unlinkedZones = [...unlinkedZones, client_zone];
        }

        for (const clientsToUnlink of Object.values(wronglinkedZones)) {
            let server_zone = clientsToUnlink[0].linkedServer;
            if (server_zone)
                await this.unlink(server_zone, clientsToUnlink)
        }

        let unlinkedDevices = unlinkedZones.reduce(((result, zone) => {
            result[zone.device.ip] = result[zone.device.ip] ? [...result[zone.device.ip], zone.zoneId] : [zone.zoneId]
            return result;
        }), {})

        // setClient info for other devices and set MAIN_SYNC as input for other zones on the same device
        for (const ip of Object.keys(unlinkedDevices)) {
            if (ip !== server_zone.device.ip) {
                await McDeviceApi.setClientInfo(ip, server_groupId, unlinkedDevices[ip], server_zone.device.ip)
            } else if (server_zone.zoneId === McZoneId.Main) {
                for (const zone of unlinkedDevices[ip]) {
                    await McDeviceApi.setInput(ip, McInputId.MAIN_SYNC, zone);
                }
            }
        }
        await McDeviceApi.setServerInfo(server_zone.device.ip, server_groupId, McZoneId.Main, "add", Object.keys(unlinkedDevices).filter(ip => ip !== server_zone.device.ip))
        if (createNewGroup) {
            await McDeviceApi.startDistribution(server_zone.device.ip, 0);
        } else {
            await McDeviceApi.startDistribution(server_zone.device.ip, 1);
        }
        await server_zone.device.updateDistributionInfo();
        await this.setGroupName(server_zone);
    }

    private async unlinkAllClients(server_zone: MusiccastZone): Promise<void> {
        await this.unlink(server_zone, server_zone.linkedClients);
    }

    private async unlink(server_zone: MusiccastZone, client_zones: MusiccastZone[]): Promise<void> {
        if (typeof (server_zone) === 'undefined') {
            this.log.warn("unlink() server_zone is undefined");
            return;
        }

        client_zones = client_zones.filter(d => typeof (d) !== 'undefined');
        if (client_zones.length === 0) {
            this.log.warn("unlink() client_zones length === 0");
            return;
        }

        // filter only connected devices
        client_zones = client_zones.filter(d => server_zone.linkedClients.includes(d))

        let removeIPs: string[] = [];
        // setclient info to "" for leaving group
        for (const client_zone of client_zones) {
            this.log.debug("client_zone {zone} unlink from server_zone {server} ", client_zone.id, server_zone.id)
            if (client_zone.device === server_zone.device) {
                // if zone is on same device -> change input 
                await McDeviceApi.setInput(client_zone.device.ip, McInputId.AUX, client_zone.zoneId);
                await McDeviceApi.power(client_zone.device.ip, false, client_zone.zoneId);
            } else if (Object.values(client_zone.device.zones).some(z => z !== client_zone && server_zone.linkedClients.includes(z) && !client_zones.includes(z))) {
                // if is zone on a device with other zone still linked only change input of zone 
                await McDeviceApi.setInput(client_zone.device.ip, McInputId.AUX, client_zone.zoneId);
                await McDeviceApi.power(client_zone.device.ip, false, client_zone.zoneId);
            } else {
                await McDeviceApi.setClientInfo(client_zone.device.ip, "", [client_zone.zoneId]);
                await client_zone.device.updateDistributionInfo();
                removeIPs.push(client_zone.device.ip);
            }
        }

        // last device unlinked from server -> delete group
        let deleteGroup: boolean = server_zone.linkedClients.length - client_zones.length === 0
        let groupId: string = deleteGroup ? "" : server_zone.device.distributionInfos.group_id;

        if (removeIPs.length > 0)
            await McDeviceApi.setServerInfo(server_zone.device.ip, groupId, McZoneId.Main, "remove", removeIPs)
        if (deleteGroup) {
            await McDeviceApi.stopDistribution(server_zone.device.ip,);
        }
        else {
            await McDeviceApi.startDistribution(server_zone.device.ip, 2);
        }
        await server_zone.device.updateDistributionInfo();
        await this.setGroupName(server_zone);
    }


    private async setGroupName(server_zone: MusiccastZone): Promise<void> {
        let connectedRooms: number = server_zone.linkedClients.length;
        let groupName: string = "";
        if (connectedRooms > 0) {
            groupName = `${server_zone.name} + ${connectedRooms} ${connectedRooms > 1 ? "Rooms" : "Room"}`;
        }
        await McDeviceApi.setGroupName(server_zone.device.ip, groupName);
    }

    private createGroupId(): string {
        const u: string = Date.now().toString(16) + Math.random().toString(16) + '0'.repeat(16);
        const groupId: string = u.substr(0, 12) + '40008' + u.substr(13, 15);
        return groupId;
    }
}