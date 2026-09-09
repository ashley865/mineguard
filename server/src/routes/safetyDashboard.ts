import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// The Safety Manager owns this view, but GM and COO carry accountability for safety
// performance too and already have full module access — excluding them would mean the
// people answering for these numbers can't see them assembled anywhere.
const SAFETY_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["SAFETY_MANAGER", "GENERAL_MANAGER", "COO"];

async function requireSafetyAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !SAFETY_DASHBOARD_AUDIENCE.includes(me.title)) {
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
 * Everything the Safety dashboard needs, in one round trip. Assembled server-side rather
 * than by the page calling a dozen module endpoints: the counts are cheap aggregates, and
 * a safety lead loading their home screen shouldn't cost twelve requests.
 *
 * The shape deliberately separates leading indicators (observations, toolbox talks,
 * inspections done) from lagging ones (incidents, IOD claims). A dashboard that only shows
 * lagging indicators tells you how badly you did last month, not where the next one is
 * coming from.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireSafetyAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const bySite = { site: { mineId } };

  const [
    incidents,
    hazards,
    observations,
    inspections,
    riskAssessments,
    medicals,
    fatigue,
    permits,
    toolboxTalks,
    lastIncident,
    openIodClaims,
  ] = await Promise.all([
    prisma.incident.findMany({
      where: bySite,
      select: { id: true, title: true, severity: true, status: true, createdAt: true, site: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hazardReport.findMany({
      where: bySite,
      select: { id: true, description: true, riskLevel: true, status: true, dueDate: true, createdAt: true, location: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.safetyObservation.findMany({
      where: bySite,
      select: { id: true, type: true, severity: true, status: true, createdAt: true },
    }),
    prisma.safetyInspection.findMany({
      where: bySite,
      select: { id: true, title: true, status: true, scheduledDate: true, completedDate: true },
    }),
    prisma.riskAssessment.findMany({
      where: bySite,
      select: { id: true, title: true, residualRiskLevel: true, status: true, reviewDate: true },
    }),
    prisma.medicalSurveillance.findMany({
      where: { worker: bySite },
      select: { id: true, result: true, nextExamDue: true, worker: { select: { name: true } } },
    }),
    prisma.fatigueAssessment.findMany({
      where: { worker: bySite, assessedAt: { gte: trendStart } },
      select: { id: true, testResult: true, outcome: true },
    }),
    prisma.permitToWork.findMany({
      where: bySite,
      select: { id: true, status: true, workDescription: true, endDate: true },
    }),
    prisma.toolboxTalk.findMany({
      where: { ...bySite, talkDate: { gte: trendStart } },
      select: { id: true, attendeeCount: true },
    }),
    prisma.incident.findFirst({
      where: bySite,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, severity: true },
    }),
    prisma.iodClaim.count({
      where: { worker: bySite, status: { notIn: ["CLOSED", "REJECTED"] } },
    }),
  ]);

  const openIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const openHazards = hazards.filter((h) => h.status !== "CLOSED");
  // Past its due date and still not closed. Kept distinct from the OVERDUE status because
  // that flag is only as current as the last time something wrote to the row.
  const overdueHazards = openHazards.filter((h) => h.dueDate && h.dueDate < now);
  const overdueInspections = inspections.filter((i) => i.status !== "COMPLETED" && i.scheduledDate < now);
  const riskAssessmentsDue = riskAssessments.filter((r) => r.reviewDate < now);
  const medicalsDue = medicals.filter((m) => m.nextExamDue < now);
  const unfitWorkers = medicals.filter((m) => m.result === "UNFIT" || m.result === "TEMPORARILY_UNFIT");

  const countBy = <T, K extends string>(rows: T[], key: (row: T) => K): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const k = key(row);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  // A dense day-by-day series so the sparkline's x-axis is real time rather than "days on
  // which something happened", which would compress quiet stretches and overstate activity.
  const incidentSeries: { date: string; count: number }[] = [];
  const observationSeries: { date: string; count: number }[] = [];
  const incidentsByDay = countBy(
    incidents.filter((i) => i.createdAt >= trendStart),
    (i) => dayKey(i.createdAt) as string
  );
  const observationsByDay = countBy(
    observations.filter((o) => o.createdAt >= trendStart),
    (o) => dayKey(o.createdAt) as string
  );
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    incidentSeries.push({ date: key, count: incidentsByDay[key] ?? 0 });
    observationSeries.push({ date: key, count: observationsByDay[key] ?? 0 });
  }

  const daysSinceLastIncident = lastIncident
    ? Math.floor((now.getTime() - lastIncident.createdAt.getTime()) / DAY_MS)
    : null;

  res.json({
    headline: {
      openIncidents: openIncidents.length,
      criticalIncidents: openIncidents.filter((i) => i.severity === "CRITICAL").length,
      openHazards: openHazards.length,
      overdueHazards: overdueHazards.length,
      // null means no incident has ever been recorded — which the UI must not render as
      // "0 days since", the opposite of what it means.
      daysSinceLastIncident,
      openObservations: observations.filter((o) => o.status !== "CLOSED").length,
      openIodClaims,
    },
    trends: { incidents: incidentSeries, observations: observationSeries },
    breakdowns: {
      incidentsBySeverity: countBy(openIncidents, (i) => i.severity as string),
      hazardsByRisk: countBy(openHazards, (h) => h.riskLevel as string),
      observationsByType: countBy(observations, (o) => o.type as string),
    },
    leadingIndicators: {
      observationsLast30: observations.filter((o) => o.createdAt >= trendStart).length,
      toolboxTalksLast30: toolboxTalks.length,
      toolboxAttendeesLast30: toolboxTalks.reduce((sum, t) => sum + t.attendeeCount, 0),
      inspectionsCompletedLast30: inspections.filter((i) => i.completedDate && i.completedDate >= trendStart).length,
      fatigueAssessmentsLast30: fatigue.length,
      fatigueFailuresLast30: fatigue.filter((f) => f.testResult === "FAIL").length,
      fatigueStoodDownLast30: fatigue.filter((f) => f.outcome === "STOOD_DOWN").length,
    },
    workforceHealth: {
      unfitWorkers: unfitWorkers.length,
      medicalsOverdue: medicalsDue.length,
    },
    actionQueue: {
      overdueHazards: overdueHazards.slice(0, 8).map((h) => ({
        id: h.id,
        description: h.description,
        location: h.location,
        riskLevel: h.riskLevel,
        dueDate: h.dueDate,
      })),
      overdueInspections: overdueInspections.slice(0, 8).map((i) => ({ id: i.id, title: i.title, scheduledDate: i.scheduledDate })),
      riskAssessmentsDue: riskAssessmentsDue.slice(0, 8).map((r) => ({
        id: r.id,
        title: r.title,
        residualRiskLevel: r.residualRiskLevel,
        reviewDate: r.reviewDate,
      })),
      permitsAwaitingApproval: permits
        .filter((p) => p.status === "PENDING_EXECUTIVE" || p.status === "PENDING_SUPERVISOR")
        .slice(0, 8)
        .map((p) => ({ id: p.id, workDescription: p.workDescription, status: p.status, endDate: p.endDate })),
      medicalsOverdue: medicalsDue.slice(0, 8).map((m) => ({ id: m.id, workerName: m.worker.name, nextExamDue: m.nextExamDue })),
    },
    recentIncidents: incidents.slice(0, 6).map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      status: i.status,
      siteName: i.site.name,
      createdAt: i.createdAt,
    })),
  });
});

export default router;
