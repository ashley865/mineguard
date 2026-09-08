import { Router, Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { recordSensorReading } from "../lib/sensorReadings";
import { generateSensorApiKey } from "../lib/sensorApiKeys";
import { MIN_POLL_INTERVAL_SECONDS, parsePollConfig, SensorPollProtocolName } from "../lib/sensorPolling";
import { testPollHttpSensor } from "../services/sensorPoller";

const router = Router();

const sensorTypeEnum = z.enum([
  "METHANE",
  "CARBON_MONOXIDE",
  "OXYGEN",
  "TEMPERATURE",
  "HUMIDITY",
  "SEISMIC",
  "AIR_FLOW",
  "DUST",
  "NOISE",
  "WATER_LEVEL",
  "EQUIPMENT_CONDITION",
  "CARBON_DIOXIDE",
  "NITROGEN_OXIDES",
  "SULFUR_DIOXIDE",
  "HYDROGEN_SULFIDE",
  "RADIATION",
  "SMOKE_FIRE",
  "VIBRATION",
  "PRESSURE",
  "FLOW_RATE",
  "CONVEYOR_ALIGNMENT",
  "PROXIMITY_COLLISION",
  "GPS_LOCATION",
  "PUMP_STATUS",
  "FAN_STATUS",
  "ACCESS_CONTROL",
]);

const sensorSchema = z.object({
  name: z.string().min(1),
  type: sensorTypeEnum,
  unit: z.string().min(1),
  minSafe: z.number(),
  maxSafe: z.number(),
  status: z.enum(["ACTIVE", "INACTIVE", "FAULT"]).optional(),
  zoneId: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installationNotes: z.string().optional(),
  // Accepts IPv4, IPv6 and hostnames — a sensor reached through a DNS name or a
  // gateway alias is as common on a mine network as a static address, and rejecting
  // those would just push IT into recording them in the notes field instead.
  ipAddress: z.string().trim().max(255).optional().nullable(),
  pollEnabled: z.coerce.boolean().optional(),
  pollProtocol: z.enum(["HTTP_JSON", "MODBUS_TCP", "SNMP"]).optional().nullable(),
  pollTarget: z.string().trim().max(500).optional().nullable(),
  pollConfig: z.record(z.unknown()).optional().nullable(),
  pollIntervalSeconds: z.coerce.number().int().min(MIN_POLL_INTERVAL_SECONDS).max(86400).optional().nullable(),
  pollAgentId: z.string().optional().nullable(),
  // Registering a sensor that already physically exists skips straight to COMMISSIONED
  // (the historical one-step behaviour); requesting a not-yet-installed sensor starts the
  // REQUESTED -> SCHEDULED -> INSTALLED -> COMMISSIONED workflow instead.
  requestInstallation: z.coerce.boolean().optional(),
});

const readingSchema = z.object({
  value: z.number(),
});

const scheduleSchema = z.object({ scheduledDate: z.coerce.date() });

const sensorInclude = {
  zone: { select: { id: true, name: true, siteId: true } },
  readings: { orderBy: { recordedAt: "desc" as const }, take: 1 },
  requestedBy: { select: { id: true, name: true } },
  installedBy: { select: { id: true, name: true } },
  commissionedBy: { select: { id: true, name: true } },
} as const;

// The device key's hash never leaves the server — the client only needs to know whether a
// key has been issued, so it can show "Regenerate" rather than "Generate". Same shape as
// withHasPhoto in routes/workers.ts.
function withApiKeyFlag<T extends { apiKeyHash: string | null }>(sensor: T) {
  const { apiKeyHash, ...rest } = sensor;
  return { ...rest, hasApiKey: !!apiKeyHash };
}

// Issuing a device credential is an IT function specifically, not general sensor
// administration: whoever holds a sensor's key can post readings as that sensor, and a
// forged gas reading is a safety event. Other executives keep full day-to-day sensor
// management (adding units, thresholds, commissioning) — they just can't mint credentials.
async function requireItAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "IT_MANAGER") {
    res.status(403).json({ error: "Only IT can issue sensor device keys" });
    return false;
  }
  return true;
}

