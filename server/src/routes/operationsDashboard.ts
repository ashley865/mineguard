import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Mirrors safetyDashboard.ts's audience reasoning: the Operations Manager owns this view,
// but GM and COO carry accountability for production/uptime numbers too and already have
// full module access.
const OPERATIONS_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["OPERATIONS_MANAGER", "GENERAL_MANAGER", "COO"];

async function requireOperationsAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !OPERATIONS_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * Operations' home-screen aggregate, same one-round-trip reasoning as safetyDashboard.ts:
 * production, uptime and downtime are cheap counts/sums once fetched, and a manager
 * shouldn't pay a dozen requests to see them assembled together.
 *
 * Downtime duration is computed from startedAt/endedAt rather than stored, since an event
 * still in progress (endedAt null) has to count against "now", not disappear from the
 * total until someone closes it out.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireOperationsAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const bySite = { site: { mineId } };

  const [
    productionLast30,
    equipment,
    maintenance,
    downtimeLast30,
    activeDowntime,
    deliveriesToday,
    handoversLast7,
    rosterToday,
  ] = await Promise.all([
    prisma.productionRecord.findMany({
      where: { ...bySite, shiftDate: { gte: trendStart } },
      select: { shiftDate: true, tonnesMined: true, targetTonnes: true, mineralType: true },
    }),
    prisma.equipment.findMany({
      where: bySite,
      select: { id: true, name: true, type: true, status: true, lastMaintenance: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { equipment: bySite },
      select: {
        id: true,
        maintenanceType: true,
        scheduledDate: true,
        completedDate: true,
        status: true,
        downtimeMinutes: true,
        equipment: { select: { id: true, name: true } },
      },
    }),
    prisma.downtimeEvent.findMany({
      where: { ...bySite, startedAt: { gte: trendStart } },
      select: { id: true, category: true, description: true, affectedArea: true, startedAt: true, endedAt: true },
    }),
    prisma.downtimeEvent.findMany({
      where: { ...bySite, endedAt: null },
      select: { id: true, category: true, description: true, affectedArea: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.delivery.findMany({
      where: { ...bySite, checkInAt: { gte: startOfToday } },
      select: { id: true, direction: true, status: true, cargoType: true },
    }),
    prisma.shiftHandover.findMany({
      where: { ...bySite, shiftDate: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      select: { id: true, shiftDate: true, shift: true, outgoingSupervisor: true, issues: true, actionItems: true },
      orderBy: { shiftDate: "desc" },
    }),
    prisma.shiftRoster.findMany({
      where: { ...bySite, shiftDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + DAY_MS) } },
      select: { id: true, shiftType: true, _count: { select: { assignments: true } } },
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

  const sumBy = <T, K extends string>(rows: T[], key: (row: T) => K, value: (row: T) => number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const k = key(row);
      out[k] = (out[k] ?? 0) + value(row);
    }
    for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10) / 10;
    return out;
  };

  // Dense day-by-day series, same reasoning as the safety dashboard's trends: a sparse
  // "days something happened" series would compress quiet stretches and misread as a gap
  // in production rather than a day nothing was recorded.
  const productionByDay = new Map<string, { tonnes: number; target: number }>();
  for (const p of productionLast30) {
    const key = dayKey(p.shiftDate);
    const bucket = productionByDay.get(key) ?? { tonnes: 0, target: 0 };
    bucket.tonnes += p.tonnesMined;
    bucket.target += p.targetTonnes ?? 0;
    productionByDay.set(key, bucket);
  }
  const productionSeries: { date: string; tonnes: number; target: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    const bucket = productionByDay.get(key);
    productionSeries.push({ date: key, tonnes: bucket?.tonnes ?? 0, target: bucket?.target ?? 0 });
  }

  const todayKey = dayKey(now);
  const todayBucket = productionByDay.get(todayKey);
  const totalTonnesLast30 = productionLast30.reduce((sum, p) => sum + p.tonnesMined, 0);
  const totalTargetLast30 = productionLast30.reduce((sum, p) => sum + (p.targetTonnes ?? 0), 0);

  const downtimeHours = (rows: { startedAt: Date; endedAt: Date | null }[]) =>
    rows.reduce((sum, d) => sum + ((d.endedAt ?? now).getTime() - d.startedAt.getTime()) / (60 * 60 * 1000), 0);

  const equipmentDown = equipment.filter((e) => e.status === "DOWN");
  const equipmentTotal = equipment.length;
  // Uptime measured as the share of the fleet not currently DOWN — a live snapshot, not a
  // time-weighted availability calculation, which would need continuous status history
  // this schema doesn't keep. Framed as "right now" in the UI rather than a period metric.
  const uptimePct = equipmentTotal === 0 ? 100 : Math.round(((equipmentTotal - equipmentDown.length) / equipmentTotal) * 100);

  const overdueMaintenance = maintenance.filter((m) => m.status !== "COMPLETED" && m.status !== "CANCELLED" && m.scheduledDate < now);
  const maintenanceDowntimeHoursLast30 = maintenance
    .filter((m) => m.completedDate && m.completedDate >= trendStart)
    .reduce((sum, m) => sum + (m.downtimeMinutes ?? 0) / 60, 0);

  const handoversWithIssues = handoversLast7.filter((h) => (h.issues && h.issues.trim()) || (h.actionItems && h.actionItems.trim()));

  res.json({
    headline: {
      productionToday: todayBucket?.tonnes ?? 0,
      productionTargetToday: todayBucket?.target ?? 0,
      productionAttainmentPct30: totalTargetLast30 > 0 ? Math.round((totalTonnesLast30 / totalTargetLast30) * 100) : null,
      equipmentUptimePct: uptimePct,
      equipmentDownCount: equipmentDown.length,
      downtimeHoursLast30: Math.round(downtimeHours(downtimeLast30) * 10) / 10,
      overdueMaintenanceCount: overdueMaintenance.length,
    },
    trends: { production: productionSeries },
    breakdowns: {
      equipmentByStatus: countBy(equipment, (e) => e.status as string),
      downtimeByCategory: countBy(downtimeLast30, (d) => d.category as string),
      productionByMineral: sumBy(productionLast30, (p) => p.mineralType as string, (p) => p.tonnesMined),
    },
    fleet: {
      deliveriesToday: deliveriesToday.length,
      inboundToday: deliveriesToday.filter((d) => d.direction === "INBOUND").length,
      outboundToday: deliveriesToday.filter((d) => d.direction === "OUTBOUND").length,
      onSiteNow: deliveriesToday.filter((d) => d.status === "CHECKED_IN").length,
    },
    shifts: {
      rostersToday: rosterToday.length,
      workersRosteredToday: rosterToday.reduce((sum, r) => sum + r._count.assignments, 0),
      handoverIssuesLast7: handoversWithIssues.length,
    },
    maintenanceStats: {
      downtimeHoursFromMaintenanceLast30: Math.round(maintenanceDowntimeHoursLast30 * 10) / 10,
    },
    actionQueue: {
      overdueMaintenance: overdueMaintenance.slice(0, 8).map((m) => ({
        id: m.id,
        equipmentName: m.equipment.name,
        maintenanceType: m.maintenanceType,
        scheduledDate: m.scheduledDate,
      })),
      activeDowntime: activeDowntime.slice(0, 8).map((d) => ({
        id: d.id,
        category: d.category,
        description: d.description,
        affectedArea: d.affectedArea,
        startedAt: d.startedAt,
      })),
      equipmentDown: equipmentDown.slice(0, 8).map((e) => ({ id: e.id, name: e.name, type: e.type, lastMaintenance: e.lastMaintenance })),
      handoverIssues: handoversWithIssues.slice(0, 8).map((h) => ({
        id: h.id,
        shiftDate: h.shiftDate,
        shift: h.shift,
        outgoingSupervisor: h.outgoingSupervisor,
        issues: h.issues,
        actionItems: h.actionItems,
      })),
    },
  });
});

export default router;
