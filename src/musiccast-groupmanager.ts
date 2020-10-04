import { StaticLogger } from './static-logger'
import { MusiccastDevice } from './musiccast-device'
import { MusiccastToMqtt } from './musiccast-to-mqtt'
import { McGroupRole, McInputId, McLinkedClient, McZoneId } from './musiccast-features'

export class MusiccastGroupMananger {

    private static instance: MusiccastGroupMananger;
    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastGroupMananger.main');

    private constructor() {
    }

    public static getInstance(): MusiccastGroupMananger {
        if (!MusiccastGroupMananger.instance) {
            MusiccastGroupMananger.instance = new MusiccastGroupMananger();
        }
        return MusiccastGroupMananger.instance;
    }

    public async link(server_id: string, client_ids: string[]): Promise<void> {
        await this.linkDevices(MusiccastToMqtt.mcDevices[server_id], client_ids.map(id => MusiccastToMqtt.mcDevices[id]));
    }

    public async unlink(server_id: string, client_ids: string[]): Promise<void> {
        await this.unlinkDevices(MusiccastToMqtt.mcDevices[server_id], client_ids.map(id => MusiccastToMqtt.mcDevices[id]));
    }

    private async linkDevices(server_device: MusiccastDevice, client_devices: MusiccastDevice[]): Promise<void> {
        let createNewGroup: boolean = true;
        let server_groupId: string;
        if (server_device.role === McGroupRole.Client) {
            // could be a problem, because after unlinking input is mc_link. mc_link cannot be distributed. The input needs to be changed before becoming a server
            this.log.debug("server_device {device} is a client", server_device.device_id)
            await this.unlinkFromServer(server_device);
           // await server_device.setInput(McInputId.NONE, McZoneId.Main);
            await server_device.updateDistributionInfo();
        }
        if (server_device.role === McGroupRole.None || server_device.isGroupIdEmpty()) {
            // generate group id
            this.log.debug("server_device {device} is not distributing, create new group id", server_device.device_id)
            server_groupId = this.createGroupId();
        }
        else if (server_device.role === McGroupRole.Server) {
            // use existing group id
            this.log.debug("server_device {device} is already distributing", server_device.device_id)
            server_groupId = server_device.distributionInfos.group_id;
            createNewGroup = false;
        }


        let wronglinkedDevices: { [group_id: string]: MusiccastDevice[] } = {};
        let unlinkedDevices: MusiccastDevice[] = [];

        for (const client_device of client_devices.filter(d => d.role === McGroupRole.Server)) {
            this.log.debug("client_device {device} is server. Has to unlink all clients before linking", client_device.device_id)
            await this.unlinkAllClients(client_device);
            unlinkedDevices = [...unlinkedDevices, client_device];
        }

        for (const client_device of client_devices.filter(d => d.role === McGroupRole.Client)) {
            const group_id = client_device.distributionInfos.group_id
            if (group_id !== server_groupId) {
                this.log.debug("client_device {device} is already linked with other server. Has to be unlinked before new linking", client_device.device_id)
                let groupClients: MusiccastDevice[] = wronglinkedDevices[group_id] || []
                wronglinkedDevices[group_id] = [...groupClients, client_device]
                unlinkedDevices = [...unlinkedDevices, client_device];
            }
            else {
                this.log.debug("client_device {device} is already linked with server", client_device.device_id)
            }
        }

        for (const client_device of client_devices.filter(d => d.role === McGroupRole.None)) {
            this.log.debug("client_device {device} is ready to be linked", client_device.device_id)
            unlinkedDevices = [...unlinkedDevices, client_device];
        }


        for (const group_id of Object.keys(wronglinkedDevices)) {
            // get server device of group_id and unlink selected devices
            let server_device = Object.values(MusiccastToMqtt.mcDevices).find(d => d.distributionInfos.role === McGroupRole.Server &&
                d.distributionInfos.group_id == group_id)
            await this.unlinkDevices(server_device, wronglinkedDevices[group_id])
        }

        for (const client_device of unlinkedDevices) {
            await client_device.setClientInfo(server_groupId, [McZoneId.Main], server_device.ip)
        }
        await server_device.setServerInfo(server_groupId, McZoneId.Main, "add", unlinkedDevices.map(d => d.ip))
        if (createNewGroup) {
            await server_device.startDistribution(0);
        } else {
            await server_device.startDistribution(1);
        }
        await server_device.updateDistributionInfo();
        await this.setGroupName(server_device);
    }

    private async unlinkFromServer(client_device: MusiccastDevice): Promise<void> {
        if (client_device.role === McGroupRole.Client) {
            const group_id = client_device.distributionInfos.group_id;
            const server_device = Object.values(MusiccastToMqtt.mcDevices).find(d => d.distributionInfos.role === McGroupRole.Server &&
                d.distributionInfos.group_id == group_id)
            await this.unlinkDevices(server_device, [client_device]);

        } else {
            this.log.info("device is no client");
        }
    }

    private async unlinkAllClients(server_device: MusiccastDevice): Promise<void> {
        await this.unlinkDevices(server_device, server_device.linkedDevices);
    }

    private async unlinkDevices(server_device: MusiccastDevice, client_devices: MusiccastDevice[]): Promise<void> {
        // filter only connected devices
        client_devices = client_devices.filter(d => server_device.linkedDevices.includes(d))

        // setclient info to "" for leaving group
        for (const client_device of client_devices) {
            this.log.debug("client_device {device} unlink from server_device {server} ", client_device.device_id, server_device.device_id)
            await client_device.setClientInfo("", [McZoneId.Main]);
            await client_device.updateDistributionInfo();
        }


        // last device unlinked from server -> delete group
        let deleteGroup: boolean = server_device.linkedDevices.length - client_devices.length === 0

        let groupId: string = deleteGroup ? "" : server_device.distributionInfos.group_id;

        await server_device.setServerInfo(groupId, McZoneId.Main, "remove", client_devices.map(d => d.ip))
        if (deleteGroup) {
            await server_device.stopDistribution();
        }
        else {
            await server_device.startDistribution(2);
        }
        await server_device.updateDistributionInfo();
        await this.setGroupName(server_device);
    }


    private async setGroupName(server_device: MusiccastDevice): Promise<void> {
        let connectedRooms: number = server_device.linkedDevices.length;
        let groupName: string = "";
        if (connectedRooms > 0) {
            groupName = `${server_device.name} + ${connectedRooms} ${connectedRooms > 1 ? "Rooms" : "Room"}`;
        }
        await server_device.setGroupName(groupName);
    }

    private createGroupId(): string {
        const u: string = Date.now().toString(16) + Math.random().toString(16) + '0'.repeat(16);
        const groupId: string = u.substr(0, 12) + '40008' + u.substr(13, 15);
        return groupId;
    }
}