/**
 * Prisma distinguishes "leave this JSON column alone" (undefined) from "write SQL NULL"
 * (Prisma.DbNull); a plain null isn't accepted for a nullable Json field. Clearing the
 * config has to stay possible — that's how a sensor is switched between protocols.
 */
function pollConfigWrite(
  requested: Record<string, unknown> | null | undefined,
  validated: Record<string, unknown> | undefined
): { pollConfig?: Prisma.InputJsonValue | typeof Prisma.DbNull } {
  if (requested === undefined) return {};
  if (requested === null) return { pollConfig: Prisma.DbNull };
  return { pollConfig: (validated ?? requested) as Prisma.InputJsonValue };
}

/**
 * Poll settings are only coherent as a set — a protocol with no target, or a Modbus
 * register on an HTTP sensor, produces a target the collector silently can't read. So
 * they're validated together at write time rather than being discovered at poll time.
 * Returns an error message, or the normalised config to persist.
 */
async function validatePollSettings(
  data: { pollEnabled?: boolean; pollProtocol?: string | null; pollTarget?: string | null; pollConfig?: Record<string, unknown> | null; pollAgentId?: string | null },
  existing: { pollProtocol: string | null; pollTarget: string | null } | null,
  mineId: string
): Promise<{ error: string } | { pollConfig?: Record<string, unknown> }> {
  const protocol = (data.pollProtocol !== undefined ? data.pollProtocol : existing?.pollProtocol) as SensorPollProtocolName | null | undefined;
  const target = data.pollTarget !== undefined ? data.pollTarget : existing?.pollTarget;

  if (data.pollAgentId) {
    const agent = await prisma.sensorAgent.findFirst({ where: { id: data.pollAgentId, mineId } });
    if (!agent) return { error: "Sensor agent not found" };
  }

  const enabling = data.pollEnabled === true;
  if (enabling && !protocol) return { error: "A poll protocol is required to enable polling" };
  if (enabling && !target) return { error: "A poll target is required to enable polling" };

  // Modbus and SNMP are LAN protocols; this server is cloud-hosted and has no route to a
  // mine network, so an unassigned sensor using either would just accumulate failures.
  if (enabling && protocol && protocol !== "HTTP_JSON" && !data.pollAgentId) {
    return { error: "Modbus and SNMP sensors must be assigned to an on-site agent" };
  }

  if (data.pollConfig !== undefined && data.pollConfig !== null && protocol) {
    const result = parsePollConfig(protocol, data.pollConfig);
    if ("error" in result) return { error: result.error };
    return { pollConfig: result.config };
  }
  return {};
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const zoneId = req.query.zoneId as string | undefined;
  const sensors = await prisma.sensor.findMany({
    where: { zone: { site: { mineId } }, zoneId: zoneId || undefined },
    include: sensorInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(sensors.map(withApiKeyFlag));
});

// Powers the client Sensor Catalog page: how many of each sensor type are installed
// (COMMISSIONED) per site, so gaps against the full type catalog are visible at a glance.
router.get("/catalog", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const sensors = await prisma.sensor.findMany({
    where: { zone: { site: { mineId } } },
    select: { type: true, installationStatus: true, zone: { select: { siteId: true, site: { select: { id: true, name: true } } } } },
  });
  const counts: Record<string, { total: number; commissioned: number; bySite: Record<string, { siteName: string; total: number; commissioned: number }> }> = {};
  for (const s of sensors) {
    const bucket = (counts[s.type] ??= { total: 0, commissioned: 0, bySite: {} });
    bucket.total += 1;
    if (s.installationStatus === "COMMISSIONED") bucket.commissioned += 1;
    const siteBucket = (bucket.bySite[s.zone.siteId] ??= { siteName: s.zone.site.name, total: 0, commissioned: 0 });
    siteBucket.total += 1;
    if (s.installationStatus === "COMMISSIONED") siteBucket.commissioned += 1;
  }
  res.json(counts);
});

router.get("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const sensor = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  res.json(withApiKeyFlag(sensor));
});

router.get("/:id/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const sensor = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const readings = await prisma.sensorReading.findMany({
    where: { sensorId: sensor.id },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
  res.json(readings.reverse());
});

