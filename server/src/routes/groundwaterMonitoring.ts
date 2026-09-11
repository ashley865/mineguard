import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const boreholeSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  boreholeType: z.enum(["UPGRADIENT", "DOWNGRADIENT", "SUPPLY", "OTHER"]).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  installedDate: z.coerce.date().optional().nullable(),
  staticWaterLevelBaselineM: z.number().optional().nullable(),
  status: z.enum(["ACTIVE", "DECOMMISSIONED", "DRY"]).optional(),
  notes: z.string().optional(),
});

const readingSchema = z.object({
  readingDate: z.coerce.date(),
  waterLevelMbgl: z.number().optional().nullable(),
  ph: z.number().min(0).max(14).optional().nullable(),
  electricalConductivity: z.number().nonnegative().optional().nullable(),
  totalDissolvedSolids: z.number().nonnegative().optional().nullable(),
  sulfateConcentration: z.number().nonnegative().optional().nullable(),
  withinLimits: z.boolean().optional(),
  notes: z.string().optional(),
});

const boreholeSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  identifier: true,
  boreholeType: true,
  latitude: true,
  longitude: true,
  installedDate: true,
  staticWaterLevelBaselineM: true,
  status: true,
  notes: true,
  readings: {
    select: {
      id: true,
      readingDate: true,
      waterLevelMbgl: true,
      ph: true,
      electricalConductivity: true,
      totalDissolvedSolids: true,
      sulfateConcentration: true,
      withinLimits: true,
      notes: true,
    },
    orderBy: { readingDate: "desc" as const },
    take: 12,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/boreholes", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const boreholes = await prisma.monitoringBorehole.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: boreholeSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(boreholes);
});

router.post("/boreholes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = boreholeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const borehole = await prisma.monitoringBorehole.create({ data: parsed.data, select: boreholeSelect });
  res.status(201).json(borehole);
});

router.put("/boreholes/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = boreholeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.monitoringBorehole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Borehole not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const borehole = await prisma.monitoringBorehole.update({ where: { id: existing.id }, data: parsed.data, select: boreholeSelect });
  res.json(borehole);
});

router.delete("/boreholes/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.monitoringBorehole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Borehole not found" });
  await prisma.monitoringBorehole.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/boreholes/:id/readings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const borehole = await prisma.monitoringBorehole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!borehole) return res.status(404).json({ error: "Borehole not found" });
  const readings = await prisma.groundwaterReading.findMany({ where: { boreholeId: borehole.id }, orderBy: { readingDate: "desc" } });
  res.json(readings);
});

router.post("/boreholes/:id/readings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const borehole = await prisma.monitoringBorehole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!borehole) return res.status(404).json({ error: "Borehole not found" });
  const reading = await prisma.groundwaterReading.create({ data: { ...parsed.data, boreholeId: borehole.id } });
  res.status(201).json(reading);
});

router.delete("/readings/:readingId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.groundwaterReading.findFirst({
    where: { id: req.params.readingId, borehole: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Reading not found" });
  await prisma.groundwaterReading.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
