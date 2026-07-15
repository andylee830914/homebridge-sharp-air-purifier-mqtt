function normalizeHexPayload(rawPayload) {
  if (!rawPayload) {
    return null;
  }

  let text = String(rawPayload).trim().toLowerCase();
  if (text.startsWith("0x")) {
    text = text.slice(2);
  }
  text = text.replace(/\s+/g, "");

  if (!/^[0-9a-f]+$/.test(text) || text.length % 2 !== 0) {
    return null;
  }

  return text;
}

function parseHumidifierPayload(rawPayload) {
  if (!rawPayload) {
    return null;
  }

  const text = String(rawPayload).trim().toLowerCase();
  if (["true", "on", "1"].includes(text)) {
    return true;
  }
  if (["false", "off", "0"].includes(text)) {
    return false;
  }

  const hexPayload = normalizeHexPayload(rawPayload);
  if (hexPayload && hexPayload.length >= 32) {
    const bytes = Buffer.from(hexPayload, "hex");
    return bytes[15] === 0xff;
  }

  return null;
}

function buildTemplateF3Payload({ modeByte, humidifierOn }) {
  const bytes = Buffer.from("010100000000000000000000000000000000000000000000000000", "hex");
  bytes[4] = modeByte;
  bytes[15] = humidifierOn ? 0xff : 0x00;
  bytes[26] = 0xf0;
  return bytes.toString("hex");
}

function humidifierByteFromRawPayload(rawPayload) {
  const hexPayload = normalizeHexPayload(rawPayload);
  if (!hexPayload || hexPayload.length < 32) {
    return null;
  }
  return Buffer.from(hexPayload, "hex")[15];
}

function modeNameToByte(modeName) {
  if (!modeName) {
    return null;
  }
  return OPERATION_MODE_TO_BYTE[modeName] ?? null;
}

function modeByteFromRawPayload(rawPayload) {
  const hexPayload = normalizeHexPayload(rawPayload);
  if (!hexPayload || hexPayload.length < 10) {
    return null;
  }
  return Buffer.from(hexPayload, "hex")[4];
}

function buildHumidifierSetPayload({ on, lastRaw, operationMode }) {
  return buildHumidifierTemplatePayload(on);
}

function buildHumidifierTemplatePayload(on) {
  const bytes = Buffer.from("000900000000000000000000000000000000000000000000000000", "hex");
  bytes[15] = on ? 0xff : 0x00;
  return bytes.toString("hex");
}

const AIRFLOW_TO_OPERATION_MODE = {
  auto: "auto",
  "1": "silent",
  "4": "medium",
  "8": "high",
};

const OPERATION_MODE_TO_BYTE = {
  auto: 0x10,
  night: 0x11,
  pollen: 0x13,
  silent: 0x14,
  medium: 0x15,
  high: 0x16,
  ai_auto: 0x20,
  realize: 0x40,
};

function airflowToOperationMode(airflow) {
  const key = String(airflow).trim().toLowerCase();
  return AIRFLOW_TO_OPERATION_MODE[key] || null;
}

function buildOperationModeSetPayload({ mode, lastRaw, humidifierEnabled }) {
  if (!mode) {
    return null;
  }

  const modeByte = modeNameToByte(mode);
  if (modeByte == null) {
    return null;
  }

  const humidifierByte = humidifierByteFromRawPayload(lastRaw);
  return buildTemplateF3Payload({
    modeByte,
    humidifierOn: typeof humidifierEnabled === "boolean"
      ? humidifierEnabled
      : humidifierByte === 0xff,
  });
}

module.exports = {
  normalizeHexPayload,
  parseHumidifierPayload,
  buildHumidifierSetPayload,
  buildHumidifierTemplatePayload,
  airflowToOperationMode,
  buildOperationModeSetPayload,
};
