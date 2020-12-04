# musiccast2mqtt
This node application is a bridge between Yamaha Musiccast devices and a mqtt server. The status of all your Yamaha Musiccast devices will be published to mqtt and you can control the speakers over mqtt.

I build this bridge, because i wanted to improve linking  musiccast devices. Linking devices with this bridge will automatically do some actions like unpairing from old groups or delete groups if new client device a server.

### Usage

```
Options:
 --broker-url:        mqtt broker url. (default: "mqtt://mqttbroker:1883")
 --prefix'            instance name. used as prefix for all topics (default: 'musiccast')
 --log                Set the loglevel ('warning', 'information', 'debug', 'verbose') (default: information)
 --polling-interval   device status polling interval in seconds. Set 0 for disable polling. (default: 10)
                      Please have in mind that listen to UDP Events is only possible 
                      if a polling is done at least every 10 minutes
 --mqtt-retain        enable/disable retain flag for mqtt messages (default: true)
 --friendlynames      Use device name or uuid (be sure to have unique device names if using name) (default: uuid)
 --insecure           allow tls connections with invalid certificates (default: true)
 --devices            array of devices which should be controlled by mqtt bridge (if you dont want to discover)
 --udp-port            port for listening on udp events on status change. (default: 41100)
```

Options can also be given as environment variables. 
Environment variables have the prefix 'MUSICCAST2MQTT_' and are upper-case. Minus is replaced by underscore.
Example: MUSICCAST2MQTT_BROKER_URL

#### MQTT URL

You can add Username/Password for the connection to the MQTT broker to the MQTT URL param like e.g. 
`mqtt://user:pass@broker`. For a secure connection via TLS use `mqtts://` as URL scheme.

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

## Special thanks
This bridge is inspired on [sonos2mqtt](https://github.com/svrooij/sonos2mqtt) by [Stephan van Rooij](https://github.com/svrooij). That was a great sample on how to create a smartspeaker to mqtt bridge. 
In addition [yamaha-yxc-nodejs](https://github.com/foxthefox/yamaha-yxc-nodejs) by [foxthefox](https://github.com/foxthefox) was a greate sample for communicating with musiccast devices from node.js.

