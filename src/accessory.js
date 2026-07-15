const {
  parseHumidifierPayload,
  buildHumidifierSetPayload,
  airflowToOperationMode,
  buildOperationModeSetPayload,
} = require("./humidifier-codec");
const { parseUnknownProperties } = require("./unknown-properties-parser");

class SharpAirPurifierAccessory {
  constructor(platform) {
    this.platform = platform;
    this.api = platform.api;

    this.accessory = null;
    this.airService = null;
    this.humidityService = null;
    this.temperatureService = null;
    this.airQualityService = null;
    this.humidifierService = null;
  }

  publishAccessory() {
    const uuid = this.api.hap.uuid.generate(`sharp-air-${this.platform.deviceId}`);
    let accessory = this.platform.cachedAccessories.find((a) => a.UUID === uuid);

    if (!accessory) {
      accessory = new this.api.platformAccessory(this.platform.accessoryName, uuid);
      this.api.registerPlatformAccessories(this.platform.pluginName, this.platform.platformName, [accessory]);
    }

    accessory.displayName = this.platform.accessoryName;
    this.accessory = accessory;

    const airService = accessory.getService(this.api.hap.Service.AirPurifier)
      || accessory.addService(this.api.hap.Service.AirPurifier, "Air Purifier", "air");

    airService.getCharacteristic(this.api.hap.Characteristic.Active)
      .onSet((value) => this.setActive(value))
      .onGet(() => this.platform.state.operationStatus ? 1 : 0);

    airService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState)
      .onGet(() => this.platform.state.operationStatus ? 2 : 0);

    airService.getCharacteristic(this.api.hap.Characteristic.TargetAirPurifierState)
      .onSet((value) => this.setTargetAirPurifierState(value))
      .onGet(() => this.platform.state.targetAirPurifierState);

    airService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
      .setProps({ minStep: 1 })
      .onSet((value) => this.setRotationSpeed(value))
      .onGet(() => this.platform.state.rotationSpeed);

    let humidityService = null;
    if (this.platform.enableHumiditySensor) {
      humidityService = accessory.getService(this.api.hap.Service.HumiditySensor)
        || accessory.addService(this.api.hap.Service.HumiditySensor, "Humidity", "humidity");
      humidityService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
        .onGet(() => this.getRequiredNumber(this.platform.state.humidity));
    } else {
      this.removeServiceIfPresent(accessory.getService(this.api.hap.Service.HumiditySensor));
    }

    let temperatureService = null;
    if (this.platform.enableTemperatureSensor) {
      temperatureService = accessory.getService(this.api.hap.Service.TemperatureSensor)
        || accessory.addService(this.api.hap.Service.TemperatureSensor, "Temperature", "temperature");
      temperatureService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
        .onGet(() => this.getRequiredNumber(this.platform.state.temperature));
    } else {
      this.removeServiceIfPresent(accessory.getService(this.api.hap.Service.TemperatureSensor));
    }

    let airQualityService = null;
    if (this.platform.enableAirQualitySensor) {
      airQualityService = accessory.getService(this.api.hap.Service.AirQualitySensor)
        || accessory.addService(this.api.hap.Service.AirQualitySensor, "Air Quality", "air-quality");

      airQualityService.getCharacteristic(this.api.hap.Characteristic.AirQuality)
        .onGet(() => this.getAirQualityLevel());

      airQualityService.getCharacteristic(this.api.hap.Characteristic.PM2_5Density)
        .onGet(() => this.getRequiredNumber(this.platform.state.pm25));

      airQualityService.getCharacteristic(this.api.hap.Characteristic.PM10Density)
        .onGet(() => this.getRequiredNumber(this.platform.state.pm10));
    } else {
      this.removeServiceIfPresent(accessory.getService(this.api.hap.Service.AirQualitySensor));
    }

    let humidifierService = null;
    if (this.platform.enableHumidifierService) {
      humidifierService = accessory.getServiceById(this.api.hap.Service.HumidifierDehumidifier, "humidifier")
        || accessory.addService(this.api.hap.Service.HumidifierDehumidifier, "Humidifier", "humidifier");

      humidifierService.getCharacteristic(this.api.hap.Characteristic.Active)
        .onSet((value) => this.setHumidifierEnabled(value))
        .onGet(() => this.platform.state.humidifierEnabled ? 1 : 0);

      humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState)
        .setProps({ minValue: 0, maxValue: 2, validValues: [0, 1, 2] })
        .onGet(() => this.platform.state.humidifierEnabled ? 2 : 0);

