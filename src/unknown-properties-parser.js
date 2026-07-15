function normalizeHex(raw) {
  if (!raw) {
    return null;
  }

  let text = String(raw).trim().toLowerCase();
  if (text.startsWith("0x")) {
    text = text.slice(2);
  }
  text = text.replace(/\s+/g, "");

  if (!/^[0-9a-f]+$/.test(text) || text.length % 2 !== 0) {
    return null;
  }
  return text;
}

function toBytes(raw) {
  const hex = normalizeHex(raw);
  if (!hex) {
    return null;
  }
  return Buffer.from(hex, "hex");
}

function u16be(bytes, index) {
  if (!bytes || index + 1 >= bytes.length) {
    return null;
  }
  return (bytes[index] << 8) | bytes[index + 1];
}

function getByte(bytes, index) {
  if (!bytes || index < 0 || index >= bytes.length) {
    return null;
  }
  return bytes[index];
}

function summarize(raw) {
  const bytes = toBytes(raw);
  if (!bytes) {
    return { valid: false, raw: raw ?? null };
  }
  return {
    valid: true,
    raw: normalizeHex(raw),
    length: bytes.length,
    bytes: [...bytes],
  };
}

function parseF1(raw, mapping) {
  const base = summarize(raw);
  if (!base.valid) {
    return base;
  }

  const bytes = Buffer.from(base.bytes);

  return {
    ...base,
    mapped: {
      temperatureC: bytes.length >= 5 ? bytes.readInt8(3) : null,
      humidityPercent: bytes.length >= 5 ? bytes[4] : null,
      pciSensor: bytes.length >= 17 ? u16be(bytes, 15) : null,
      filterUsage: bytes.length >= 25
        ? ((bytes[21] << 24) | (bytes[22] << 16) | (bytes[23] << 8) | bytes[24]) >>> 0
        : null,
      pm25: bytes.length >= 29 ? bytes[28] : null,
      dust: bytes.length >= 31 ? u16be(bytes, 29) : null,
      smell: bytes.length >= 33 ? u16be(bytes, 31) : null,
      humidityFilter: bytes.length >= 37 ? u16be(bytes, 35) : null,
      lightSensor: bytes.length >= 38 ? bytes[37] : null,
      u16beWords: Array.from({ length: Math.floor(bytes.length / 2) }, (_, i) => u16be(bytes, i * 2)),
      keyBytes: {
        b12: getByte(bytes, 12),
        b13: getByte(bytes, 13),
        b14: getByte(bytes, 14),
        b15: getByte(bytes, 15),
      },
      confidence: "cocoro-aligned",
      source: "unknown_F1",
    },
  };
}

const OPERATION_MODES = {
  0x10: "auto",
  0x11: "night",
  0x13: "pollen",
  0x14: "silent",
  0x15: "medium",
  0x16: "high",
  0x20: "ai_auto",
  0x40: "realize",
};

function parseF2(raw, mapping) {
  const base = summarize(raw);
  if (!base.valid) {
    return base;
  }

  const bytes = Buffer.from(base.bytes);
  const humidifierMode = getByte(bytes, mapping.humidifierF2Index);

  return {
    ...base,
    mapped: {
      humidifierF2Flag: humidifierMode,
      humidifierEnabled: humidifierMode == null ? null : (humidifierMode & 0x80) === 0x80,
      confidence: "empirical",
      source: "unknown_F2",
      indexes: {
        humidifierF2Index: mapping.humidifierF2Index,
      },
    },
  };
}

function parseF3(raw, mapping) {
  const base = summarize(raw);
  if (!base.valid) {
    return base;
  }

  const bytes = Buffer.from(base.bytes);
  const humidifierByte = getByte(bytes, mapping.humidifierF3Index);
  const modeByte = getByte(bytes, mapping.airModeIndexF3);

  return {
    ...base,
    mapped: {
      humidifierF3Byte: humidifierByte,
      humidifierEnabled: humidifierByte == null ? null : humidifierByte === 0xff,
      airModeByte: modeByte,
      operationMode: modeByte == null ? null : (OPERATION_MODES[modeByte] ?? `0x${modeByte.toString(16).padStart(2, "0")}`),
      confidence: "cocoro-aligned+empirical",
      source: "unknown_F3",
      indexes: {
        humidifierF3Index: mapping.humidifierF3Index,
        airModeIndexF3: mapping.airModeIndexF3,
      },
    },
  };
}

function parseFC(raw) {
  const base = summarize(raw);
  if (!base.valid) {
    return base;
  }

  const bytes = Buffer.from(base.bytes);
  const u24 = bytes.length >= 3 ? ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) : null;

  return {
    ...base,
    mapped: {
      rawU24: u24,
      leadingU16BE: u16be(bytes, 0),
      trailingU16BE: u16be(bytes, 1),
      confidence: "unknown",
      source: "unknown_FC",
    },
  };
}

function parseFD(raw) {
  const base = summarize(raw);
  if (!base.valid) {
    return base;
  }

  const bytes = Buffer.from(base.bytes);
  const words = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    words.push(u16be(bytes, i));
  }

  return {
    ...base,
    mapped: {
      u16beWords: words,
      confidence: "unknown",
      source: "unknown_FD",
    },
  };
}

function parseUnknownProperties(rawMap, mappingOverrides = {}) {
  const mapping = {
    humidifierF3Index: 15,
    humidifierF2Index: 24,
    airModeIndexF3: 4,
    ...mappingOverrides,
  };

  const f1 = parseF1(rawMap.unknown_F1, mapping);
  const f2 = parseF2(rawMap.unknown_F2, mapping);
  const f3 = parseF3(rawMap.unknown_F3, mapping);
  const fc = parseFC(rawMap.unknown_FC);
  const fd = parseFD(rawMap.unknown_FD);

  return {
    mapping,
    properties: {
      unknown_F1: f1,
      unknown_F2: f2,
      unknown_F3: f3,
      unknown_FC: fc,
      unknown_FD: fd,
    },
    derived: {
      temperatureC: f1.mapped?.temperatureC ?? null,
      humidityPercent: f1.mapped?.humidityPercent ?? null,
      dust: f1.mapped?.dust ?? null,
      pm25: f1.mapped?.pm25 ?? null,
      smell: f1.mapped?.smell ?? null,
      pciSensor: f1.mapped?.pciSensor ?? null,
      filterUsage: f1.mapped?.filterUsage ?? null,
      operationMode: f3.mapped?.operationMode ?? null,
      humidifierEnabled: f3.mapped?.humidifierEnabled ?? f2.mapped?.humidifierEnabled ?? null,
    },
  };
}

module.exports = {
  normalizeHex,
  toBytes,
  parseUnknownProperties,
};
