# musiccast2mqtt
This node application is a bridge between Yamaha Musiccast devices and a mqtt server. The status of all your Yamaha Musiccast devices will be published to mqtt and you can control the speakers and zones over mqtt.

I build this bridge, because i wanted to improve linking  musiccast devices. Linking devices with this bridge will automatically do some actions like unpairing from old groups or delete groups if new client device a server. In addition zones are also treated as simple devices. So you can link and unlink zones as simple as other devices.

### Usage

```
Options:
 --broker-url:                 mqtt broker url (default: "mqtt://mqttbroker:1883")
 --prefix'                     instance name. used as prefix for all topics (default: 'musiccast')
 --log                         Set the loglevel ('warning', 'information', 'debug', 'verbose') (default: information)
 --polling-interval            device status polling interval in seconds. Set 0 for disable polling. (default: 10)
                               Please have in mind that listen to UDP Events is only possible 
                               if a polling is done at least every 10 minutes
 --mqtt-retain                 enable/disable retain flag for mqtt messages (default: true)
 --friendlynames               Use device 'name' or 'id' (be sure to have unique device names if using name) 
                               (default: name)
 --zone-friendlynames          Use zone name friendly name as room name. Only useful when friendlynames set to "name"
                               (default: name)
                               Example: 
                               id:     Mainzone    -> <roomname>
                                       zone2       -> <roomname>-zone2            
                               name:   Mainzone    -> <roomname>
                                       zone2       -> <zone-friendlyname>`
 --input-friendlynames         Use friendlynames and renamed input names or fix input ids
 --soundprogram-friendlynames  Use friendlynames and renamed soundprograms names or fix soundprogram ids
 --insecure                    allow tls connections with invalid certificates (default: true)
 --devices                     array of devices which should be controlled by mqtt bridge (if you dont want to discover)
 --udp-port                    port for listening on udp events on status change. (default: 41100)
```

Options can also be given as environment variables. 
Environment variables have the prefix 'MUSICCAST2MQTT_' and are upper-case. Minus is replaced by underscore.
Example: MUSICCAST2MQTT_BROKER_URL

#### MQTT URL

You can add Username/Password for the connection to the MQTT broker to the MQTT URL param like e.g. 
`mqtt://user:pass@broker`. For a secure connection via TLS use `mqtts://` as URL scheme.

### Topics

All devices are published under your prefix topic. By default this is 'musiccast'. 

### docker-compose.yml

```
version: "3.7"
services:
  musiccast2mqtt:
    image: jme24/musiccast2mqtt
    container_name: musiccast2mqtt
    restart: unless-stopped
    ports:
      - "41100:41100/udp"
    environment:
      - MUSICCAST2MQTT_DEVICES=192.168.178.150 192.168.178.151 
      - MUSICCAST2MQTT_BROKER_URL=mqtt://192.168.178.120:1883
      - MUSICCAST2MQTT_LOG=information
      - MUSICCAST2MQTT_FRIENDLYNAMES=name
      - MUSICCAST2MQTT_POLLING_INTERVAL=10
      - MUSICCAST2MQTT_UDP_PORT=41100
```

To run `musiccast2mqtt`, place the above `docker-compose.yml` in the
musiccast2mqtt directory, adapt the environment to your needs and run
`docker-compose build && docker-compose up` within the directory.

### Running commands with musiccast2mqtt

To run commands with musiccast2mqtt send a MQTT message with to your mqtt
broker. Some examples are given in the following list with mosquitto as mqtt
client:

* Turn
  on <device>: `mosquitto_pub -h 192.168.178.120 -t musiccast/set/<device>/power -m 'on'`
* Set the volume of <device> to
  20: `mosquitto_pub -h 192.168.178.120 -t musiccast/set/<device>/volume -m '20'`
* Set <device1> and <device2> as client
  of <device>: `mosquitto_pub -h 192.168.178.120 -t musiccast/set/<device>/clients -m '<device1>,<device2>'`
* Set <device> input to
  spotify: `mosquitto_pub -h 192.168.178.120 -t musiccast/set/<device>/input -m Spotify`

To see the supported commands, have a look at `musiccast-commands.ts` and the
musiccast API at https://github.com/honnel/yamaha-commands.

## Special thanks
This bridge is inspired on [sonos2mqtt](https://github.com/svrooij/sonos2mqtt) by [Stephan van Rooij](https://github.com/svrooij). That was a great sample on how to create a smartspeaker to mqtt bridge. 
In addition [yamaha-yxc-nodejs](https://github.com/foxthefox/yamaha-yxc-nodejs) by [foxthefox](https://github.com/foxthefox) was a greate sample for communicating with musiccast devices from node.js.

