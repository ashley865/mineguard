import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Mirrors safetyDashboard.ts's audience reasoning: HR Manager owns this view, GM carries
// accountability for workforce numbers too. COO is excluded here — unlike safety/ops,
// day-to-day workforce relations isn't a COO accountability in this app's title set.
const HR_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["HR_MANAGER", "GENERAL_MANAGER"];

async function requireHrAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !HR_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const CERT_EXPIRY_WINDOW_DAYS = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * HR's home-screen aggregate, same one-round-trip reasoning as the other department
 * dashboards. Headcount trend is derived from Worker.createdAt (roster entry date) as a
 * proxy for hiring activity — this schema has no separate "hire date" field, and a roster
 * entry is the closest available signal to when someone actually joined.
 *
 * "Attendance today" is checked-in-today / active headcount, not a true absenteeism rate:
 * WorkerAttendance is a clock-in/out log with no rostered-shift comparison, so there's no
 * way to distinguish "not rostered today" from "absent" — the metric is framed as
 * attendance, not absenteeism, to avoid implying a distinction the data can't support.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireHrAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const certExpiryHorizon = new Date(now.getTime() + CERT_EXPIRY_WINDOW_DAYS * DAY_MS);
  const byWorkerSite = { worker: { site: { mineId } } };
  const bySite = { site: { mineId } };

  const [
    workers,
    attendanceToday,
    leaveRequests,
    expiringCertificates,
    disciplinaryCases,
    grievanceCases,
    ccmaCases,
    requisitions,
    candidates,
  ] = await Promise.all([
    prisma.worker.findMany({
      where: { site: { mineId } },
      select: { id: true, category: true, createdAt: true },
    }),
    prisma.workerAttendance.findMany({
      where: { ...byWorkerSite, checkInAt: { gte: startOfToday } },
      select: { workerId: true },
    }),
    prisma.leaveRequest.findMany({
      where: { ...byWorkerSite, createdAt: { gte: trendStart } },
      select: { id: true, leaveType: true, status: true, daysRequested: true, createdAt: true, worker: { select: { name: true } } },
    }),
    prisma.certificate.findMany({
      where: { ...byWorkerSite, expiryDate: { not: null, lte: certExpiryHorizon } },
      select: { id: true, type: true, expiryDate: true, status: true, worker: { select: { name: true } } },
    }),
    prisma.disciplinaryCase.findMany({
      where: { ...byWorkerSite, status: { in: ["OPEN", "SCHEDULED", "APPEALED"] } },
      select: { id: true, chargeDescription: true, hearingDate: true, status: true, worker: { select: { name: true } } },
    }),
    prisma.grievanceCase.findMany({
      where: { ...byWorkerSite, status: { in: ["OPEN", "UNDER_INVESTIGATION", "ESCALATED"] } },
      select: { id: true, description: true, dateRaised: true, status: true, worker: { select: { name: true } } },
    }),
    prisma.ccmaCase.findMany({
      where: { worker: { site: { mineId } }, status: { notIn: ["SETTLED", "AWARD_ISSUED", "WITHDRAWN"] } },
      select: { id: true, caseType: true, status: true, conciliationDate: true, arbitrationDate: true, worker: { select: { name: true } } },
    }),
    prisma.jobRequisition.findMany({
      where: { ...bySite, status: { in: ["OPEN", "ON_HOLD"] } },
      select: { id: true, positionTitle: true, numberOfPositions: true, status: true, targetFillDate: true, _count: { select: { candidates: true } } },
    }),
    prisma.candidate.findMany({
      where: { requisition: bySite },
      select: { id: true, stage: true, appliedDate: true },
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

  const activeHeadcount = workers.length;
  const attendedTodayCount = new Set(attendanceToday.map((a) => a.workerId)).size;
  const attendanceTodayPct = activeHeadcount === 0 ? 100 : Math.round((attendedTodayCount / activeHeadcount) * 100);

  // Cumulative headcount over the trend window — a running total, not a per-day count, so
  // the sparkline reads as "how the roster has grown" rather than "how many people joined
  // on this specific day" (which would mostly be zeros).
  const hiresByDay = countBy(
    workers.filter((w) => w.createdAt >= trendStart),
    (w) => dayKey(w.createdAt) as string
  );
  const baselineHeadcount = workers.filter((w) => w.createdAt < trendStart).length;
  let running = baselineHeadcount;
  const headcountSeries: { date: string; count: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    running += hiresByDay[key] ?? 0;
    headcountSeries.push({ date: key, count: running });
  }

  const pendingLeave = leaveRequests.filter((l) => l.status === "PENDING");
  const approvedLeaveDaysLast30 = leaveRequests.filter((l) => l.status === "APPROVED").reduce((sum, l) => sum + l.daysRequested, 0);

  const expiredCertificates = expiringCertificates.filter((c) => c.expiryDate && c.expiryDate < now);
  const expiringSoonCertificates = expiringCertificates.filter((c) => c.expiryDate && c.expiryDate >= now);

  const openRelationsCases = disciplinaryCases.length + grievanceCases.length + ccmaCases.length;

  const candidatesInPipeline = candidates.filter((c) => !["HIRED", "REJECTED", "WITHDRAWN"].includes(c.stage));
  const candidatesHiredLast30 = candidates.filter((c) => c.stage === "HIRED" && c.appliedDate >= trendStart).length;

  res.json({
    headline: {
      activeHeadcount,
      attendanceTodayPct,
      openRelationsCases,
      certificatesExpired: expiredCertificates.length,
      certificatesExpiringSoon: expiringSoonCertificates.length,
    },
    trends: { headcount: headcountSeries },
    breakdowns: {
      workersByCategory: countBy(workers, (w) => w.category as string),
      relationsCasesByType: {
        DISCIPLINARY: disciplinaryCases.length,
        GRIEVANCE: grievanceCases.length,
        CCMA: ccmaCases.length,
      },
    },
    recruitment: {
      openRequisitions: requisitions.length,
      positionsOpen: requisitions.reduce((sum, r) => sum + r.numberOfPositions, 0),
      candidatesInPipeline: candidatesInPipeline.length,
      candidatesHiredLast30,
    },
    leave: {
      pendingCount: pendingLeave.length,
      approvedDaysLast30: Math.round(approvedLeaveDaysLast30 * 10) / 10,
    },
    actionQueue: {
      pendingLeave: pendingLeave.slice(0, 8).map((l) => ({
        id: l.id,
        workerName: l.worker.name,
        leaveType: l.leaveType,
        daysRequested: l.daysRequested,
        createdAt: l.createdAt,
      })),
      expiringCertificates: [...expiredCertificates, ...expiringSoonCertificates]
        .sort((a, b) => (a.expiryDate!.getTime() - b.expiryDate!.getTime()))
        .slice(0, 8)
        .map((c) => ({ id: c.id, workerName: c.worker.name, type: c.type, expiryDate: c.expiryDate, expired: c.expiryDate! < now })),
      disciplinaryCases: disciplinaryCases.slice(0, 8).map((d) => ({
        id: d.id,
        workerName: d.worker.name,
        chargeDescription: d.chargeDescription,
        hearingDate: d.hearingDate,
        status: d.status,
      })),
      grievanceCases: grievanceCases.slice(0, 8).map((g) => ({
        id: g.id,
        workerName: g.worker.name,
        description: g.description,
        dateRaised: g.dateRaised,
        status: g.status,
      })),
      openRequisitions: requisitions.slice(0, 8).map((r) => ({
        id: r.id,
        positionTitle: r.positionTitle,
        numberOfPositions: r.numberOfPositions,
        candidateCount: r._count.candidates,
        targetFillDate: r.targetFillDate,
      })),
    },
  });
});

export default router;
