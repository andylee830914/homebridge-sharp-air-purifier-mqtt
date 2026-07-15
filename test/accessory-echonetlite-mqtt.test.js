const assert = require("node:assert/strict");
const test = require("node:test");

const { SharpAirPurifierAccessory } = require("../src/accessory");
const { SharpAirPurifierPlatform } = require("../src/platform");

function createFakeApi() {
  const Characteristic = {
    Active: {
      ACTIVE: 1,
      INACTIVE: 0,
    },
    AirQuality: {
      UNKNOWN: 0,
      EXCELLENT: 1,
      GOOD: 2,
      FAIR: 3,
      INFERIOR: 4,
      POOR: 5,
    },
    CurrentHumidifierDehumidifierState: {
      INACTIVE: 0,
      HUMIDIFYING: 2,
    },
    TargetAirPurifierState: {
      MANUAL: 0,
      AUTO: 1,
    },
    TargetHumidifierDehumidifierState: {
      HUMIDIFIER: 1,
    },
    ConfiguredName: {},
    Name: {},
    On: {},
  };

  return {
    hap: {
      Characteristic,
      HAPStatus: {
        SERVICE_COMMUNICATION_FAILURE: -70402,
      },
      HapStatusError: class HapStatusError extends Error {
        constructor(status) {
          super(`HAP status ${status}`);
          this.status = status;
        }
      },
      uuid: {
        generate: (value) => value,
      },
      Service: {},
    },
    on() {},
    platformAccessory: class {},
    registerPlatformAccessories() {},
  };
}

function createPlatform(overrides = {}) {
  const api = createFakeApi();
  const publishes = [];
  const platform = {
    api,
    log: {
      warn() {},
    },
    topics: {
      operationStatusState: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus",
      operationStatusSet: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus/set",
      airflowState: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/airFlowLevel",
      unknownF1State: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F1",
      unknownF2State: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F2",
      humidifierState: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F3",
      humidifierSet: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F3/set",
      unknownFCState: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_FC",
      unknownFDState: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_FD",
    },
    state: {
      operationStatus: false,
      airflow: "auto",
      targetAirPurifierState: api.hap.Characteristic.TargetAirPurifierState.AUTO,
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
    },
    unknownMapping: {
      humidifierF3Index: 15,
      humidifierF2Index: 24,
      airModeIndexF3: 4,
    },
    enableHumiditySensor: true,
    enableTemperatureSensor: true,
    enableAirQualitySensor: false,
    enableHumidifierService: true,
    publish(topic, payload) {
      publishes.push({ topic, payload });
    },
    ...overrides,
  };

  return {
    accessory: new SharpAirPurifierAccessory(platform),
    api,
    platform,
    publishes,
  };
}

function byteAt(hexPayload, index) {
  return Buffer.from(hexPayload, "hex")[index];
}

