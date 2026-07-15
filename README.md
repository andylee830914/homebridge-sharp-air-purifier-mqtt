# homebridge-sharp-air-purifier-mqtt

Homebridge platform plugin for Sharp air purifiers that directly controls the
device using the local ECHONET Lite protocol through
[`echonetlite2mqtt`](https://github.com/banban525/echonetlite2mqtt).

This plugin is designed for local LAN control. It talks to your air purifier
through [`echonetlite2mqtt`](https://github.com/banban525/echonetlite2mqtt) and
MQTT, so it does not require the Cocoro Air cloud API, Cocoro Air credentials,
or internet access after your local network is set up.

It creates one HomeKit accessory with an `AirPurifier` service, optional
humidity/temperature sensors, and optional humidifier control.

## Requirements

- Homebridge 1.6+
- Node.js 18+
- A running [`echonetlite2mqtt`](https://github.com/banban525/echonetlite2mqtt) instance
- MQTT broker reachable from Homebridge

No Cocoro Air API token, cloud account, or remote service is required.

This plugin was tested with a Sharp `airCleaner` device whose MQTT base topic
looks like:

```text
echonetlite2mqtt/elapi/v2/devices/<deviceId>
```

## Install

For local packaging:

```bash
npm install
npm test
npm pack
```

Then install the generated `.tgz` on your Homebridge host:

```bash
npm install -g /path/to/homebridge-sharp-air-purifier-mqtt-0.1.0.tgz
```

## Configuration

```json
{
  "platforms": [
    {
      "platform": "SharpAirPurifierMqtt",
      "name": "Sharp Air Purifier MQTT",
      "brokerUrl": "mqtt://YOUR_MQTT_HOST:1883",
      "deviceId": "YOUR_ECHONETLITE2MQTT_DEVICE_ID",
      "topicPrefix": "echonetlite2mqtt/elapi/v2/devices",
      "accessoryName": "Sharp Air Purifier",
      "enableHumiditySensor": true,
      "enableTemperatureSensor": false,
      "enableAirQualitySensor": false,
      "refreshIntervalSeconds": 60,
      "enableHumidifierService": true,
      "enableModeSwitches": true,
      "nightModeSwitchName": "Night Mode",
      "pollenModeSwitchName": "Pollen Mode",
      "realizeModeSwitchName": "Realize Mode"
    }
  ]
}
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `brokerUrl` | `mqtt://YOUR_MQTT_HOST:1883` | MQTT broker URL. |
| `username` / `password` | unset | MQTT credentials, if needed. |
| `clientId` | random | Optional MQTT client ID. |
| `deviceId` | required | `echonetlite2mqtt` air cleaner device ID. |
| `topicPrefix` | `echonetlite2mqtt/elapi/v2/devices` | MQTT topic prefix before the device ID. |
| `accessoryName` | `Sharp Air Purifier` | Name shown in HomeKit. |
| `enableHumiditySensor` | `true` | Reads humidity from Sharp `unknown_F1`. |
| `enableTemperatureSensor` | `false` | Reads temperature from Sharp `unknown_F1`. |
| `enableAirQualitySensor` | `false` | Reads PM2.5 from Sharp `unknown_F1` byte 28. |
| `refreshIntervalSeconds` | `60` | Requests `unknown_F1` on this interval for PM2.5, humidity, and temperature. Set to `0` to disable polling. |
| `enableHumidifierService` | `true` | Exposes humidifier ON/OFF control. |
| `enableModeSwitches` | `true` | Exposes Night, Pollen, and Realize mode switches. |
| `nightModeSwitchName` | `Night Mode` | Name for the Night switch. |
| `pollenModeSwitchName` | `Pollen Mode` | Name for the Pollen switch. |
| `realizeModeSwitchName` | `Realize Mode` | Name for the Realize switch. |

## Development

```bash
npm install
npm test
```

The tests cover payload generation, Sharp unknown-property parsing, and the
HomeKit-to-MQTT command path.
