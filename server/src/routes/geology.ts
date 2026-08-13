import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { mineralTypeEnum } from "../lib/minerals";

const router = Router();

const drillHoleSchema = z.object({
  siteId: z.string().min(1),
  holeId: z.string().min(1),
  collarEasting: z.coerce.number().optional().nullable(),
  collarNorthing: z.coerce.number().optional().nullable(),
  collarElevation: z.coerce.number().optional().nullable(),
  azimuth: z.coerce.number().optional().nullable(),
  dip: z.coerce.number().optional().nullable(),
  totalDepth: z.coerce.number().optional().nullable(),
  status: z.enum(["PLANNED", "DRILLING", "COMPLETED", "ABANDONED"]).optional(),
  drilledDate: z.coerce.date().optional().nullable(),
  contractor: z.string().optional(),
  notes: z.string().optional(),
});

const assaySchema = z.object({
  drillHoleId: z.string().min(1),
  fromDepth: z.coerce.number(),
  toDepth: z.coerce.number(),
  mineralType: mineralTypeEnum,
  grade: z.coerce.number().optional().nullable(),
  gradeUnit: z.string().optional(),
  lithology: z.string().optional(),
});

const estimateSchema = z.object({
  siteId: z.string().min(1),
  estimateDate: z.coerce.date(),
  mineralType: mineralTypeEnum,
  classification: z.enum(["MEASURED", "INDICATED", "INFERRED", "PROVED_RESERVE", "PROBABLE_RESERVE"]),
  tonnage: z.coerce.number(),
  grade: z.coerce.number().optional().nullable(),
  gradeUnit: z.string().optional(),
  containedMetal: z.coerce.number().optional().nullable(),
  competentPerson: z.string().optional(),
  reportReference: z.string().optional(),
  notes: z.string().optional(),
});

const drillHoleSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  holeId: true,
  collarEasting: true,
  collarNorthing: true,
  collarElevation: true,
  azimuth: true,
  dip: true,
  totalDepth: true,
  status: true,
  drilledDate: true,
  contractor: true,
  notes: true,
  assayIntervals: { select: { id: true, fromDepth: true, toDepth: true, mineralType: true, grade: true, gradeUnit: true, lithology: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/drill-holes", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const holes = await prisma.drillHole.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: drillHoleSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(holes);
});

router.post("/drill-holes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillHoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const hole = await prisma.drillHole.create({ data: parsed.data, select: drillHoleSelect });
  res.status(201).json(hole);
});

router.put("/drill-holes/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillHoleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.drillHole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Drill hole not found" });
  const hole = await prisma.drillHole.update({ where: { id: existing.id }, data: parsed.data, select: drillHoleSelect });
  res.json(hole);
});

router.delete("/drill-holes/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.drillHole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Drill hole not found" });
  await prisma.drillHole.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/drill-holes/:id/assays", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assaySchema.omit({ drillHoleId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const hole = await prisma.drillHole.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!hole) return res.status(404).json({ error: "Drill hole not found" });
  await prisma.assayInterval.create({ data: { ...parsed.data, drillHoleId: hole.id } });
  const updated = await prisma.drillHole.findUnique({ where: { id: hole.id }, select: drillHoleSelect });
  res.status(201).json(updated);
});

router.delete("/assays/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.assayInterval.findFirst({ where: { id: req.params.id, drillHole: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Assay interval not found" });
  await prisma.assayInterval.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/resource-estimates", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const estimates = await prisma.resourceEstimate.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { estimateDate: "desc" },
  });
  res.json(estimates);
});

router.post("/resource-estimates", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  // Each new estimate for the same site+mineral+classification is a new version, so the
  // history of prior competent-person judgements is preserved rather than overwritten.
  const priorCount = await prisma.resourceEstimate.count({
    where: { siteId: parsed.data.siteId, mineralType: parsed.data.mineralType, classification: parsed.data.classification },
  });
  const estimate = await prisma.resourceEstimate.create({ data: { ...parsed.data, version: priorCount + 1 } });
  res.status(201).json(estimate);
});

router.delete("/resource-estimates/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.resourceEstimate.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Estimate not found" });
  await prisma.resourceEstimate.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
