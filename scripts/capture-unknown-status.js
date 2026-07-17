#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { parseEchonetProperties } = require("../src/echonet-properties-parser");

const host = process.env.ECHONET_API || "http://192.168.0.103:3000";
const deviceId = process.env.ECHONET_DEVICE_ID || "fe0000050000000000a4ae12fffe54764b_013501";
const intervalMs = Number(process.env.CAPTURE_INTERVAL_MS || 5000);
const durationMs = Number(process.env.CAPTURE_DURATION_MS || 10 * 60 * 1000);
const outPath = path.resolve(process.env.CAPTURE_OUT || "docs/unknown-f-status-log.md");

const unknownProps = ["unknown_F0", "unknown_F1", "unknown_F2", "unknown_F3", "unknown_FC", "unknown_FD"];

async function requestUnknownProperties() {
  const body = Object.fromEntries(unknownProps.map((name) => [name, ""]));
  await fetch(`${host}/elapi/v1/devices/${deviceId}/properties/request`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readDevice() {
  const res = await fetch(`${host}/elapi/v1/devices/${deviceId}`);
  if (!res.ok) {
    throw new Error(`GET device failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function getUnknownValues(device) {
  const values = device.values || {};
  const propertyValues = device.propertyValues || {};
  return Object.fromEntries(unknownProps.map((name) => {
    const entry = values[name] || {};
    return [name, {
      value: entry.value ?? propertyValues[name] ?? null,
      updated: entry.updated ?? null,
    }];
  }));
}

function appendSnapshot(label, snapshot) {
  const rawMap = {
    unknown_F1: snapshot.unknown_F1.value,
    unknown_F2: snapshot.unknown_F2.value,
    unknown_F3: snapshot.unknown_F3.value,
    unknown_FC: snapshot.unknown_FC.value,
    unknown_FD: snapshot.unknown_FD.value,
  };
  const parsed = parseEchonetProperties(rawMap);
  const now = new Date().toISOString();

  const lines = [
    "",
    `## ${label} - ${now}`,
    "",
    "| Property | Updated UTC | Hex |",
    "| --- | --- | --- |",
    ...unknownProps.map((name) => `| ${name} | ${snapshot[name].updated || ""} | \`${snapshot[name].value || ""}\` |`),
    "",
    "Parsed summary:",
    "",
    "```json",
    JSON.stringify(parsed.derived, null, 2),
    "```",
    "",
    "Focused bytes:",
    "",
    "```json",
    JSON.stringify({
      unknown_F1_first8: parsed.properties.unknown_F1.bytes?.slice(0, 8) ?? null,
      unknown_F2_aroundHumidifierFlag: parsed.properties.unknown_F2.bytes?.slice(20, 28) ?? null,
      unknown_F3_allBytes: parsed.properties.unknown_F3.bytes ?? null,
      unknown_FC_bytes: parsed.properties.unknown_FC.bytes ?? null,
      unknown_FD_first8: parsed.properties.unknown_FD.bytes?.slice(0, 8) ?? null,
    }, null, 2),
    "```",
  ];

  fs.appendFileSync(outPath, `${lines.join("\n")}\n`);
}

function signature(snapshot) {
  return unknownProps.map((name) => `${name}:${snapshot[name].value}`).join("|");
}

async function main() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let previous = "";
  const start = Date.now();

  while (Date.now() - start <= durationMs) {
    await requestUnknownProperties();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const device = await readDevice();
    const snapshot = getUnknownValues(device);
    const next = signature(snapshot);

    if (next !== previous) {
      appendSnapshot(previous ? "Changed snapshot" : "Initial snapshot", snapshot);
      previous = next;
      console.log(`Captured ${new Date().toISOString()}`);
    } else {
      console.log(`No change ${new Date().toISOString()}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
