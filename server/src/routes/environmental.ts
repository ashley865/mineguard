import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const readingSchema = z.object({
  siteId: z.string().min(1),
  monitoringPoint: z.string().min(1),
  parameterType: z.enum(["WATER_QUALITY", "AIR_QUALITY", "DUST", "NOISE", "TAILINGS_DAM_LEVEL"]),
  value: z.coerce.number(),
  unit: z.string().min(1),
  thresholdMin: z.coerce.number().optional().nullable(),
  thresholdMax: z.coerce.number().optional().nullable(),
  withinLimits: z.coerce.boolean().optional(),
  notes: z.string().optional(),
  recordedAt: z.coerce.date().optional(),
});

const readingSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  monitoringPoint: true,
  parameterType: true,
  value: true,
  unit: true,
  thresholdMin: true,
  thresholdMax: true,
  withinLimits: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  recordedAt: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const parameterType = req.query.parameterType as string | undefined;
  const outOfLimitsOnly = req.query.outOfLimitsOnly === "true";
  const readings = await prisma.environmentalReading.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      parameterType: (parameterType as any) || undefined,
      withinLimits: outOfLimitsOnly ? false : undefined,
    },
    select: readingSelect,
    orderBy: { recordedAt: "desc" },
    take: 200,
  });
  res.json(readings);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const reading = await prisma.environmentalReading.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: readingSelect,
  });
  res.status(201).json(reading);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = readingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.environmentalReading.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Environmental reading not found" });
  const reading = await prisma.environmentalReading.update({ where: { id: existing.id }, data: parsed.data, select: readingSelect });
  res.json(reading);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.environmentalReading.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Environmental reading not found" });
  await prisma.environmentalReading.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
