const mqtt = require("mqtt");
const { SharpAirPurifierAccessory } = require("./accessory");

const PLUGIN_NAME = "homebridge-sharp-air-purifier-mqtt";
const PLATFORM_NAME = "SharpAirPurifierMqtt";

class SharpAirPurifierPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.pluginName = PLUGIN_NAME;
    this.platformName = PLATFORM_NAME;

    this.name = this.config.name || "Sharp Air Purifier MQTT";
    this.brokerUrl = this.config.brokerUrl || "mqtt://YOUR_MQTT_HOST:1883";
    this.username = this.config.username;
    this.password = this.config.password;
    this.clientId = this.config.clientId || `hb-sharp-${Math.random().toString(16).slice(2, 10)}`;

    this.deviceId = this.config.deviceId || "YOUR_ECHONETLITE2MQTT_DEVICE_ID";
    this.topicPrefix = (this.config.topicPrefix || "echonetlite2mqtt/elapi/v2/devices").replace(/\/$/, "");
    this.accessoryName = this.config.accessoryName || "Sharp Air Purifier";
    this.enableHumiditySensor = this.config.enableHumiditySensor !== false;
    this.enableTemperatureSensor = this.config.enableTemperatureSensor === true;
    this.enableAirQualitySensor = this.config.enableAirQualitySensor === true;
    this.enableHumidifierService = this.config.enableHumidifierService !== false;
    this.unknownMapping = {
      humidifierF3Index: 15,
      humidifierF2Index: 24,
      airModeIndexF3: 4,
    };

    this.cachedAccessories = [];
    this.mqttClient = null;

    this.state = {
      operationStatus: false,
      airflow: "auto",
      targetAirPurifierState: this.api.hap.Characteristic.TargetAirPurifierState.AUTO,
      rotationSpeed: 100,
      humidity: null,
      temperature: null,
      operationMode: null,
      pciSensor: null,
      filterUsage: null,
      dust: null,
      smell: null,
      pm25: null,
      pm10: null,
      humidifierEnabled: false,
      humidifierRaw: null,
      unknownRaw: {
        unknown_F1: null,
        unknown_F2: null,
        unknown_F3: null,
        unknown_FC: null,
        unknown_FD: null,
      },
      unknownParsed: null,
    };

    this.topics = {
      operationStatusState: `${this.topicPrefix}/${this.deviceId}/properties/operationStatus`,
      operationStatusSet: `${this.topicPrefix}/${this.deviceId}/properties/operationStatus/set`,
      airflowState: `${this.topicPrefix}/${this.deviceId}/properties/airFlowLevel`,
      airflowSet: `${this.topicPrefix}/${this.deviceId}/properties/airFlowLevel/set`,
      allPropertiesState: `${this.topicPrefix}/${this.deviceId}/properties/+`,
      unknownF1State: `${this.topicPrefix}/${this.deviceId}/properties/unknown_F1`,
      unknownF2State: `${this.topicPrefix}/${this.deviceId}/properties/unknown_F2`,
      humidifierState: `${this.topicPrefix}/${this.deviceId}/properties/unknown_F3`,
      humidifierSet: `${this.topicPrefix}/${this.deviceId}/properties/unknown_F3/set`,
      unknownFCState: `${this.topicPrefix}/${this.deviceId}/properties/unknown_FC`,
      unknownFDState: `${this.topicPrefix}/${this.deviceId}/properties/unknown_FD`,
    };

    this.accessory = new SharpAirPurifierAccessory(this);

    this.api.on("didFinishLaunching", () => {
      this.log.info("Homebridge finished launching, starting MQTT connection");
      this.connectMqtt();
    });

    this.api.on("shutdown", () => {
      this.disconnectMqtt();
    });
  }

  configureAccessory(accessory) {
    this.cachedAccessories.push(accessory);
  }

  connectMqtt() {
    const options = {
      clientId: this.clientId,
      username: this.username,
      password: this.password,
      reconnectPeriod: 3000,
    };

    this.mqttClient = mqtt.connect(this.brokerUrl, options);

    this.mqttClient.on("connect", () => {
      this.log.info(`Connected to MQTT broker ${this.brokerUrl}`);

      const topics = [
        this.topics.operationStatusState,
        this.topics.airflowState,
      ];
      if (this.enableHumidifierService) {
        topics.push(this.topics.humidifierState);
      }
      topics.push(this.topics.allPropertiesState);

      this.mqttClient.subscribe(topics);
      this.publishRequestRefresh();
      this.accessory.publishAccessory();
    });

    this.mqttClient.on("message", (topic, payload) => {
      this.accessory.updateFromMqtt(topic, payload);
    });

    this.mqttClient.on("error", (err) => {
      this.log.warn(`MQTT error: ${err.message}`);
    });
  }

  publishRequestRefresh() {
    this.publish(`${this.topics.operationStatusState}/request`, "");
    this.publish(`${this.topics.airflowState}/request`, "");

    this.publish(`${this.topics.unknownF1State}/request`, "");
    this.publish(`${this.topics.unknownF2State}/request`, "");
    this.publish(`${this.topics.humidifierState}/request`, "");
    this.publish(`${this.topics.unknownFCState}/request`, "");
    this.publish(`${this.topics.unknownFDState}/request`, "");
  }

  publish(topic, payload) {
    if (!this.mqttClient) {
      return;
    }
    this.mqttClient.publish(topic, payload);
  }

  disconnectMqtt() {
    if (!this.mqttClient) {
      return;
    }
    this.mqttClient.end(true);
    this.mqttClient = null;
  }
}

module.exports = {
  PLUGIN_NAME,
  PLATFORM_NAME,
  SharpAirPurifierPlatform,
};
