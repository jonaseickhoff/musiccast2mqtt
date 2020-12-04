import yargs from 'yargs'
import fs from 'fs'
import path from 'path'
import { StaticLogger } from './static-logger';

export interface Config {
    brokerUrl: string;
    prefix: string;
    log: string;
    pollingInterval: number;
    mqttRetain: boolean;
    friendlynames: 'name' | 'uuid';
    insecure: boolean;
    devices: string[];
    udpPort: number;
}


const defaultConfig: Config = {
    brokerUrl: 'mqtt://mqttbroker',
    prefix: 'musiccast',
    log: 'information',
    pollingInterval: 10,
    mqttRetain: true,
    friendlynames: 'uuid',
    insecure: true,
    devices: [],
    udpPort: 41100
}



export class ConfigLoader {

    private static _config: Config;

    static Config(): Config {
        if (!this._config) {
            this._config = { ...defaultConfig, ...ConfigLoader.LoadConfigFromArguments() };
            StaticLogger.setLevel(this._config.log)
        }
        return this._config;
    }



    private static LoadConfigFromArguments(): Partial<Config> {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString())
        return yargs
            .describe('h', 'show help')
            .describe('broker-url', 'mqtt broker url. Example: "mqtt://mqttbroker:1883"')
            .describe('prefix', 'instance name. used as prefix for all topics')
            .describe('log', 'Set the loglevel')
            .describe('polling-interval', `device status polling interval in seconds. Set 0 for disable polling.
            Please have in mind that listen to UDP Events is only possible if a polling is done at least every 10 minutes.`)
            .describe('mqtt-retain', '')
            .describe('friendlynames', 'Use device name or uuid (be sure to have unique device names if using name)')
            .describe('insecure', 'allow tls connections with invalid certificates')
            .describe('devices', 'array of devices which should be controlled by mqtt')
            .describe('udpPort', 'port for listening on udp events on status change')
            .choices('log', ['warning', 'information', 'debug', 'verbose'])
            .string("broker-url")
            .boolean('mqtt-retain')
            .number('polling-interval')
            .choices('friendlynames', ['name', 'uuid'])
            .boolean('insecure')
            .array('devices')
            .number('udpPort')
            .coerce('devices', array => {
                const values = []
                for (const value of array) {
                    if (typeof value === 'string') {
                        values.push(...value.split(/\s+/))
                    } else {
                        values.push(value)
                    }
                }
                return values;
            })
            .alias({
                h: 'help',
            })
            .default({
                'broker-url': 'mqtt://mqttbroker',
                prefix: 'musiccast',
                log: 'information',
                'polling-interval': 10,
                'mqtt-retain': true,
                friendlynames: 'uuid',
                insecure: true,
                devices: [],
                udpPort: 41100
            })
            .version()
            .help('help')
            .env('MUSICCAST2MQTT')
            .argv as Partial<Config>
    }
}