test("platform builds echonetlite2mqtt topics and refresh requests", () => {
  const api = createFakeApi();
  const platform = new SharpAirPurifierPlatform(
    { info() {}, warn() {} },
    {
      brokerUrl: "mqtt://example.test:1883",
      deviceId: "device-1",
      topicPrefix: "echonetlite2mqtt/elapi/v2/devices/",
    },
    api,
  );
  const publishes = [];
  platform.mqttClient = {
    publish(topic, payload) {
      publishes.push({ topic, payload });
    },
  };

  assert.equal(platform.topics.operationStatusSet, "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus/set");
  assert.equal(platform.topics.humidifierSet, "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F3/set");

  platform.publishRequestRefresh();

  assert.deepEqual(publishes, [
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/airFlowLevel/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F1/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F2/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F3/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_FC/request", payload: "" },
    { topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_FD/request", payload: "" },
  ]);
});

test("platform uses configurable special mode switch names", () => {
  const api = createFakeApi();
  const platform = new SharpAirPurifierPlatform(
    { info() {}, warn() {} },
    {
      brokerUrl: "mqtt://example.test:1883",
      deviceId: "device-1",
      nightModeSwitchName: "Sleep",
      pollenModeSwitchName: "Allergy",
      realizeModeSwitchName: "Realize Boost",
    },
    api,
  );

  assert.deepEqual(platform.modeSwitchNames, {
    night: "Sleep",
    pollen: "Allergy",
    realize: "Realize Boost",
  });
});

test("platform provides default special mode switch names", () => {
  const api = createFakeApi();
  const platform = new SharpAirPurifierPlatform(
    { info() {}, warn() {} },
    {
      brokerUrl: "mqtt://example.test:1883",
      deviceId: "device-1",
    },
    api,
  );

  assert.deepEqual(platform.modeSwitchNames, {
    night: "Night Mode",
    pollen: "Pollen Mode",
    realize: "Realize Mode",
  });
});

test("air purifier active control publishes operationStatus/set", () => {
  const { accessory, publishes } = createPlatform();

  accessory.setActive(1);
  accessory.setActive(0);

  assert.deepEqual(publishes, [
    {
      topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus/set",
      payload: "true",
    },
    {
      topic: "echonetlite2mqtt/elapi/v2/devices/device-1/properties/operationStatus/set",
      payload: "false",
    },
  ]);
});

test("air purifier mode controls publish unknown_F3/set with expected mode bytes", () => {
  const { accessory, api, platform, publishes } = createPlatform();
  platform.state.humidifierEnabled = true;

  accessory.setTargetAirPurifierState(api.hap.Characteristic.TargetAirPurifierState.AUTO);
  accessory.setRotationSpeed(20);
  accessory.setRotationSpeed(60);
  accessory.setRotationSpeed(90);

  const payloads = publishes.map((entry) => entry.payload);
  assert.deepEqual(publishes.map((entry) => entry.topic), [
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
  ]);
  assert.deepEqual(payloads.map((payload) => byteAt(payload, 4)), [0x10, 0x14, 0x15, 0x16]);
  assert.deepEqual(payloads.map((payload) => byteAt(payload, 15)), [0xff, 0xff, 0xff, 0xff]);
});

test("humidifier control publishes unknown_F3/set without custom payload config", () => {
  const { accessory, api, platform, publishes } = createPlatform();
  platform.state.operationMode = "high";

  accessory.setHumidifierEnabled(api.hap.Characteristic.Active.ACTIVE);
  accessory.setHumidifierEnabled(api.hap.Characteristic.Active.INACTIVE);

  assert.equal(publishes[0].topic, platform.topics.humidifierSet);
  assert.equal(publishes[0].payload.slice(0, 8), "00090000");
  assert.equal(byteAt(publishes[0].payload, 15), 0xff);
  assert.equal(publishes[1].topic, platform.topics.humidifierSet);
  assert.equal(publishes[1].payload.slice(0, 8), "00090000");
  assert.equal(byteAt(publishes[1].payload, 15), 0x00);
});

test("special mode switches publish only night, pollen, realize modes", () => {
  const { accessory, platform, publishes } = createPlatform();
  platform.state.humidifierEnabled = true;

  accessory.setSpecialOperationMode("night", true);
  accessory.setSpecialOperationMode("pollen", true);
  accessory.setSpecialOperationMode("realize", true);
  accessory.setSpecialOperationMode("realize", false);

  const payloads = publishes.map((entry) => entry.payload);
  assert.deepEqual(publishes.map((entry) => entry.topic), [
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
    platform.topics.humidifierSet,
  ]);
  assert.deepEqual(payloads.map((payload) => byteAt(payload, 4)), [0x11, 0x13, 0x40, 0x10]);
  assert.deepEqual(payloads.map((payload) => byteAt(payload, 15)), [0xff, 0xff, 0xff, 0xff]);
});

test("echonetlite2mqtt state topics update HomeKit-facing state", () => {
  const { accessory, platform } = createPlatform();

  accessory.updateFromMqtt(platform.topics.operationStatusState, Buffer.from("true"));
  accessory.updateFromMqtt(platform.topics.airflowState, Buffer.from("auto"));
  accessory.updateFromMqtt(
    "echonetlite2mqtt/elapi/v2/devices/device-1/properties/unknown_F1",
    Buffer.from("0000001937000000000000000000000000000000000000010200000000000000000000000004"),
  );
  accessory.updateFromMqtt(
    platform.topics.humidifierState,
    Buffer.from("010100001400000000000000000000ff0000000000000000000000"),
  );

  assert.equal(platform.state.operationStatus, true);
  assert.equal(platform.state.targetAirPurifierState, platform.api.hap.Characteristic.TargetAirPurifierState.MANUAL);
  assert.equal(platform.state.rotationSpeed, 25);
  assert.equal(platform.state.temperature, 25);
  assert.equal(platform.state.humidity, 55);
  assert.equal(platform.state.operationMode, "silent");
  assert.equal(platform.state.humidifierEnabled, true);
});
