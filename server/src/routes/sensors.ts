import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { evaluateReading } from "../services/alertEngine";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const sensorSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "METHANE",
    "CARBON_MONOXIDE",
    "OXYGEN",
    "TEMPERATURE",
    "HUMIDITY",
    "SEISMIC",
    "AIR_FLOW",
  ]),
  unit: z.string().min(1),
  minSafe: z.number(),
  maxSafe: z.number(),
  status: z.enum(["ACTIVE", "INACTIVE", "FAULT"]).optional(),
  zoneId: z.string().min(1),
});

const readingSchema = z.object({
  value: z.number(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const zoneId = req.query.zoneId as string | undefined;
  const sensors = await prisma.sensor.findMany({
    where: { zone: { site: { mineId } }, zoneId: zoneId || undefined },
    include: {
      zone: { select: { id: true, name: true, siteId: true } },
      readings: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(sensors);
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
  io?.emit("sensor:reading", { sensorId: sensor.id, value: reading.value, recordedAt: reading.recordedAt });

  const alert = await evaluateReading(sensor, reading.value);
  if (alert) io?.emit("alert:new", alert);

  res.status(201).json(reading);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sensorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, site: { mineId } } });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  const sensor = await prisma.sensor.create({ data: parsed.data });
  res.status(201).json(sensor);
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
  const sensor = await prisma.sensor.update({ where: { id: existing.id }, data: parsed.data });
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
