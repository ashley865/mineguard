import { z } from "zod";

/**
 * Read instructions per protocol. Kept here rather than in the route so the server-side
 * poller, the agent-facing API and the sensor CRUD route all validate the same shapes —
 * a config the UI accepts but the collector can't act on is just a sensor that silently
 * never reports.
 */
export const httpPollConfigSchema = z.object({
  // Dotted path into the JSON response, e.g. "data.value" or "readings.0.v". Omitted
  // means the response body is itself the number.
  jsonPath: z.string().trim().max(200).optional(),
});

export const modbusPollConfigSchema = z.object({
  unitId: z.coerce.number().int().min(0).max(247).default(1),
  register: z.coerce.number().int().min(0).max(65535),
  registerType: z.enum(["HOLDING", "INPUT"]).default("HOLDING"),
  // Instruments almost always report scaled integers — 234 meaning 23.4 °C — so the
  // multiplier belongs with the read instruction rather than being baked into firmware.
  scale: z.coerce.number().default(1),
  wordCount: z.coerce.number().int().min(1).max(2).default(1),
});

export const snmpPollConfigSchema = z.object({
  oid: z.string().trim().regex(/^\.?\d+(\.\d+)+$/, "Must be a numeric OID, e.g. 1.3.6.1.4.1.1.2"),
  community: z.string().trim().max(100).default("public"),
  version: z.enum(["v1", "v2c"]).default("v2c"),
  scale: z.coerce.number().default(1),
});

export type SensorPollProtocolName = "HTTP_JSON" | "MODBUS_TCP" | "SNMP";

/** Returns the parsed config, or an error message naming what's wrong with it. */
export function parsePollConfig(protocol: SensorPollProtocolName, raw: unknown): { config: Record<string, unknown> } | { error: string } {
  const schema =
    protocol === "HTTP_JSON" ? httpPollConfigSchema : protocol === "MODBUS_TCP" ? modbusPollConfigSchema : snmpPollConfigSchema;
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { error: first ? `${first.path.join(".") || "config"}: ${first.message}` : "Invalid poll configuration" };
  }
  return { config: parsed.data as Record<string, unknown> };
}

/**
 * Pulls the reading out of a JSON response. Walks a dotted path (array indices included)
 * and accepts a numeric string as well as a number, since plenty of devices quote their
 * values. Returns null rather than throwing — a malformed response is a failed poll to be
 * recorded against the sensor, not an exception to unwind the poll loop.
 */
export function extractJsonValue(body: unknown, jsonPath?: string): number | null {
  let current: unknown = body;
  if (jsonPath) {
    for (const segment of jsonPath.split(".").filter(Boolean)) {
      if (current === null || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[segment];
    }
  }
  if (typeof current === "number" && Number.isFinite(current)) return current;
  if (typeof current === "string") {
    const parsed = Number(current.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const MIN_POLL_INTERVAL_SECONDS = 10;
export const DEFAULT_POLL_INTERVAL_SECONDS = 60;
