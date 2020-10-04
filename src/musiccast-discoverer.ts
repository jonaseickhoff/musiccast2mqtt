import Promise from 'bluebird'
var request = Promise.promisify(require("@root/request"));
Promise.promisifyAll(request);
import { StaticLogger } from './static-logger';


export interface DiscoveredMusiccastDevice {
    device_id: string;
    serial_number: string;
    system_id: string;
    ip: string;
    name: string;
    model: string;
}

export class MusiccastDiscoverer {

    private readonly log = StaticLogger.CreateLoggerForSource('MusiccastDiscoverer.main');
    private readonly reyxcControl: RegExp = /<yamaha:X_yxcControlURL>*.YamahaExtendedControl.*<\/yamaha:X_yxcControlURL>/i;
    private readonly reFriendlyName: RegExp = /<friendlyName>([^<]*)<\/friendlyName>/;
    private readonly reModelName: RegExp = /<modelName>([^<]*)<\/modelName>/i;
    private readonly reUniqueID: RegExp = /<serialNumber>([^<]*)<\/serialNumber>/i;

    constructor() {
    }

    /**
     * Searches for Yamaha Musiccast devices
     * @param duration time of duration in milliseconds
     */
    async discover(duration: number): Promise<DiscoveredMusiccastDevice[]> {
        return new Promise<DiscoveredMusiccastDevice[]>((resolve, reject) => {
            this.log.info('discover musiccast devices');

            var ssdp = require("peer-ssdp");
            var request = require('@root/request');
            var peer = ssdp.createPeer();
            let foundDevices: DiscoveredMusiccastDevice[] = [];

            setTimeout(async () => {
                if (peer) peer.close();
                this.log.info('discover finished');
                resolve(foundDevices);
            }, duration);

            peer.on("ready", () => {
                peer.search({
                    ST: 'urn:schemas-upnp-org:device:MediaRenderer:1'
                });
            });

            peer.on("found", (headers, address) => {
                if (headers.LOCATION) {
                    request(headers.LOCATION, async (error, response, body) => {
                        if (!error && response.statusCode == 200 && this.reyxcControl.test(body)) {
                            this.log.verbose("ssdp message: {body}", body);
                            let model = this.reModelName.exec(body);
                            let name = this.reFriendlyName.exec(body);
                            let system_id = this.reUniqueID.exec(body);
                            let foundDevice: DiscoveredMusiccastDevice = await this.GetDeviceInfo(address.address, model[1], name[1], system_id[1]);
                            if (foundDevice !== undefined) {
                                foundDevices = [...foundDevices, foundDevice];
                                this.log.info("FOUND: {foundDevice}", JSON.stringify(foundDevice));
                            } else {
                                this.log.error("Found device but cannot get Device Info: {ip} - {model} - {name}", address.address, model[1], name[1]);
                            }
                        }
                    });
                }
            });
            peer.start();
        })
    }

    private async GetDeviceInfo(ip: string, model: string, name: string, system_id: string): Promise<DiscoveredMusiccastDevice> {
        var req = {
            method: 'GET',
            uri: 'http://' + ip + '/YamahaExtendedControl/v1/system/getDeviceInfo',
            json: true,
            timeout: 1000
        };
        this.log.verbose("Get Device Info Request {request}", JSON.stringify(req));

        try {
            let response = await request.getAsync(req);
            if (response.body.response_code === 0) {
                let device: DiscoveredMusiccastDevice = { device_id: response.body.device_id, ip: ip, name, model, system_id, serial_number: response.body.serial_number }
                return device;
            }
        }
        catch (error) {
            this.log.error("Error getting Device info from {ip} during discovery: {error}", ip, error);
        }
        return undefined;
    };

  }