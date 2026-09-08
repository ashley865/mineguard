#!/usr/bin/env node
"use strict";

/**
 * MineGuard on-site sensor agent.
 *
 * Runs on a machine inside the mine network and does the pulling that the cloud-hosted API
 * cannot: it asks MineGuard which sensors it owns, reads each one locally over HTTP, Modbus
 * TCP or SNMP, and pushes the values back. All traffic is outbound from the mine, so no
 * inbound firewall rule, port forward or VPN is needed.
 *
 * Configuration is entirely in MineGuard — this process only needs to know where the API is
 * and its own agent key. Sensors are added, re-addressed and retired from the Cyber Command
 * Center without touching this machine.
 *
 * Usage:
 *   MINEGUARD_API_URL=https://your-api.onrender.com \
 *   MINEGUARD_AGENT_KEY=mga_... \
 *   node index.js
 */

const AGENT_VERSION = "1.0.0";

const API_URL = (process.env.MINEGUARD_API_URL || "").replace(/\/+$/, "");
const AGENT_KEY = process.env.MINEGUARD_AGENT_KEY || "";
// How often to re-ask MineGuard for the target list, so a sensor added in the UI starts
// being collected without restarting this process.
const REFRESH_TARGETS_MS = Number(process.env.MINEGUARD_REFRESH_SECONDS || 300) * 1000;
// The agent's own heartbeat. Each target still honours its own interval; this is just how
// often the agent wakes up to see which are due.
const TICK_MS = Number(process.env.MINEGUARD_TICK_SECONDS || 10) * 1000;
const READ_TIMEOUT_MS = Number(process.env.MINEGUARD_READ_TIMEOUT_SECONDS || 8) * 1000;

if (!API_URL || !AGENT_KEY) {
  console.error("MINEGUARD_API_URL and MINEGUARD_AGENT_KEY must both be set. See README.md.");
  process.exit(1);
}

let targets = [];
let lastPolledAt = new Map();

