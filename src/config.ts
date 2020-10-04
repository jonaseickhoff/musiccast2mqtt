import yargs from 'yargs'
import fs from 'fs'
import path from 'path'
import { StaticLogger } from './static-logger';

export interface Config {
    mqtt: string;
    prefix: string;
    log: string;
    polling_interval: number;
    mqtt_retain: boolean;
    friendlynames: 'name' | 'uuid';
    insecure: boolean;
    devices: string[];
}


const defaultConfig: Config = {
    mqtt: 'mqtt://mqttbroker',
    prefix: 'musiccast',
    log: 'information',
    polling_interval: 60,
    mqtt_retain: true,
    friendlynames: 'uuid',
    insecure: true,
    devices: []
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
            .describe('mqtt', 'mqtt broker url.')
            .describe('prefix', 'instance name. used as prefix for all topics')
            .describe('log', 'Set the loglevel')
            .describe('polling_interval', `device status polling interval in seconds. Set 0 for disable polling.
            Please have in mind that listen to UDP Events is only possible if a polling is done at least every 10 minutes.`)
            .describe('mqtt_retain', '')
            .describe('friendlynames', 'Use device name or uuid (be sure to have unique device names if using name)')
            .describe('insecure', 'allow tls connections with invalid certificates')
            .describe('devices', 'array of devices which should be controlled by mqtt')
            .choices('log', ['warning', 'information', 'debug', 'verbose'])
            .boolean('mqtt_retain')
            .number('polling_interval')
            .choices('friendlynames', ['name', 'uuid'])
            .boolean('insecure')
            .array('devices')
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
                mqtt: 'mqtt://mqttbroker',
                prefix: 'musiccast',
                log: 'information',
                polling_interval: 60,
                mqtt_retain: true,
                friendlynames: 'uuid',
                insecure: true,
                devices: []
            })
            .version()
            .help('help')
            .env('MUSICCAST2MQTT')
            .argv as Partial<Config>
    }
}
