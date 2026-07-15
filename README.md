# homebridge-sharp-air-purifier-mqtt

Homebridge platform plugin for Sharp air purifiers exposed through
`echonetlite2mqtt`.

It creates one HomeKit accessory with an `AirPurifier` service, optional
humidity/temperature sensors, and optional humidifier control.

## Requirements

- Homebridge 1.6+
- Node.js 18+
- A running `echonetlite2mqtt` instance
- MQTT broker reachable from Homebridge

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
| `enableAirQualitySensor` | `false` | Reserved until PM mapping is verified. |
| `enableHumidifierService` | `true` | Exposes humidifier ON/OFF control. |
| `enableModeSwitches` | `true` | Exposes Night, Pollen, and Realize mode switches. |
| `nightModeSwitchName` | `Night Mode` | Name for the Night switch. |
| `pollenModeSwitchName` | `Pollen Mode` | Name for the Pollen switch. |
| `realizeModeSwitchName` | `Realize Mode` | Name for the Realize switch. |

## HomeKit Mapping

- Power:
  - HomeKit `Active`
  - MQTT `operationStatus`
- Mode:
  - HomeKit `TargetAirPurifierState`
  - Sharp `unknown_F3` operation mode
- Fan speed:
  - HomeKit `RotationSpeed`
  - low / medium / high map to Sharp silent / medium / high modes
- Special modes:
  - HomeKit switches for Night, Pollen, and Realize
  - Auto, Silent, Medium, and High stay mapped to the standard AirPurifier controls
- Humidity:
  - HomeKit `HumiditySensor`
  - parsed from `unknown_F1`
- Humidifier:
  - HomeKit `HumidifierDehumidifier`
  - controlled through Sharp `unknown_F3`

## Development

```bash
npm install
npm test
```

The tests cover payload generation, Sharp unknown-property parsing, and the
HomeKit-to-MQTT command path.
