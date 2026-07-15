const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeHex,
  parseUnknownProperties,
} = require("../src/unknown-properties-parser");

test("normalizes unknown property hex", () => {
  assert.equal(normalizeHex("0x01 02 0A"), "01020a");
  assert.equal(normalizeHex("xyz"), null);
});

test("derives temperature and humidity from unknown_F1", () => {
  const parsed = parseUnknownProperties({
    unknown_F1: "0000001937000000000000000000000000000000000000010200000000000000000000000004",
  });

  assert.equal(parsed.derived.temperatureC, 25);
  assert.equal(parsed.derived.humidityPercent, 55);
});

test("derives operation mode and humidifier state from unknown_F3", () => {
  const parsed = parseUnknownProperties({
    unknown_F3: "010100001400000000000000000000ff0000000000000000000000",
  });

  assert.equal(parsed.derived.operationMode, "silent");
  assert.equal(parsed.derived.humidifierEnabled, true);
});