function log(level, message, extra) {
  const line = `[${new Date().toISOString()}] ${level} ${message}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "X-Agent-Api-Key": AGENT_KEY,
        "X-Agent-Version": AGENT_VERSION,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshTargets() {
  const res = await apiFetch("/api/sensor-agent/targets");
  if (res.status === 401) throw new Error("Agent key was rejected. Check MINEGUARD_AGENT_KEY, or reissue the key in MineGuard.");
  if (!res.ok) throw new Error(`Could not fetch targets: HTTP ${res.status}`);
  const body = await res.json();
  targets = body.targets || [];
  log("INFO", `Collecting ${targets.length} sensor(s) as agent "${body.agent?.name ?? "unknown"}"`);
}

// --- Protocol readers -------------------------------------------------------
// Each returns a number, or throws an Error whose message is reported back to MineGuard
// and shown against that sensor. The message is the only diagnostic whoever is setting the
// unit up will see, so it should say what actually failed.

function valueFromJson(body, jsonPath) {
  let current = body;
  if (jsonPath) {
    for (const segment of String(jsonPath).split(".").filter(Boolean)) {
      if (current === null || typeof current !== "object") return null;
      current = current[segment];
    }
  }
  if (typeof current === "number" && Number.isFinite(current)) return current;
  if (typeof current === "string") {
    const parsed = Number(current.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function readHttp(target, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetch(target, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`Sensor responded with HTTP ${res.status}`);
    const body = await res.json().catch(() => null);
    const value = valueFromJson(body, config.jsonPath);
    if (value === null) {
      throw new Error(config.jsonPath ? `No numeric value at "${config.jsonPath}"` : "Response was not a number");
    }
    return value;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function readModbus(target, config) {
  const ModbusRTU = require("modbus-serial");
  const [host, portRaw] = String(target).split(":");
  const port = Number(portRaw || 502);
  const client = new ModbusRTU();
  client.setTimeout(READ_TIMEOUT_MS);

  try {
    await client.connectTCP(host, { port });
    client.setID(config.unitId ?? 1);
    const count = config.wordCount ?? 1;
    const address = config.register;
    const read = (config.registerType ?? "HOLDING") === "INPUT"
      ? await client.readInputRegisters(address, count)
      : await client.readHoldingRegisters(address, count);

    const registers = read.data || [];
    if (registers.length === 0) throw new Error(`No data returned from register ${address}`);
    // Two-word reads are a 32-bit value split across consecutive registers, high word
    // first — the common convention for instruments that need more range than 16 bits.
    const raw = count === 2 ? (registers[0] << 16) + registers[1] : registers[0];
    return raw * (config.scale ?? 1);
  } finally {
    try {
      client.close();
    } catch {
      // Closing a socket that never opened is not itself a failure worth reporting.
    }
  }
}

function readSnmp(target, config) {
  const snmp = require("net-snmp");
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(target, config.community ?? "public", {
      version: (config.version ?? "v2c") === "v1" ? snmp.Version1 : snmp.Version2c,
      timeout: READ_TIMEOUT_MS,
    });

    const oid = String(config.oid).replace(/^\./, "");
    session.get([oid], (error, varbinds) => {
      try {
        if (error) return reject(new Error(error.message || "SNMP request failed"));
        const vb = varbinds && varbinds[0];
        if (!vb) return reject(new Error("SNMP returned no value"));
        if (snmp.isVarbindError(vb)) return reject(new Error(snmp.varbindError(vb)));
        const parsed = Number(vb.value);
        if (!Number.isFinite(parsed)) return reject(new Error(`OID ${oid} did not return a number`));
        resolve(parsed * (config.scale ?? 1));
      } finally {
        session.close();
      }
    });
  });
}

async function readTarget(target) {
  const config = target.config || {};
  switch (target.protocol) {
    case "HTTP_JSON":
      return readHttp(target.target, config);
    case "MODBUS_TCP":
      return readModbus(target.target, config);
    case "SNMP":
      return readSnmp(target.target, config);
    default:
      throw new Error(`Unsupported protocol "${target.protocol}"`);
  }
}

// --- Main loop --------------------------------------------------------------

function isDue(target) {
  const last = lastPolledAt.get(target.sensorId);
  if (!last) return true;
  return Date.now() - last >= (target.intervalSeconds || 60) * 1000;
}

async function tick() {
  const due = targets.filter(isDue);
  if (due.length === 0) return;

  // Read everything due in parallel: one unresponsive instrument shouldn't hold up the
  // rest until its timeout expires. Failures are reported alongside successes so a dead
  // sensor is visibly dead in MineGuard rather than merely quiet.
  const readings = await Promise.all(
    due.map(async (target) => {
      lastPolledAt.set(target.sensorId, Date.now());
      try {
        const value = await readTarget(target);
        return { sensorId: target.sensorId, value };
      } catch (err) {
        log("WARN", `${target.name}: ${err.message}`);
        return { sensorId: target.sensorId, error: String(err.message).slice(0, 500) };
      }
    })
  );

  const res = await apiFetch("/api/sensor-agent/readings", { method: "POST", body: JSON.stringify({ readings }) });
  if (!res.ok) {
    log("ERROR", `Pushing readings failed: HTTP ${res.status}`);
    return;
  }
  const body = await res.json().catch(() => ({}));
  if (body.rejected && body.rejected.length > 0) {
    log("WARN", `MineGuard rejected ${body.rejected.length} reading(s) for sensors this agent does not own`, body.rejected);
  }
  log("INFO", `Pushed ${readings.length} reading(s), ${body.accepted ?? 0} accepted`);
}

async function main() {
  log("INFO", `MineGuard sensor agent ${AGENT_VERSION} starting against ${API_URL}`);
  await refreshTargets();

  setInterval(() => {
    refreshTargets().catch((err) => log("ERROR", `Refreshing targets failed: ${err.message}`));
  }, REFRESH_TARGETS_MS);

  let running = false;
  setInterval(async () => {
    // A slow batch must not overlap the next tick and double up requests to the same
    // instruments — some serial-backed Modbus gateways will simply drop the second.
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      log("ERROR", `Poll cycle failed: ${err.message}`);
    } finally {
      running = false;
    }
  }, TICK_MS);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
