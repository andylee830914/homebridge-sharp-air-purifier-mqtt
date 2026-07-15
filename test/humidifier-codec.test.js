const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeHexPayload,
  parseHumidifierPayload,
  buildHumidifierSetPayload,
  buildHumidifierTemplatePayload,
  airflowToOperationMode,
  buildOperationModeSetPayload,
} = require("../src/humidifier-codec");

test("normalizes hex payloads", () => {
  assert.equal(normalizeHexPayload("0x01 0A ff"), "010aff");
  assert.equal(normalizeHexPayload("010"), null);
  assert.equal(normalizeHexPayload("not-hex"), null);
});

test("parses boolean-like humidifier payloads", () => {
  assert.equal(parseHumidifierPayload("true"), true);
  assert.equal(parseHumidifierPayload("ON"), true);
  assert.equal(parseHumidifierPayload("0"), false);
  assert.equal(parseHumidifierPayload("off"), false);
});

test("parses F3 humidifier state from byte 15", () => {
  assert.equal(parseHumidifierPayload("010100001300000000000000000000ff0000000000000000000000"), true);
  assert.equal(parseHumidifierPayload("010100001300000000000000000000000000000000000000000000"), false);
});

test("builds COCORO Air humidifier command payloads", () => {
  assert.equal(
    buildHumidifierTemplatePayload(false),
    "000900000000000000000000000000000000000000000000000000",
  );
  assert.equal(
    buildHumidifierTemplatePayload(true),
    "000900000000000000000000000000ff0000000000000000000000",
  );
});

test("builds humidifier payload using verified 0009 command family", () => {
  const payload = buildHumidifierSetPayload({
    on: true,
    lastRaw: "00000000150000000000000000aa000000000000000000000000f0",
  });

  assert.equal(payload.slice(0, 8), "00090000");
  assert.equal(payload.slice(30, 32), "ff");
});

test("maps airflow levels to operation modes", () => {
  assert.equal(airflowToOperationMode("auto"), "auto");
  assert.equal(airflowToOperationMode("1"), "silent");
  assert.equal(airflowToOperationMode("4"), "medium");
  assert.equal(airflowToOperationMode("8"), "high");
  assert.equal(airflowToOperationMode("2"), null);
});

test("builds operation mode payload while preserving humidifier state", () => {
  const payload = buildOperationModeSetPayload({
    mode: "high",
    lastRaw: "00000000101400000000000000ff00ff00000000000000000000f0",
  });

  assert.equal(payload.slice(8, 10), "16");
  assert.equal(payload.slice(30, 32), "ff");
  assert.equal(payload.slice(0, 8), "01010000");
  assert.equal(payload.slice(10, 12), "00");
});
