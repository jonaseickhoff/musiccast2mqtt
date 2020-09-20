#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

import { MusiccastToMqtt } from './musiccast-to-mqtt'
import { StaticLogger } from './static-logger'
import {ConfigLoader} from './config'

const musiccastToMqtt = new MusiccastToMqtt(ConfigLoader.LoadConfig())
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString())
StaticLogger.Default().info(`Starting ${pkg.name} v${pkg.version}`)

musiccastToMqtt
    .start()
    .then(success => {
        if (success) {
            process.on('SIGINT', async () => {
                StaticLogger.Default().info('Shutdown musiccast2mqtt, please wait.')
                musiccastToMqtt.stop()
                setTimeout(() => { process.exit(0) }, 800)
            })
        }
    })
    .catch(err => {
        StaticLogger.Default().fatal(err, 'Error starting musiccast2mqtt')
    })
