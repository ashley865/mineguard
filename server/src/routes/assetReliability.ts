import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const failureModes = [
  "MECHANICAL_WEAR",
  "BEARING_FAILURE",
  "LUBRICATION_FAILURE",
  "ELECTRICAL_FAULT",
  "HYDRAULIC_FAILURE",
  "PNEUMATIC_FAILURE",
  "STRUCTURAL_CRACK",
  "CONTROL_SYSTEM",
  "CONTAMINATION",
  "OVERLOAD",
  "CORROSION",
  "OPERATOR_ERROR",
  "OTHER",
] as const;

const profileSchema = z.object({
  equipmentId: z.string().min(1),
  criticality: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  criticalityRationale: z.string().optional(),
  commissionedDate: z.coerce.date().optional().nullable(),
  expectedLifeYears: z.number().int().min(0).max(200).optional().nullable(),
  replacementValue: z.number().nonnegative().optional().nullable(),
  currentRunHours: z.number().nonnegative().optional().nullable(),
  targetAvailabilityPct: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional(),
});

const failureSchema = z.object({
  equipmentId: z.string().min(1),
  failureDate: z.coerce.date(),
  failureMode: z.enum(failureModes),
  description: z.string().min(1),
  detectedBy: z.string().optional(),
  downtimeHours: z.number().nonnegative().optional().nullable(),
  repairCost: z.number().nonnegative().optional().nullable(),
  runHoursAtFailure: z.number().nonnegative().optional().nullable(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  recurrencePrevented: z.boolean().optional(),
  notes: z.string().optional(),
});

const equipmentBrief = { select: { id: true, name: true, type: true, status: true, siteId: true, site: { select: { id: true, name: true } } } } as const;

const profileSelect = {
  id: true,
  equipmentId: true,
  equipment: equipmentBrief,
  criticality: true,
  criticalityRationale: true,
  commissionedDate: true,
  expectedLifeYears: true,
  replacementValue: true,
  currentRunHours: true,
  runHoursUpdatedAt: true,
  targetAvailabilityPct: true,
  notes: true,
  createdAt: true,
} as const;

const failureSelect = {
  id: true,
  equipmentId: true,
  equipment: equipmentBrief,
  failureDate: true,
  failureMode: true,
  description: true,
  detectedBy: true,
  downtimeHours: true,
  repairCost: true,
  runHoursAtFailure: true,
  rootCause: true,
  correctiveAction: true,
  recurrencePrevented: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

// --- Reliability profiles -------------------------------------------------

router.get("/profiles", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const profiles = await prisma.assetReliabilityProfile.findMany({
    where: { equipment: { site: { mineId } } },
    select: profileSelect,
    orderBy: [{ criticality: "asc" }, { createdAt: "desc" }],
  });
  res.json(profiles);
});

/**
 * One profile per asset, so this upserts rather than erroring on a second POST —
 * the natural user action is "set the criticality on this machine", not "create a
 * profile record", and making them find the existing row first is friction with
 * no benefit.
 */
router.post("/profiles", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const equipment = await prisma.equipment.findFirst({ where: { id: parsed.data.equipmentId, site: { mineId } } });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });

  const { equipmentId, currentRunHours, ...rest } = parsed.data;
  const runHoursFields = currentRunHours == null ? {} : { currentRunHours, runHoursUpdatedAt: new Date() };
  const profile = await prisma.assetReliabilityProfile.upsert({
    where: { equipmentId },
    create: { equipmentId, ...rest, ...runHoursFields },
    update: { ...rest, ...runHoursFields },
    select: profileSelect,
  });
  res.status(201).json(profile);
});

router.put("/profiles/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = profileSchema.partial().omit({ equipmentId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.assetReliabilityProfile.findFirst({
    where: { id: req.params.id, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Reliability profile not found" });

  const { currentRunHours, ...rest } = parsed.data;
  // Only stamp runHoursUpdatedAt when the reading actually moves, so the
  // timestamp keeps meaning "when the meter was last read".
  const runHoursFields =
    currentRunHours == null || currentRunHours === existing.currentRunHours
      ? {}
      : { currentRunHours, runHoursUpdatedAt: new Date() };
  const profile = await prisma.assetReliabilityProfile.update({
    where: { id: existing.id },
    data: { ...rest, ...runHoursFields },
    select: profileSelect,
  });
  res.json(profile);
});

router.delete("/profiles/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.assetReliabilityProfile.findFirst({
    where: { id: req.params.id, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Reliability profile not found" });
  await prisma.assetReliabilityProfile.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Failures -------------------------------------------------------------

router.get("/failures", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const equipmentId = req.query.equipmentId as string | undefined;
  const failures = await prisma.equipmentFailure.findMany({
    where: { equipment: { site: { mineId } }, equipmentId: equipmentId || undefined },
    select: failureSelect,
    orderBy: { failureDate: "desc" },
    take: 500,
  });
  res.json(failures);
});

router.post("/failures", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = failureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const equipment = await prisma.equipment.findFirst({ where: { id: parsed.data.equipmentId, site: { mineId } } });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });
  const failure = await prisma.equipmentFailure.create({ data: parsed.data, select: failureSelect });
  res.status(201).json(failure);
});