      humidifierService.getCharacteristic(this.api.hap.Characteristic.TargetHumidifierDehumidifierState)
        .setProps({ minValue: 1, maxValue: 1, validValues: [1] })
        .onSet((value) => this.setTargetHumidifierState(value))
        .onGet(() => this.api.hap.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER);

      humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
        .onGet(() => this.getRequiredNumber(this.platform.state.humidity));
    } else {
      this.removeServiceIfPresent(accessory.getServiceById(this.api.hap.Service.HumidifierDehumidifier, "humidifier"));
    }

    this.airService = airService;
    this.humidityService = humidityService;
    this.temperatureService = temperatureService;
    this.airQualityService = airQualityService;
    this.humidifierService = humidifierService;
    this.pushStateToHomeKit();
  }

  removeServiceIfPresent(service) {
    if (service && this.accessory) {
      this.accessory.removeService(service);
    }
  }

  updateFromMqtt(topic, payload) {
    const text = payload.toString().trim().toLowerCase();
    const state = this.platform.state;
    const topics = this.platform.topics;

    if (topic === topics.operationStatusState) {
      state.operationStatus = text === "true";
    }
    if (topic === topics.airflowState) {
      state.airflow = text;
    }

    const propertyName = this.getPropertyName(topic);
    const numericValue = this.parseNumericPayload(payload);

    if (propertyName) {
      this.captureUnknownRaw(propertyName, payload.toString().trim());
      this.applyAutoDetectedSensorValue(propertyName, numericValue);
    }

    if (this.platform.enableHumidifierService && topic === topics.humidifierState) {
      state.humidifierRaw = payload.toString().trim();
      const humidifierEnabled = parseHumidifierPayload(state.humidifierRaw);
      if (humidifierEnabled !== null) {
        state.humidifierEnabled = humidifierEnabled;
      }
    }

    this.deriveAirState();
    this.pushStateToHomeKit();
  }

  captureUnknownRaw(propertyName, rawPayload) {
    const lower = propertyName.toLowerCase();
    const keyMap = {
      unknown_f1: "unknown_F1",
      unknown_f2: "unknown_F2",
      unknown_f3: "unknown_F3",
      unknown_fc: "unknown_FC",
      unknown_fd: "unknown_FD",
    };
    const key = keyMap[lower];
    if (!key) {
      return;
    }

    this.platform.state.unknownRaw[key] = rawPayload;
    const parsed = parseUnknownProperties(this.platform.state.unknownRaw, this.platform.unknownMapping);
    this.platform.state.unknownParsed = parsed;
    if (this.platform.enableTemperatureSensor && parsed.derived.temperatureC != null) {
      this.platform.state.temperature = this.clampTemperature(parsed.derived.temperatureC);
    }
    if (this.platform.enableHumiditySensor && parsed.derived.humidityPercent != null) {
      this.platform.state.humidity = this.clampHumidity(parsed.derived.humidityPercent);
    }
    this.platform.state.operationMode = parsed.derived.operationMode ?? this.platform.state.operationMode;
    this.platform.state.pciSensor = parsed.derived.pciSensor ?? this.platform.state.pciSensor;
    this.platform.state.filterUsage = parsed.derived.filterUsage ?? this.platform.state.filterUsage;
    this.platform.state.dust = parsed.derived.dust ?? this.platform.state.dust;
    this.platform.state.smell = parsed.derived.smell ?? this.platform.state.smell;
    if (parsed.derived.humidifierEnabled != null) {
      this.platform.state.humidifierEnabled = parsed.derived.humidifierEnabled;
    }
  }

  deriveAirState() {
    const targetState = this.api.hap.Characteristic.TargetAirPurifierState;
    const mode = this.platform.state.operationMode;
    if (mode === "silent") {
      this.platform.state.targetAirPurifierState = targetState.MANUAL;
      this.platform.state.rotationSpeed = 25;
      this.platform.state.airflow = "auto";
      return;
    }
    if (mode === "medium") {
      this.platform.state.targetAirPurifierState = targetState.MANUAL;
      this.platform.state.rotationSpeed = 60;
      this.platform.state.airflow = "auto";
      return;
    }
    if (mode === "high") {
      this.platform.state.targetAirPurifierState = targetState.MANUAL;
      this.platform.state.rotationSpeed = 100;
      this.platform.state.airflow = "auto";
      return;
    }
    if (mode === "auto") {
      this.platform.state.targetAirPurifierState = targetState.AUTO;
      this.platform.state.rotationSpeed = 100;
      this.platform.state.airflow = "auto";
      return;
    }

    this.platform.state.targetAirPurifierState = this.platform.state.airflow === "auto"
      ? targetState.AUTO
      : targetState.MANUAL;
  }

  setActive(value) {
    const on = Number(value) === 1;
    this.platform.state.operationStatus = on;
    this.platform.publish(this.platform.topics.operationStatusSet, on ? "true" : "false");
    this.pushStateToHomeKit();
  }

  setTargetAirPurifierState(value) {
    const targetState = this.api.hap.Characteristic.TargetAirPurifierState;
    const target = Number(value);
    this.platform.state.targetAirPurifierState = target;

    if (target === targetState.AUTO) {
      this.platform.state.airflow = "auto";
      this.publishOperationModeFromAirflow("auto");
    } else if (target === targetState.MANUAL && this.platform.state.airflow === "auto") {
      this.platform.state.airflow = "auto";
      this.publishOperationModeFromAirflow("4");
    }

    this.deriveAirState();
    this.pushStateToHomeKit();
  }

  setRotationSpeed(value) {
    const targetState = this.api.hap.Characteristic.TargetAirPurifierState;
    const speed = Number(value);
    this.platform.state.rotationSpeed = speed;

    let airflowValue = "8";
    if (speed <= 33) {
      airflowValue = "1";
    } else if (speed <= 75) {
      airflowValue = "4";
    }

    this.platform.state.airflow = "auto";
    this.platform.state.targetAirPurifierState = targetState.MANUAL;

    this.publishOperationModeFromAirflow(airflowValue);
    this.pushStateToHomeKit();
  }

  publishOperationModeFromAirflow(airflowValue) {
    const mode = airflowToOperationMode(airflowValue);
    if (!mode) {
      return;
    }

    const payload = buildOperationModeSetPayload({
      mode,
      lastRaw: this.platform.state.unknownRaw.unknown_F3 || this.platform.state.humidifierRaw,
      humidifierEnabled: this.platform.state.humidifierEnabled,
    });
    if (!payload) {
      return;
    }

    this.platform.state.operationMode = mode;
    this.platform.publish(this.platform.topics.humidifierSet, payload);
  }

  setHumidifierEnabled(value) {
    const on = Number(value) === this.api.hap.Characteristic.Active.ACTIVE || value === true;
    this.platform.state.humidifierEnabled = on;

    const payload = buildHumidifierSetPayload({
      on,
      lastRaw: this.platform.state.humidifierRaw,
      operationMode: this.platform.state.operationMode,
    });

    this.platform.publish(this.platform.topics.humidifierSet, payload);
    this.pushStateToHomeKit();
  }

  getPropertyName(topic) {
    const marker = "/properties/";
    const idx = topic.indexOf(marker);
    if (idx < 0) {
      return null;
    }

    const rawName = topic.slice(idx + marker.length);
    if (!rawName || rawName.endsWith("/set") || rawName.endsWith("/request")) {
      return null;
    }
    return rawName.toLowerCase();
  }

  parseNumericPayload(payload) {
    const raw = payload.toString().trim();
    const direct = Number.parseFloat(raw);
    if (!Number.isNaN(direct)) {
      return direct;
    }

    try {
      const obj = JSON.parse(raw);
      const queue = [obj];
      while (queue.length > 0) {
        const value = queue.shift();
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === "string") {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        if (value && typeof value === "object") {
          for (const v of Object.values(value)) {
            queue.push(v);
          }
        }
      }
    } catch (err) {
      return null;
    }

    return null;
  }

  normalizePropertyName(name) {
    return name.replace(/[^a-z0-9]/g, "");
  }

  applyAutoDetectedSensorValue(propertyName, numericValue) {
    if (numericValue == null) {
      return;
    }

    const key = this.normalizePropertyName(propertyName);

    if (this.platform.enableHumiditySensor) {
      const humidityKeys = ["relativehumidity", "humidity", "currenthumidity", "measuredrelativehumidity"];
      if (humidityKeys.includes(key)) {
        this.platform.state.humidity = this.clampHumidity(numericValue);
        return;
      }
    }
  }

  clampHumidity(value) {
    if (value == null || Number.isNaN(value)) {
      return this.platform.state.humidity;
    }
    return Math.max(0, Math.min(100, value));
  }

  clampTemperature(value) {
    if (value == null || Number.isNaN(value)) {
      return this.platform.state.temperature;
    }
    return Math.max(-40, Math.min(100, value));
  }

  clampParticle(value) {
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    return Math.max(0, value);
  }

  getRequiredNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  getAirQualityLevel() {
    const pm25 = this.platform.state.pm25;
    const C = this.api.hap.Characteristic;
    if (typeof pm25 !== "number" || !Number.isFinite(pm25)) {
      return C.AirQuality.UNKNOWN;
    }
    if (pm25 <= 12) {
      return C.AirQuality.EXCELLENT;
    }
    if (pm25 <= 35.4) {
      return C.AirQuality.GOOD;
    }
    if (pm25 <= 55.4) {
      return C.AirQuality.FAIR;
    }
    if (pm25 <= 150.4) {
      return C.AirQuality.INFERIOR;
    }
    return C.AirQuality.POOR;
  }

  setTargetHumidifierState(value) {
    const target = Number(value);
    const C = this.api.hap.Characteristic.TargetHumidifierDehumidifierState;
    if (target !== C.HUMIDIFIER) {
      this.platform.log.warn("Only HUMIDIFIER mode is supported; forcing HUMIDIFIER");
    }
    this.pushStateToHomeKit();
  }

  pushStateToHomeKit() {
    if (!this.airService) {
      return;
    }

    const C = this.api.hap.Characteristic;

    this.airService.updateCharacteristic(C.Active, this.platform.state.operationStatus ? 1 : 0);
    this.airService.updateCharacteristic(C.CurrentAirPurifierState, this.platform.state.operationStatus ? 2 : 0);
    this.airService.updateCharacteristic(C.TargetAirPurifierState, this.platform.state.targetAirPurifierState);
    this.airService.updateCharacteristic(C.RotationSpeed, this.platform.state.rotationSpeed);

    if (this.humidityService) {
      if (typeof this.platform.state.humidity === "number" && Number.isFinite(this.platform.state.humidity)) {
        this.humidityService.updateCharacteristic(C.CurrentRelativeHumidity, this.platform.state.humidity);
      }
    }

    if (this.temperatureService) {
      if (typeof this.platform.state.temperature === "number" && Number.isFinite(this.platform.state.temperature)) {
        this.temperatureService.updateCharacteristic(C.CurrentTemperature, this.platform.state.temperature);
      }
    }

    if (this.airQualityService) {
      this.airQualityService.updateCharacteristic(C.AirQuality, this.getAirQualityLevel());
      if (typeof this.platform.state.pm25 === "number" && Number.isFinite(this.platform.state.pm25)) {
        this.airQualityService.updateCharacteristic(C.PM2_5Density, this.platform.state.pm25);
      }
      if (typeof this.platform.state.pm10 === "number" && Number.isFinite(this.platform.state.pm10)) {
        this.airQualityService.updateCharacteristic(C.PM10Density, this.platform.state.pm10);
      }
    }

    if (this.humidifierService) {
      this.humidifierService.updateCharacteristic(C.Active, this.platform.state.humidifierEnabled ? C.Active.ACTIVE : C.Active.INACTIVE);
      this.humidifierService.updateCharacteristic(
        C.CurrentHumidifierDehumidifierState,
        this.platform.state.humidifierEnabled
          ? C.CurrentHumidifierDehumidifierState.HUMIDIFYING
          : C.CurrentHumidifierDehumidifierState.INACTIVE,
      );
      this.humidifierService.updateCharacteristic(
        C.TargetHumidifierDehumidifierState,
        C.TargetHumidifierDehumidifierState.HUMIDIFIER,
      );
      if (typeof this.platform.state.humidity === "number" && Number.isFinite(this.platform.state.humidity)) {
        this.humidifierService.updateCharacteristic(C.CurrentRelativeHumidity, this.platform.state.humidity);
      }
    }
  }
}

module.exports = {
  SharpAirPurifierAccessory,
};
