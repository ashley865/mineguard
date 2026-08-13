import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { evaluateReading } from "../services/alertEngine";
import { requireMineId } from "../lib/mineScope";

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
  res.json(sensors);
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
  res.json(sensor);
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

  const reading = await prisma.sensorReading.create({
    data: { sensorId: sensor.id, value: parsed.data.value },
  });

  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("sensor:reading", { sensorId: sensor.id, value: reading.value, recordedAt: reading.recordedAt });

  const alert = await evaluateReading(sensor, reading.value);
  if (alert) io?.to(`mine:${mineId}`).emit("alert:new", alert);

  res.status(201).json(reading);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sensorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, site: { mineId } } });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  const { requestInstallation, ...data } = parsed.data;
  const sensor = await prisma.sensor.create({
    data: requestInstallation
      ? { ...data, status: "INACTIVE", installationStatus: "REQUESTED", requestedById: req.auth!.userId, requestedAt: new Date() }
      : data,
    include: sensorInclude,
  });
  res.status(201).json(sensor);
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
  res.json(sensor);
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
  res.json(sensor);
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
  res.json(sensor);
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
  const { requestInstallation, ...data } = parsed.data;
  const sensor = await prisma.sensor.update({ where: { id: existing.id }, data, include: sensorInclude });
  res.json(sensor);
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
