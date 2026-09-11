import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { mineralTypeEnum } from "../lib/minerals";

const router = Router();

const sampleTypes = ["CERTIFIED_REFERENCE_STANDARD", "FIELD_DUPLICATE", "PULP_DUPLICATE", "BLANK", "CHECK_ASSAY"] as const;

const qaqcSchema = z.object({
  siteId: z.string().min(1),
  drillHoleId: z.string().optional().nullable(),
  sampleType: z.enum(sampleTypes),
  sampleDate: z.coerce.date(),
  labName: z.string().optional(),
  batchNumber: z.string().optional(),
  mineralType: mineralTypeEnum,
  referenceValue: z.number().optional().nullable(),
  measuredValue: z.number().optional().nullable(),
  toleranceRangeLow: z.number().optional().nullable(),
  toleranceRangeHigh: z.number().optional().nullable(),
  result: z.enum(["PASS", "WARNING", "FAIL"]).optional(),
  notes: z.string().optional(),
});

const qaqcSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  drillHoleId: true,
  drillHole: { select: { id: true, holeId: true } },
  sampleType: true,
  sampleDate: true,
  labName: true,
  batchNumber: true,
  mineralType: true,
  referenceValue: true,
  measuredValue: true,
  toleranceRangeLow: true,
  toleranceRangeHigh: true,
  result: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

/**
 * Result is derived from the tolerance band whenever both a reference and
 * measured value are on record — the tolerance is only informative if it is
 * actually checked against the numbers, not just stored alongside them.
 * Outside the band is FAIL; within the outer 10% of the band is WARNING,
 * since a standard drifting toward its limit is a lab-performance signal
 * worth seeing before it becomes a failure.
 */
function deriveResult(input: {
  referenceValue?: number | null;
  measuredValue?: number | null;
  toleranceRangeLow?: number | null;
  toleranceRangeHigh?: number | null;
  result?: "PASS" | "WARNING" | "FAIL";
}): "PASS" | "WARNING" | "FAIL" {
  const { measuredValue, toleranceRangeLow, toleranceRangeHigh } = input;
  if (measuredValue == null || toleranceRangeLow == null || toleranceRangeHigh == null) {
    return input.result ?? "PASS";
  }
  if (measuredValue < toleranceRangeLow || measuredValue > toleranceRangeHigh) return "FAIL";
  const band = toleranceRangeHigh - toleranceRangeLow;
  if (band > 0) {
    const margin = band * 0.1;
    if (measuredValue < toleranceRangeLow + margin || measuredValue > toleranceRangeHigh - margin) return "WARNING";
  }
  return "PASS";
}

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const samples = await prisma.qaqcSample.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: qaqcSelect,
    orderBy: { sampleDate: "desc" },
    take: 500,
  });
  res.json(samples);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = qaqcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.drillHoleId) {
    const hole = await prisma.drillHole.findFirst({ where: { id: parsed.data.drillHoleId, siteId: parsed.data.siteId } });
    if (!hole) return res.status(404).json({ error: "Drill hole not found on this site" });
  }
  const result = deriveResult(parsed.data);
  const sample = await prisma.qaqcSample.create({
    data: { ...parsed.data, result },
    select: qaqcSelect,
  });
  res.status(201).json(sample);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = qaqcSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.qaqcSample.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "QAQC sample not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const merged = { ...existing, ...parsed.data };
  const result = deriveResult(merged);
  const sample = await prisma.qaqcSample.update({
    where: { id: existing.id },
    data: { ...parsed.data, result },
    select: qaqcSelect,
  });
  res.json(sample);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.qaqcSample.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "QAQC sample not found" });
  await prisma.qaqcSample.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const WINDOW_DAYS = 90;

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const samples = await prisma.qaqcSample.findMany({
    where: { site: { mineId }, sampleDate: { gte: since } },
    select: { sampleType: true, result: true, labName: true },
  });

  const byType: Record<string, { total: number; fail: number; warning: number }> = {};
  for (const s of samples) {
    const bucket = (byType[s.sampleType] ??= { total: 0, fail: 0, warning: 0 });
    bucket.total += 1;
    if (s.result === "FAIL") bucket.fail += 1;
    if (s.result === "WARNING") bucket.warning += 1;
  }

  const byLab: Record<string, { total: number; fail: number }> = {};
  for (const s of samples) {
    const lab = s.labName?.trim() || "Unspecified";
    const bucket = (byLab[lab] ??= { total: 0, fail: 0 });
    bucket.total += 1;
    if (s.result === "FAIL") bucket.fail += 1;
  }

  const failCount = samples.filter((s) => s.result === "FAIL").length;
  const warningCount = samples.filter((s) => s.result === "WARNING").length;

  res.json({
    windowDays: WINDOW_DAYS,
    total: samples.length,
    fail: failCount,
    warning: warningCount,
    // Null when nothing was submitted in the window — 0% would read as a failed
    // program rather than an absent one.
    passRatePct: samples.length > 0 ? Math.round(((samples.length - failCount) / samples.length) * 100) : null,
    byType,
    byLab,
  });
});

export default router;
