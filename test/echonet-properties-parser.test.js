const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeHex,
  parseEchonetProperties,
} = require("../src/echonet-properties-parser");

test("normalizes unknown property hex", () => {
  assert.equal(normalizeHex("0x01 02 0A"), "01020a");
  assert.equal(normalizeHex("xyz"), null);
});

test("derives temperature and humidity from unknown_F1", () => {
  const parsed = parseEchonetProperties({
    unknown_F1: "0000001937000000000000000000000000000000000000010200000000000000000000000004",
  });

  assert.equal(parsed.derived.temperatureC, 25);
  assert.equal(parsed.derived.humidityPercent, 55);
  assert.equal(parsed.derived.pm25, 0);
});

test("derives PM2.5 from Sharp unknown_F1 byte 28", () => {
  const parsed = parseEchonetProperties({
    unknown_F1: "6201011f3b060000f00000001e30c23c4f000002d000332df00000000307d407d400000043430082",
  });

  assert.equal(parsed.derived.temperatureC, 31);
  assert.equal(parsed.derived.humidityPercent, 59);
  assert.equal(parsed.derived.pm25, 3);
});

test("derives operation mode and humidifier state from unknown_F3", () => {
  const parsed = parseEchonetProperties({
    unknown_F3: "010100001400000000000000000000ff0000000000000000000000",
  });

  assert.equal(parsed.derived.operationMode, "silent");
  assert.equal(parsed.derived.humidifierEnabled, true);
});

test("derives F2 water, light, filter, and humidifier idle state", () => {
  const parsed = parseEchonetProperties({
    unknown_F2: "20000000000000000000000000000000000002ff0005000180ff0013010200000000000000000000",
  });
  const f2 = parsed.properties.unknown_F2.mapped;

  assert.equal(f2.waterTankSignalByte, 0xff);
  assert.equal(f2.waterTankSignal, "ok");
  assert.equal(f2.roomLightByte, 0x00);
  assert.equal(f2.roomLightOn, false);
  assert.equal(f2.filterStateByte, 0x01);
  assert.equal(f2.filterNeedsCleaning, true);
  assert.equal(f2.humidifierF2Byte, 0x80);
  assert.equal(f2.humidifierState, "idle");
  assert.equal(f2.humidifierEnabled, true);
  assert.equal(f2.humidifierActive, false);
  assert.equal(f2.humidifierNoWater, false);
  assert.equal(parsed.derived.humidifierState, "idle");
});

test("derives F2 humidifying and no-water states", () => {
  const humidifying = parseEchonetProperties({
    unknown_F2: "20000000000000000000000000000000000002ff0000000081ff0013010200000000000000000000",
  });
  assert.equal(humidifying.derived.humidifierEnabled, true);
  assert.equal(humidifying.derived.humidifierActive, true);
  assert.equal(humidifying.derived.humidifierNoWater, false);
  assert.equal(humidifying.derived.humidifierState, "humidifying");

  const noWater = parseEchonetProperties({
    unknown_F2: "20000000000000000000000000000000000002000000000082ff0013010200000000000000000000",
  });
  assert.equal(noWater.derived.waterTankSignal, "low");
  assert.equal(noWater.derived.humidifierEnabled, true);
  assert.equal(noWater.derived.humidifierActive, false);
  assert.equal(noWater.derived.humidifierNoWater, true);
  assert.equal(noWater.derived.humidifierState, "no_water");

  const unknownErrorBit = parseEchonetProperties({
    unknown_F2: "20000000000000000000000000000000000002000000000083ff0013010200000000000000000000",
  });
  assert.equal(unknownErrorBit.derived.humidifierNoWater, false);
  assert.equal(unknownErrorBit.derived.humidifierState, "humidifying");
});