router.post("/:id/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sensor = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });

  const reading = await recordSensorReading(sensor, parsed.data.value, mineId, req.app.get("io"));
  res.status(201).json(reading);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sensorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, site: { mineId } } });
  if (!zone) return res.status(404).json({ error: "Zone not found" });

  const pollCheck = await validatePollSettings(parsed.data, null, mineId);
  if ("error" in pollCheck) return res.status(400).json({ error: pollCheck.error });

  const { requestInstallation, pollConfig, ...rest } = parsed.data;
  const data = { ...rest, ...pollConfigWrite(pollConfig, pollCheck.pollConfig) };
  const sensor = await prisma.sensor.create({
    data: requestInstallation
      ? { ...data, status: "INACTIVE", installationStatus: "REQUESTED", requestedById: req.auth!.userId, requestedAt: new Date() }
      : data,
    include: sensorInclude,
  });
  res.status(201).json(withApiKeyFlag(sensor));
});

router.post("/:id/schedule", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  const sensor = await prisma.sensor.update({
    where: { id: existing.id },
    data: { installationStatus: "SCHEDULED", scheduledDate: parsed.data.scheduledDate },
    include: sensorInclude,
  });
  res.json(withApiKeyFlag(sensor));
});

router.post("/:id/install", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  const sensor = await prisma.sensor.update({
    where: { id: existing.id },
    data: { installationStatus: "INSTALLED", installedById: req.auth!.userId, installedAt: new Date() },
    include: sensorInclude,
  });
  res.json(withApiKeyFlag(sensor));
});

router.post("/:id/commission", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  const sensor = await prisma.sensor.update({
    where: { id: existing.id },
    data: { installationStatus: "COMMISSIONED", commissionedById: req.auth!.userId, commissionedAt: new Date(), status: "ACTIVE" },
    include: sensorInclude,
  });
  res.json(withApiKeyFlag(sensor));
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sensorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, site: { mineId } } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  const pollCheck = await validatePollSettings(parsed.data, existing, mineId);
  if ("error" in pollCheck) return res.status(400).json({ error: pollCheck.error });

  const { requestInstallation, pollConfig, ...rest } = parsed.data;
  const data = { ...rest, ...pollConfigWrite(pollConfig, pollCheck.pollConfig) };
  const sensor = await prisma.sensor.update({ where: { id: existing.id }, data, include: sensorInclude });
  res.json(withApiKeyFlag(sensor));
});

/**
 * Runs the sensor's configured HTTP poll once, right now, and reports what came back.
 * Setup is otherwise a guessing game: without this, a wrong jsonPath or an unreachable
 * host only shows up as a sensor that quietly never reports.
 */
router.post("/:id/test-poll", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const sensor = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  if (!sensor.pollTarget) return res.json({ success: false, message: "No poll target configured" });
  if (sensor.pollProtocol !== "HTTP_JSON") {
    // The server has no route to a Modbus/SNMP instrument on a mine LAN, so testing one
    // from here would fail for reasons that say nothing about the sensor's configuration.
    return res.json({ success: false, message: "Only HTTP sensors can be tested from the server. Modbus and SNMP are polled by the on-site agent." });
  }
  res.json(await testPollHttpSensor(sensor.pollTarget, sensor.pollConfig));
});

// Issues (or rotates) the device key a network sensor presents when pushing its own
// readings. The plaintext key is returned exactly once, here — only its hash is stored,
// so a lost key is replaced by rotating rather than recovered. Rotating immediately
// invalidates the previous one, which is also how a compromised unit is cut off.
router.post("/:id/api-key", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });

  const { key, hash } = await generateSensorApiKey();
  await prisma.sensor.update({
    where: { id: existing.id },
    data: { apiKeyHash: hash, apiKeyIssuedAt: new Date(), apiKeyLastUsedAt: null },
  });
  res.status(201).json({ key, sensorId: existing.id });
});

router.delete("/:id/api-key", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  await prisma.sensor.update({
    where: { id: existing.id },
    data: { apiKeyHash: null, apiKeyIssuedAt: null, apiKeyLastUsedAt: null },
  });
  res.status(204).send();
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.sensor.findFirst({ where: { id: req.params.id, zone: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Sensor not found" });
  await prisma.sensor.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
