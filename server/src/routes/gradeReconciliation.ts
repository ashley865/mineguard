import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { mineralTypeEnum } from "../lib/minerals";

const router = Router();

const reconciliationSchema = z.object({
  siteId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  mineralType: mineralTypeEnum,
  estimatedTonnes: z.number().positive(),
  estimatedGrade: z.number().positive(),
  gradeUnit: z.string().optional(),
  actualTonnesMined: z.number().nonnegative().optional().nullable(),
  actualGradeMined: z.number().nonnegative().optional().nullable(),
  actualTonnesMilled: z.number().nonnegative().optional().nullable(),
  actualGradeMilled: z.number().nonnegative().optional().nullable(),
  varianceExplanation: z.string().optional(),
  notes: z.string().optional(),
});

const reconciliationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  periodStart: true,
  periodEnd: true,
  mineralType: true,
  estimatedTonnes: true,
  estimatedGrade: true,
  gradeUnit: true,
  actualTonnesMined: true,
  actualGradeMined: true,
  actualTonnesMilled: true,
  actualGradeMilled: true,
  varianceExplanation: true,
  reconciledBy: { select: { id: true, name: true } },
  notes: true,
  createdAt: true,
} as const;

/**
 * Mine Call Factor: actual metal accounted for against what the model predicted
 * for the same tonnes, expressed as a percentage. Milled figures are preferred
 * over mined ones when both exist — milling is the point metal is actually
 * measured, mined tonnes/grade are still an estimate of what went into the mill.
 * Null whenever either side of the ratio is unknown, never a fabricated 100%.
 */
function mineCallFactorPct(r: {
  estimatedTonnes: number;
  estimatedGrade: number;
  actualTonnesMined: number | null;
  actualGradeMined: number | null;
  actualTonnesMilled: number | null;
  actualGradeMilled: number | null;
}): number | null {
  const estimatedMetal = r.estimatedTonnes * r.estimatedGrade;
  if (estimatedMetal <= 0) return null;
  const actualTonnes = r.actualTonnesMilled ?? r.actualTonnesMined;
  const actualGrade = r.actualGradeMilled ?? r.actualGradeMined;
  if (actualTonnes == null || actualGrade == null) return null;
  const actualMetal = actualTonnes * actualGrade;
  return Math.round((actualMetal / estimatedMetal) * 1000) / 10;
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const records = await prisma.gradeReconciliation.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: reconciliationSelect,
    orderBy: { periodStart: "desc" },
    take: 500,
  });
  res.json(records.map((r) => ({ ...r, mineCallFactorPct: mineCallFactorPct(r) })));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reconciliationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.periodEnd < parsed.data.periodStart) return res.status(400).json({ error: "periodEnd must not be before periodStart" });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const record = await prisma.gradeReconciliation.create({
    data: { ...parsed.data, reconciledById: req.auth!.userId },
    select: reconciliationSelect,
  });
  res.status(201).json({ ...record, mineCallFactorPct: mineCallFactorPct(record) });
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reconciliationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.gradeReconciliation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Reconciliation record not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const record = await prisma.gradeReconciliation.update({ where: { id: existing.id }, data: parsed.data, select: reconciliationSelect });
  res.json({ ...record, mineCallFactorPct: mineCallFactorPct(record) });
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.gradeReconciliation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Reconciliation record not found" });
  await prisma.gradeReconciliation.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const WINDOW_MONTHS = 12;

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const since = new Date();
  since.setMonth(since.getMonth() - WINDOW_MONTHS);

  const records = await prisma.gradeReconciliation.findMany({
    where: { site: { mineId }, periodStart: { gte: since } },
    select: {
      periodStart: true,
      mineralType: true,
      estimatedTonnes: true,
      estimatedGrade: true,
      actualTonnesMined: true,
      actualGradeMined: true,
      actualTonnesMilled: true,
      actualGradeMilled: true,
      varianceExplanation: true,
    },
    orderBy: { periodStart: "asc" },
  });

  const withMcf = records.map((r) => ({ ...r, mcf: mineCallFactorPct(r) })).filter((r) => r.mcf != null) as (typeof records[number] & { mcf: number })[];

  const avgMcfByMineral: Record<string, number> = {};
  const byMineral = new Map<string, number[]>();
  for (const r of withMcf) {
    const list = byMineral.get(r.mineralType) ?? [];
    list.push(r.mcf);
    byMineral.set(r.mineralType, list);
  }
  for (const [mineral, values] of byMineral) {
    avgMcfByMineral[mineral] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  // A period is "unexplained" when the factor drifts more than 10 percentage
  // points from 100% and nobody wrote down why — the reconciliation exists
  // specifically to catch this, so a large variance with no explanation is
  // itself the finding.
  const unexplainedVariances = withMcf.filter((r) => Math.abs(r.mcf - 100) > 10 && !r.varianceExplanation?.trim()).length;
  const periodsRecorded = records.length;
  const periodsAwaitingActuals = records.filter((r) => mineCallFactorPct(r) == null).length;

  const trend = withMcf.map((r) => ({ period: r.periodStart.toISOString().slice(0, 10), mineralType: r.mineralType, mcf: r.mcf }));

  res.json({
    windowMonths: WINDOW_MONTHS,
    periodsRecorded,
    periodsAwaitingActuals,
    avgMcfByMineral,
    unexplainedVariances,
    trend: trend.slice(-24),
  });
});

export default router;
