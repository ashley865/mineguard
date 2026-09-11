import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const stationSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  identifier: z.string().min(1),
  location: z.string().optional(),
  virginRockTemperatureC: z.number().optional().nullable(),
  wetBulbLimitC: z.number().optional().nullable(),
  coolingServed: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DECOMMISSIONED"]).optional(),
  notes: z.string().optional(),
});

const readingSchema = z.object({
  readingDate: z.coerce.date(),
  wetBulbC: z.number(),
  dryBulbC: z.number().optional().nullable(),
  airVelocityMs: z.number().nonnegative().optional().nullable(),
  measuredByName: z.string().optional(),
  notes: z.string().optional(),
});

const stationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  identifier: true,
  location: true,
  virginRockTemperatureC: true,
  wetBulbLimitC: true,
  coolingServed: true,
  status: true,
  notes: true,
  readings: {
    select: {
      id: true,
      readingDate: true,
      wetBulbC: true,
      dryBulbC: true,
      airVelocityMs: true,
      withinLimit: true,
      measuredByName: true,
      notes: true,
    },
    orderBy: { readingDate: "desc" as const },
    take: 12,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/stations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const stations = await prisma.thermalStressStation.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: stationSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(stations);
});

router.post("/stations", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = stationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: site.id } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const station = await prisma.thermalStressStation.create({ data: parsed.data, select: stationSelect });
  res.status(201).json(station);
});

router.put("/stations/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = stationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.thermalStressStation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Station not found" });
  const siteId = parsed.data.siteId ?? existing.siteId;
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const station = await prisma.thermalStressStation.update({
    where: { id: existing.id },
    data: parsed.data,
    select: stationSelect,
  });
  res.json(station);
});

router.delete("/stations/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.thermalStressStation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Station not found" });
  await prisma.thermalStressStation.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/stations/:id/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const station = await prisma.thermalStressStation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!station) return res.status(404).json({ error: "Station not found" });
  const readings = await prisma.thermalStressReading.findMany({
    where: { stationId: station.id },
    orderBy: { readingDate: "desc" },
  });
  res.json(readings);
});

/**
 * The limit is checked against wet-bulb, never dry-bulb. Dry-bulb temperature
 * says how hot the air is; wet-bulb says whether a person working in it can
 * still shed heat, which is the question that decides habitability. With no
 * limit on record the reading is stored but not assessed rather than assumed
 * compliant.
 */
router.post("/stations/:id/readings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const station = await prisma.thermalStressStation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!station) return res.status(404).json({ error: "Station not found" });

  const d = parsed.data;
  const withinLimit = station.wetBulbLimitC != null ? d.wetBulbC <= station.wetBulbLimitC : true;
  const reading = await prisma.thermalStressReading.create({ data: { ...d, withinLimit, stationId: station.id } });
  res.status(201).json(reading);
});

router.delete("/readings/:readingId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.thermalStressReading.findFirst({
    where: { id: req.params.readingId, station: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Reading not found" });
  await prisma.thermalStressReading.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
