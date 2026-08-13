import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const waterBalanceSchema = z.object({
  siteId: z.string().min(1),
  recordDate: z.coerce.date(),
  abstractedVolume: z.coerce.number(),
  dischargedVolume: z.coerce.number(),
  recycledVolume: z.coerce.number().optional(),
  unit: z.string().optional(),
  licenseLimit: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const damSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  capacity: z.coerce.number().optional().nullable(),
  unit: z.string().optional(),
  currentLevel: z.coerce.number().optional().nullable(),
  status: z.enum(["ACTIVE", "DECOMMISSIONED"]).optional(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
});

const amdSchema = z.object({
  siteId: z.string().min(1),
  monitoringPoint: z.string().min(1),
  readingDate: z.coerce.date(),
  ph: z.coerce.number(),
  sulfateConcentration: z.coerce.number().optional().nullable(),
  metalConcentration: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const energySchema = z.object({
  siteId: z.string().min(1),
  recordMonth: z.coerce.date(),
  gridConsumptionKwh: z.coerce.number(),
  renewableConsumptionKwh: z.coerce.number().optional(),
  dieselConsumptionLiters: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const ghgSchema = z.object({
  reportingYear: z.coerce.number().int(),
  scope1TonnesCO2e: z.coerce.number(),
  scope2TonnesCO2e: z.coerce.number(),
  carbonTaxLiability: z.coerce.number().optional().nullable(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.get("/water-balance", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const records = await prisma.waterBalanceRecord.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { recordDate: "desc" },
  });
  res.json(records);
});

router.post("/water-balance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = waterBalanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const withinLimit = parsed.data.licenseLimit == null || parsed.data.abstractedVolume <= parsed.data.licenseLimit;
  const record = await prisma.waterBalanceRecord.create({ data: { ...parsed.data, withinLimit } });
  res.status(201).json(record);
});

router.delete("/water-balance/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.waterBalanceRecord.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Record not found" });
  await prisma.waterBalanceRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/pollution-dams", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const dams = await prisma.pollutionControlDam.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(dams);
});

router.post("/pollution-dams", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = damSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const dam = await prisma.pollutionControlDam.create({ data: parsed.data });
  res.status(201).json(dam);
});

router.put("/pollution-dams/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = damSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.pollutionControlDam.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Dam not found" });
  const dam = await prisma.pollutionControlDam.update({ where: { id: existing.id }, data: parsed.data });
  res.json(dam);
});

router.delete("/pollution-dams/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.pollutionControlDam.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Dam not found" });
  await prisma.pollutionControlDam.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/amd-readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const readings = await prisma.acidMineDrainageReading.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    orderBy: { readingDate: "desc" },
  });
  res.json(readings);
});

router.post("/amd-readings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = amdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  // Acid mine drainage is characterised by low pH (typically < 6) with elevated sulfate/metals.
  const withinLimits = parsed.data.ph >= 6 && parsed.data.ph <= 9;
  const reading = await prisma.acidMineDrainageReading.create({ data: { ...parsed.data, withinLimits } });
  res.status(201).json(reading);
});

router.delete("/amd-readings/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.acidMineDrainageReading.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Reading not found" });
  await prisma.acidMineDrainageReading.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/energy", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const records = await prisma.energyConsumptionRecord.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { recordMonth: "desc" },
  });
  res.json(records);
});

router.post("/energy", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = energySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const record = await prisma.energyConsumptionRecord.create({ data: parsed.data });
  res.status(201).json(record);
});

router.delete("/energy/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.energyConsumptionRecord.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Record not found" });
  await prisma.energyConsumptionRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/ghg-emissions", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const records = await prisma.ghgEmissionsRecord.findMany({ where: { mineId }, orderBy: { reportingYear: "desc" } });
  res.json(records);
});

router.post("/ghg-emissions", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ghgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const record = await prisma.ghgEmissionsRecord.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(record);
});

router.put("/ghg-emissions/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ghgSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.ghgEmissionsRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Record not found" });
  const record = await prisma.ghgEmissionsRecord.update({ where: { id: existing.id }, data: parsed.data });
  res.json(record);
});

router.delete("/ghg-emissions/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.ghgEmissionsRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Record not found" });
  await prisma.ghgEmissionsRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