router.put("/failures/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = failureSchema.partial().omit({ equipmentId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.equipmentFailure.findFirst({
    where: { id: req.params.id, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Failure not found" });
  const failure = await prisma.equipmentFailure.update({ where: { id: existing.id }, data: parsed.data, select: failureSelect });
  res.json(failure);
});

router.delete("/failures/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.equipmentFailure.findFirst({
    where: { id: req.params.id, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Failure not found" });
  await prisma.equipmentFailure.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Derived reliability metrics -----------------------------------------

const WINDOW_DAYS = 90;

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowHours = WINDOW_DAYS * 24;

  const [profiles, failures] = await Promise.all([
    prisma.assetReliabilityProfile.findMany({
      where: { equipment: { site: { mineId } } },
      select: {
        equipmentId: true,
        criticality: true,
        currentRunHours: true,
        targetAvailabilityPct: true,
        replacementValue: true,
        equipment: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.equipmentFailure.findMany({
      where: { equipment: { site: { mineId } }, failureDate: { gte: since } },
      select: { equipmentId: true, failureMode: true, downtimeHours: true, repairCost: true, recurrencePrevented: true },
    }),
  ]);

  const byEquipment = new Map<string, { count: number; downtime: number; cost: number }>();
  for (const f of failures) {
    const row = byEquipment.get(f.equipmentId) ?? { count: 0, downtime: 0, cost: 0 };
    row.count += 1;
    row.downtime += f.downtimeHours ?? 0;
    row.cost += f.repairCost ?? 0;
    byEquipment.set(f.equipmentId, row);
  }

  // Pareto of failure modes: which mode is eating the most availability, not
  // just which occurs most often — a rare failure with a week of downtime beats
  // a weekly one that costs an hour.
  const modeTotals = new Map<string, { count: number; downtimeHours: number }>();
  for (const f of failures) {
    const row = modeTotals.get(f.failureMode) ?? { count: 0, downtimeHours: 0 };
    row.count += 1;
    row.downtimeHours += f.downtimeHours ?? 0;
    modeTotals.set(f.failureMode, row);
  }
  const failureModeBreakdown = [...modeTotals.entries()]
    .map(([failureMode, v]) => ({ failureMode, ...v }))
    .sort((a, b) => b.downtimeHours - a.downtimeHours || b.count - a.count);

  const assets = profiles
    .map((p) => {
      const stats = byEquipment.get(p.equipmentId) ?? { count: 0, downtime: 0, cost: 0 };
      // MTBF against running time, measured from commissioning. Null rather than
      // a fabricated number when either the meter reading or a failure is missing —
      // "no failures yet" is not the same as "infinitely reliable".
      const mtbfHours = p.currentRunHours != null && stats.count > 0 ? p.currentRunHours / stats.count : null;
      const availabilityPct = Math.max(0, ((windowHours - stats.downtime) / windowHours) * 100);
      return {
        equipmentId: p.equipmentId,
        equipmentName: p.equipment.name,
        equipmentType: p.equipment.type,
        criticality: p.criticality,
        currentRunHours: p.currentRunHours,
        failureCount: stats.count,
        downtimeHours: stats.downtime,
        repairCost: stats.cost,
        mtbfHours,
        availabilityPct,
        targetAvailabilityPct: p.targetAvailabilityPct,
        belowTarget: p.targetAvailabilityPct != null && availabilityPct < p.targetAvailabilityPct,
      };
    })
    .sort((a, b) => b.downtimeHours - a.downtimeHours);

  const totalDowntime = failures.reduce((sum, f) => sum + (f.downtimeHours ?? 0), 0);
  const totalRepairCost = failures.reduce((sum, f) => sum + (f.repairCost ?? 0), 0);
  const criticalAssets = profiles.filter((p) => p.criticality === "CRITICAL").length;
  const rcaCompleted = failures.filter((f) => f.recurrencePrevented).length;

  res.json({
    windowDays: WINDOW_DAYS,
    profiledAssets: profiles.length,
    criticalAssets,
    failureCount: failures.length,
    totalDowntimeHours: totalDowntime,
    totalRepairCost,
    // Share of failures whose corrective action was judged to address the cause.
    // Null when nothing failed — 0% would read as a process problem that isn't there.
    rcaCompletionPct: failures.length > 0 ? (rcaCompleted / failures.length) * 100 : null,
    assetsBelowTarget: assets.filter((a) => a.belowTarget).length,
    failureModeBreakdown,
    assets: assets.slice(0, 25),
  });
});

export default router;
