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
  requiredAirflowQuantity: z.coerce.number().optional().nullable(),
  unit: z.string().optional(),
  status: z.string().optional(),
});

const readingSchema = z.object({
  districtId: z.string().min(1),
  readingDate: z.coerce.date(),
  airflowQuantity: z.coerce.number(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const refugeBaySchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  name: z.string().min(1),
  capacityPersons: z.coerce.number().int().positive(),
  airSupplyDurationHours: z.coerce.number().optional().nullable(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  status: z.enum(["OPERATIONAL", "OUT_OF_SERVICE"]).optional(),
});

const exposureSchema = z.object({
  workerId: z.string().min(1),
  pollutant: z.enum(["DUST_RESPIRABLE", "DUST_INHALABLE", "NOISE", "METHANE", "CARBON_MONOXIDE", "DIESEL_PARTICULATE", "SILICA", "OTHER"]),
  sampleDate: z.coerce.date(),
  sampleType: z.enum(["PERSONAL", "AREA"]).optional(),
  measuredValue: z.coerce.number(),
  unit: z.string().min(1),
  occupationalExposureLimit: z.coerce.number(),
  notes: z.string().optional(),
});

const districtSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  name: true,
  requiredAirflowQuantity: true,
  unit: true,
  status: true,
  createdAt: true,
} as const;

const readingSelect = {
  id: true,
  districtId: true,
  readingDate: true,
  airflowQuantity: true,
  unit: true,
  withinRequirement: true,
  notes: true,
  createdAt: true,
} as const;

const refugeBaySelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  name: true,
  capacityPersons: true,
  airSupplyDurationHours: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  status: true,
  createdAt: true,
} as const;

const exposureSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  pollutant: true,
  sampleDate: true,
  sampleType: true,
  measuredValue: true,
  unit: true,
  occupationalExposureLimit: true,
  exceedsLimit: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/districts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const districts = await prisma.ventilationDistrict.findMany({
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
  const district = await prisma.ventilationDistrict.create({ data: parsed.data, select: districtSelect });
  res.status(201).json(district);
});

router.put("/districts/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = districtSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.ventilationDistrict.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "District not found" });
  const district = await prisma.ventilationDistrict.update({ where: { id: existing.id }, data: parsed.data, select: districtSelect });
  res.json(district);
});

router.delete("/districts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.ventilationDistrict.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "District not found" });
  await prisma.ventilationDistrict.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const districtId = req.query.districtId as string | undefined;
  const readings = await prisma.ventilationReading.findMany({
    where: { district: { site: { mineId } }, districtId: districtId || undefined },
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
  const district = await prisma.ventilationDistrict.findFirst({ where: { id: parsed.data.districtId, site: { mineId } } });
  if (!district) return res.status(404).json({ error: "District not found" });
  const withinRequirement = district.requiredAirflowQuantity == null || parsed.data.airflowQuantity >= district.requiredAirflowQuantity;
  const reading = await prisma.ventilationReading.create({ data: { ...parsed.data, withinRequirement }, select: readingSelect });
  res.status(201).json(reading);
});

router.get("/refuge-bays", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const bays = await prisma.refugeBay.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: refugeBaySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(bays);
});

router.post("/refuge-bays", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = refugeBaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const bay = await prisma.refugeBay.create({ data: parsed.data, select: refugeBaySelect });
  res.status(201).json(bay);
});

router.put("/refuge-bays/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = refugeBaySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.refugeBay.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Refuge bay not found" });
  const bay = await prisma.refugeBay.update({ where: { id: existing.id }, data: parsed.data, select: refugeBaySelect });
  res.json(bay);
});

router.delete("/refuge-bays/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.refugeBay.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Refuge bay not found" });
  await prisma.refugeBay.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/exposure-records", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const records = await prisma.occupationalExposureRecord.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    select: exposureSelect,
    orderBy: { sampleDate: "desc" },
  });
  res.json(records);
});

router.post("/exposure-records", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = exposureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const exceedsLimit = parsed.data.measuredValue > parsed.data.occupationalExposureLimit;
  const record = await prisma.occupationalExposureRecord.create({ data: { ...parsed.data, exceedsLimit }, select: exposureSelect });
  res.status(201).json(record);
});

router.delete("/exposure-records/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.occupationalExposureRecord.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Exposure record not found" });
  await prisma.occupationalExposureRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
