import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// The surveyor/resource appointee owns this view. GM and CFO are included because the
// resource and reserve statement is what underpins mine planning and the balance sheet —
// CFO already has /geology access for exactly that reason.
const MINERAL_RESOURCES_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["MINERAL_RESOURCES_MANAGER", "GENERAL_MANAGER", "CFO"];

async function requireResourcesAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !MINERAL_RESOURCES_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
// SAMREC expects the resource statement to be kept current; an estimate that hasn't been
// revisited in a year is flagged for review rather than assumed still valid.
const ESTIMATE_STALE_DAYS = 365;

const RESOURCE_CLASSES = ["MEASURED", "INDICATED", "INFERRED"] as const;
const RESERVE_CLASSES = ["PROVED_RESERVE", "PROBABLE_RESERVE"] as const;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * The resource and reserve position, the drilling programme behind it, and what needs the
 * competent person's attention.
 *
 * ResourceEstimate is versioned on purpose — a revision supersedes rather than overwrites
 * its predecessor (see the model's note). So every figure here is computed from the latest
 * version per site/mineral/classification; summing the raw table would count each revision
 * again and inflate the resource statement, which is the one number on this dashboard that
 * absolutely cannot be wrong.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireResourcesAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const yearStart = new Date(now.getTime() - 365 * DAY_MS);
  const staleBefore = new Date(now.getTime() - ESTIMATE_STALE_DAYS * DAY_MS);
  const bySite = { site: { mineId } };

  const [estimates, drillHoles, assays, productionYear] = await Promise.all([
    prisma.resourceEstimate.findMany({
      where: bySite,
      select: {
        id: true,
        siteId: true,
        estimateDate: true,
        mineralType: true,
        classification: true,
        tonnage: true,
        grade: true,
        gradeUnit: true,
        containedMetal: true,
        competentPerson: true,
        reportReference: true,
        version: true,
        site: { select: { name: true } },
      },
      orderBy: [{ version: "desc" }, { estimateDate: "desc" }],
    }),
    prisma.drillHole.findMany({
      where: bySite,
      select: {
        id: true,
        holeId: true,
        status: true,
        totalDepth: true,
        drilledDate: true,
        contractor: true,
        _count: { select: { assayIntervals: true } },
      },
    }),
    prisma.assayInterval.findMany({
      where: { drillHole: bySite },
      select: { mineralType: true, grade: true, gradeUnit: true, fromDepth: true, toDepth: true },
    }),
    prisma.productionRecord.findMany({
      where: { ...bySite, shiftDate: { gte: yearStart } },
      select: { tonnesMined: true },
    }),
  ]);

  const countBy = <T, K extends string>(rows: T[], key: (row: T) => K): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const k = key(row);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  // One estimate per site + mineral + classification: the highest version, and the most
  // recent date where versions tie. Anything older is a superseded revision kept for history.
  const latestEstimates = new Map<string, (typeof estimates)[number]>();
  for (const e of estimates) {
    const key = `${e.siteId}|${e.mineralType}|${e.classification}`;
    const held = latestEstimates.get(key);
    if (!held || e.version > held.version || (e.version === held.version && e.estimateDate > held.estimateDate)) {
      latestEstimates.set(key, e);
    }
  }
  const current = [...latestEstimates.values()];
  const supersededCount = estimates.length - current.length;

  const sumTonnage = (classes: readonly string[]) =>
    current.filter((e) => classes.includes(e.classification)).reduce((sum, e) => sum + e.tonnage, 0);

  const measuredIndicated = sumTonnage(["MEASURED", "INDICATED"]);
  const inferred = sumTonnage(["INFERRED"]);
  const reserves = sumTonnage(RESERVE_CLASSES);

  const annualProduction = productionYear.reduce((sum, p) => sum + p.tonnesMined, 0);
  // Years of reserve at the current rate. null rather than Infinity when nothing has been
  // mined in the window — no production means the ratio is undefined, not unlimited.
  const reserveLifeYears = annualProduction > 0 && reserves > 0 ? Math.round((reserves / annualProduction) * 10) / 10 : null;

  const holesByStatus = countBy(drillHoles, (h) => h.status as string);
  const completedHoles = drillHoles.filter((h) => h.status === "COMPLETED");
  const metresDrilled = completedHoles.reduce((sum, h) => sum + (h.totalDepth ?? 0), 0);
  // A completed hole with no assay intervals is core sitting unlogged — the gap between
  // drilling spend and usable data, and the thing most worth chasing on this dashboard.
  const holesAwaitingAssay = completedHoles.filter((h) => h._count.assayIntervals === 0);

  const drilledByDay = countBy(
    completedHoles.filter((h) => h.drilledDate && h.drilledDate >= trendStart),
    (h) => dayKey(h.drilledDate!) as string
  );
  const drillingSeries: { date: string; count: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    drillingSeries.push({ date: key, count: drilledByDay[key] ?? 0 });
  }

  // Grade averaged over interval length rather than per row: a 20 m interval at 3 g/t and a
  // 1 m interval at 9 g/t do not average to 6 g/t, and an unweighted mean would flatter
  // whichever way the short intervals happen to fall.
  const gradeByMineral: Record<string, { weightedGrade: number; metres: number; unit: string | null }> = {};
  for (const a of assays) {
    if (a.grade == null) continue;
    const length = Math.max(0, a.toDepth - a.fromDepth);
    if (length === 0) continue;
    const bucket = (gradeByMineral[a.mineralType] ??= { weightedGrade: 0, metres: 0, unit: a.gradeUnit });
    bucket.weightedGrade += a.grade * length;
    bucket.metres += length;
  }
  const averageGrades = Object.entries(gradeByMineral).map(([mineralType, b]) => ({
    mineralType,
    grade: Math.round((b.weightedGrade / b.metres) * 1000) / 1000,
    unit: b.unit,
    metres: Math.round(b.metres * 10) / 10,
  }));

  const staleEstimates = current.filter((e) => e.estimateDate < staleBefore);
  // SAMREC requires a named competent person to stand behind an estimate; one without is a
  // reporting gap, not merely a missing field.
  const estimatesWithoutCompetentPerson = current.filter((e) => !e.competentPerson || !e.competentPerson.trim());

  res.json({
    headline: {
      measuredIndicated: Math.round(measuredIndicated * 10) / 10,
      inferred: Math.round(inferred * 10) / 10,
      reserves: Math.round(reserves * 10) / 10,
      reserveLifeYears,
      annualProduction: Math.round(annualProduction * 10) / 10,
      holesInProgress: (holesByStatus.PLANNED ?? 0) + (holesByStatus.DRILLING ?? 0),
      holesAwaitingAssay: holesAwaitingAssay.length,
    },
    trends: { drilling: drillingSeries },
    breakdowns: {
      tonnageByClassification: Object.fromEntries(
        [...RESOURCE_CLASSES, ...RESERVE_CLASSES].map((c) => [c, Math.round(sumTonnage([c]) * 10) / 10])
      ),
      holesByStatus,
    },
    drilling: {
      totalHoles: drillHoles.length,
      completedHoles: completedHoles.length,
      metresDrilled: Math.round(metresDrilled * 10) / 10,
      assayIntervals: assays.length,
    },
    grades: averageGrades,
    estimateGovernance: {
      currentEstimates: current.length,
      supersededVersions: supersededCount,
      staleEstimates: staleEstimates.length,
      missingCompetentPerson: estimatesWithoutCompetentPerson.length,
    },
    actionQueue: {
      staleEstimates: staleEstimates.slice(0, 8).map((e) => ({
        id: e.id,
        siteName: e.site.name,
        mineralType: e.mineralType,
        classification: e.classification,
        estimateDate: e.estimateDate,
        version: e.version,
      })),
      missingCompetentPerson: estimatesWithoutCompetentPerson.slice(0, 8).map((e) => ({
        id: e.id,
        siteName: e.site.name,
        mineralType: e.mineralType,
        classification: e.classification,
        reportReference: e.reportReference,
      })),
      holesAwaitingAssay: holesAwaitingAssay.slice(0, 8).map((h) => ({
        id: h.id,
        holeId: h.holeId,
        totalDepth: h.totalDepth,
        drilledDate: h.drilledDate,
        contractor: h.contractor,
      })),
      holesInProgress: drillHoles
        .filter((h) => h.status === "PLANNED" || h.status === "DRILLING")
        .slice(0, 8)
        .map((h) => ({ id: h.id, holeId: h.holeId, status: h.status, totalDepth: h.totalDepth, contractor: h.contractor })),
    },
  });
});

export default router;
