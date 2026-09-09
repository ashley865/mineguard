import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Mirrors the other department dashboards' audience reasoning: Security Manager owns this
// view, GM carries accountability for security posture too. COO excluded, same reasoning
// as HR — day-to-day security operations isn't a COO accountability in this title set.
const SECURITY_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["SECURITY_MANAGER", "GENERAL_MANAGER"];

async function requireSecurityAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !SECURITY_DASHBOARD_AUDIENCE.includes(me.title)) {
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
 * Security's home-screen aggregate, same one-round-trip reasoning as the other department
 * dashboards. Patrol compliance is measured against assignments actually scheduled for
 * today, not a fixed target — a site with no patrols scheduled shouldn't read as 0%
 * compliant, it has nothing to be compliant against.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireSecurityAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);
  const bySite = { site: { mineId } };

  const [
    incidentsLast30,
    cameras,
    patrolsToday,
    gateLogsToday,
    visitorsPending,
    visitorsToday,
    activeBlacklist,
    vettingPending,
    vettingFailed,
  ] = await Promise.all([
    prisma.securityIncident.findMany({
      where: { ...bySite, occurredAt: { gte: trendStart } },
      select: { id: true, description: true, category: true, severity: true, status: true, location: true, occurredAt: true, site: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.securityCamera.findMany({
      where: bySite,
      select: { id: true, name: true, status: true },
    }),
    prisma.patrolAssignment.findMany({
      where: { ...bySite, shiftDate: { gte: startOfToday, lt: endOfToday } },
      select: { id: true, status: true, shiftDate: true, worker: { select: { name: true } }, route: { select: { name: true } } },
    }),
    prisma.gateLog.findMany({
      where: { ...bySite, loggedAt: { gte: startOfToday } },
      select: { direction: true },
    }),
    prisma.visitor.findMany({
      where: { ...bySite, status: "PENDING_APPROVAL" },
      select: { id: true, fullName: true, hostName: true, purposeOfVisit: true, scheduledFor: true, isEmergency: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.visitor.findMany({
      where: { ...bySite, scheduledFor: { gte: startOfToday, lt: endOfToday } },
      select: { id: true, status: true },
    }),
    prisma.securityBlacklistEntry.count({ where: { isActive: true, OR: [{ site: { mineId } }, { siteId: null }] } }),
    prisma.vettingRecord.count({ where: { mineId, status: "PENDING" } }),
    prisma.vettingRecord.findMany({
      where: { mineId, status: "FAILED" },
      select: { id: true, subjectName: true, checkType: true, checkedDate: true },
      orderBy: { checkedDate: "desc" },
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

  const openIncidents = incidentsLast30.filter((i) => i.status !== "RESOLVED");
  const criticalIncidents = openIncidents.filter((i) => i.severity === "CRITICAL");

  const incidentsByDay = countBy(incidentsLast30, (i) => dayKey(i.occurredAt) as string);
  const incidentSeries: { date: string; count: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    incidentSeries.push({ date: key, count: incidentsByDay[key] ?? 0 });
  }

  const camerasOnline = cameras.filter((c) => c.status === "ONLINE");
  const camerasDown = cameras.filter((c) => c.status === "OFFLINE" || c.status === "MAINTENANCE");
  const cameraUptimePct = cameras.length === 0 ? 100 : Math.round((camerasOnline.length / cameras.length) * 100);

  const patrolsCompleted = patrolsToday.filter((p) => p.status === "COMPLETED");
  const patrolsMissed = patrolsToday.filter((p) => p.status === "MISSED");
  // Only counted against assignments that have actually reached a terminal or in-progress
  // state — an assignment still hours away shouldn't drag today's compliance rate down
  // before its shift has even started.
  const patrolsDue = patrolsToday.filter((p) => ["COMPLETED", "MISSED", "IN_PROGRESS"].includes(p.status));
  const patrolCompliancePct = patrolsDue.length === 0 ? null : Math.round((patrolsCompleted.length / patrolsDue.length) * 100);

  res.json({
    headline: {
      openIncidents: openIncidents.length,
      criticalIncidents: criticalIncidents.length,
      cameraUptimePct,
      camerasDownCount: camerasDown.length,
      patrolCompliancePct,
      patrolsScheduledToday: patrolsToday.length,
      pendingVisitorApprovals: visitorsPending.length,
    },
    trends: { incidents: incidentSeries },
    breakdowns: {
      incidentsByCategory: countBy(openIncidents, (i) => i.category as string),
      visitorsByStatusToday: countBy(visitorsToday, (v) => v.status as string),
    },
    gateActivity: {
      inToday: gateLogsToday.filter((g) => g.direction === "IN").length,
      outToday: gateLogsToday.filter((g) => g.direction === "OUT").length,
    },
    vetting: {
      pending: vettingPending,
      failed: vettingFailed.length,
    },
    blacklist: {
      activeEntries: activeBlacklist,
    },
    actionQueue: {
      openIncidents: openIncidents.slice(0, 8).map((i) => ({
        id: i.id,
        description: i.description,
        category: i.category,
        severity: i.severity,
        location: i.location,
        occurredAt: i.occurredAt,
      })),
      pendingVisitors: visitorsPending.slice(0, 8).map((v) => ({
        id: v.id,
        fullName: v.fullName,
        hostName: v.hostName,
        purposeOfVisit: v.purposeOfVisit,
        scheduledFor: v.scheduledFor,
        isEmergency: v.isEmergency,
      })),
      missedPatrols: patrolsMissed.slice(0, 8).map((p) => ({ id: p.id, workerName: p.worker.name, routeName: p.route.name, shiftDate: p.shiftDate })),
      vettingFailed: vettingFailed.slice(0, 8).map((v) => ({ id: v.id, subjectName: v.subjectName, checkType: v.checkType, checkedDate: v.checkedDate })),
    },
  });
});

export default router;
