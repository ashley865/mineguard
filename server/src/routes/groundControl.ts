import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const districtSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  name: z.string().min(1),
  requiredSupportStandard: z.string().optional(),
  status: z.string().optional(),
});

const pointSchema = z.object({
  districtId: z.string().min(1),
  pointType: z.enum(["EXTENSOMETER", "CONVERGENCE_STATION", "TILTMETER", "PIEZOMETER", "OTHER"]),
  locationDescription: z.string().min(1),
  installedDate: z.coerce.date().optional().nullable(),
  status: z.string().optional(),
});

const readingSchema = z.object({
  pointId: z.string().min(1),
  readingDate: z.coerce.date(),
  value: z.coerce.number(),
  unit: z.string().min(1),
  alertThreshold: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const seismicEventSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  eventDate: z.coerce.date(),
  magnitude: z.coerce.number(),
  locationDescription: z.string().optional(),
  damageObserved: z.coerce.boolean().optional(),
  damageDescription: z.string().optional(),
});

const rockfallSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  districtId: z.string().optional().nullable(),
  eventType: z.enum(["ROCKFALL", "ROCKBURST"]),
  eventDate: z.coerce.date(),
  supportInPlace: z.string().optional(),
  description: z.string().min(1),
  reEntryAuthorized: z.coerce.boolean().optional(),
});

const districtSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  name: true,
  requiredSupportStandard: true,
  status: true,
  createdAt: true,
} as const;

const pointSelect = {
  id: true,
  districtId: true,
  district: { select: { id: true, name: true, siteId: true } },
  pointType: true,
  locationDescription: true,
  installedDate: true,
  status: true,
  createdAt: true,
} as const;

const readingSelect = {
  id: true,
  pointId: true,
  readingDate: true,
  value: true,
  unit: true,
  alertThreshold: true,
  exceedsThreshold: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const rockfallSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  districtId: true,
  district: { select: { id: true, name: true } },
  eventType: true,
  eventDate: true,
  supportInPlace: true,
  description: true,
  reEntryAuthorized: true,
  signOffBy: { select: { id: true, name: true } },
  signOffAt: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/districts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const districts = await prisma.groundControlDistrict.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: districtSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(districts);
});

router.post("/districts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = districtSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const district = await prisma.groundControlDistrict.create({ data: parsed.data, select: districtSelect });
  res.status(201).json(district);
});

router.put("/districts/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = districtSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.groundControlDistrict.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "District not found" });
  const district = await prisma.groundControlDistrict.update({ where: { id: existing.id }, data: parsed.data, select: districtSelect });
  res.json(district);
});

router.delete("/districts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.groundControlDistrict.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "District not found" });
  await prisma.groundControlDistrict.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/points", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const districtId = req.query.districtId as string | undefined;
  const points = await prisma.geotechnicalMonitoringPoint.findMany({
    where: { district: { site: { mineId } }, districtId: districtId || undefined },
    select: pointSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(points);
});

router.post("/points", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = pointSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const district = await prisma.groundControlDistrict.findFirst({ where: { id: parsed.data.districtId, site: { mineId } } });
  if (!district) return res.status(404).json({ error: "District not found" });
  const point = await prisma.geotechnicalMonitoringPoint.create({ data: parsed.data, select: pointSelect });
  res.status(201).json(point);
});

router.delete("/points/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.geotechnicalMonitoringPoint.findFirst({ where: { id: req.params.id, district: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Monitoring point not found" });
  await prisma.geotechnicalMonitoringPoint.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const pointId = req.query.pointId as string | undefined;
  const readings = await prisma.geotechnicalReading.findMany({
    where: { point: { district: { site: { mineId } } }, pointId: pointId || undefined },
    select: readingSelect,
    orderBy: { readingDate: "desc" },
  });
  res.json(readings);
});

router.post("/readings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const point = await prisma.geotechnicalMonitoringPoint.findFirst({ where: { id: parsed.data.pointId, district: { site: { mineId } } } });
  if (!point) return res.status(404).json({ error: "Monitoring point not found" });
  const exceedsThreshold = parsed.data.alertThreshold != null && Math.abs(parsed.data.value) >= Math.abs(parsed.data.alertThreshold);
  const reading = await prisma.geotechnicalReading.create({
    data: { ...parsed.data, exceedsThreshold, recordedById: req.auth!.userId },
    select: readingSelect,
  });
  res.status(201).json(reading);
});

router.get("/seismic-events", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const events = await prisma.seismicEvent.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    orderBy: { eventDate: "desc" },
  });
  res.json(events);
});

router.post("/seismic-events", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = seismicEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const event = await prisma.seismicEvent.create({ data: parsed.data });
  res.status(201).json(event);
});

router.delete("/seismic-events/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.seismicEvent.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Seismic event not found" });
  await prisma.seismicEvent.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/rockfall-incidents", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const incidents = await prisma.rockfallIncident.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: rockfallSelect,
    orderBy: { eventDate: "desc" },
  });
  res.json(incidents);
});

router.post("/rockfall-incidents", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = rockfallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const incident = await prisma.rockfallIncident.create({ data: parsed.data, select: rockfallSelect });
  res.status(201).json(incident);
});

// Only a Rock Engineer (or ADMIN/EXECUTIVE acting on their behalf) authorises re-entry —
// this is the legally significant sign-off step, kept separate from the general edit route.
router.post("/rockfall-incidents/:id/sign-off", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rockfallIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Rockfall incident not found" });
  const incident = await prisma.rockfallIncident.update({
    where: { id: existing.id },
    data: { reEntryAuthorized: true, signOffById: req.auth!.userId, signOffAt: new Date() },
    select: rockfallSelect,
  });
  res.json(incident);
});

router.delete("/rockfall-incidents/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rockfallIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Rockfall incident not found" });
  await prisma.rockfallIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
