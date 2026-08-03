import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const parameterType = req.query.parameterType as string | undefined;
  const outOfLimitsOnly = req.query.outOfLimitsOnly === "true";
  const readings = await prisma.environmentalReading.findMany({
    where: {
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
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reading = await prisma.environmentalReading.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: readingSelect,
  });
  res.status(201).json(reading);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = readingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const reading = await prisma.environmentalReading.update({ where: { id: req.params.id }, data: parsed.data, select: readingSelect });
    res.json(reading);
  } catch {
    res.status(404).json({ error: "Environmental reading not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.environmentalReading.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Environmental reading not found" });
  }
});

export default router;
