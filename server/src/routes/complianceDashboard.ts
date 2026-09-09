import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Mirrors the other department dashboards' audience reasoning: Compliance Officer owns
// this view, GM carries accountability for regulatory standing too.
const COMPLIANCE_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["COMPLIANCE_OFFICER", "GENERAL_MANAGER"];

async function requireComplianceAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !COMPLIANCE_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const DUE_SOON_WINDOW_DAYS = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * Compliance's home-screen aggregate, same one-round-trip reasoning as the other
 * department dashboards. Regulatory notices (Section 54/55/53) are the highest-stakes item
 * on this dashboard — an open one can mean a stopped operation — so they lead the headline
 * ahead of the requirements register, which is important but rarely urgent by comparison.
 *
 * "Workers with a compliance gap" counts each worker once, against their most recent
 * EmployeeComplianceCheck only — a worker who failed a check a year ago but passed a later
 * one should read as compliant now, not flagged forever because an old row still exists.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireComplianceAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const dueSoonHorizon = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * DAY_MS);
  const bySite = { site: { mineId } };
  const byMine = { mineId };

  const [
    notices,
    requirements,
    findingsLast30,
    legalItems,
    submissions,
    complianceChecks,
  ] = await Promise.all([
    prisma.regulatoryNotice.findMany({
      where: bySite,
      select: { id: true, noticeNumber: true, section: true, issuedDate: true, complianceDeadline: true, status: true, description: true, site: { select: { name: true } } },
      orderBy: { issuedDate: "desc" },
    }),
    prisma.complianceRequirement.findMany({
      where: bySite,
      select: { id: true, requirement: true, regulation: true, status: true, dueDate: true, riskLevel: true, responsibleDepartment: true },
    }),
    prisma.auditFinding.findMany({
      where: { ...bySite, createdAt: { gte: trendStart } },
      select: { id: true, findingNumber: true, requirementViolated: true, severity: true, status: true, dueDate: true, createdAt: true },
    }),
    prisma.legalComplianceItem.findMany({
      where: { ...byMine, status: { in: ["UPCOMING", "DUE", "OVERDUE"] }, dueDate: { lte: dueSoonHorizon } },
      select: { id: true, title: true, category: true, dueDate: true, status: true },
    }),
    prisma.regulatorySubmission.findMany({
      where: { ...byMine, status: { in: ["DRAFT", "OVERDUE"] } },
      select: { id: true, regulator: true, subject: true, dueDate: true, status: true },
    }),
    prisma.employeeComplianceCheck.findMany({
      where: { worker: bySite },
      select: {
        workerId: true,
        assessmentDate: true,
        isProperlyTrained: true,
        isCompetent: true,
        isCertified: true,
        isAuthorised: true,
        isTrainingUpToDate: true,
        worker: { select: { name: true } },
      },
      orderBy: { assessmentDate: "desc" },
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

  const openNotices = notices.filter((n) => n.status === "OPEN" || n.status === "APPEALED");
  const overdueNotices = openNotices.filter((n) => n.complianceDeadline && n.complianceDeadline < now);

  const applicableRequirements = requirements.filter((r) => r.status !== "NOT_APPLICABLE");
  const compliantRequirements = applicableRequirements.filter((r) => r.status === "COMPLIANT");
  const nonCompliantRequirements = applicableRequirements.filter((r) => r.status === "NON_COMPLIANT" || r.status === "OVERDUE");
  const compliancePct = applicableRequirements.length === 0 ? 100 : Math.round((compliantRequirements.length / applicableRequirements.length) * 100);

  const findingsOpenedByDay = countBy(findingsLast30, (f) => dayKey(f.createdAt) as string);
  const noticesOpenedByDay = countBy(
    notices.filter((n) => n.issuedDate >= trendStart),
    (n) => dayKey(n.issuedDate) as string
  );
  const trendSeries: { date: string; notices: number; findings: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    trendSeries.push({ date: key, notices: noticesOpenedByDay[key] ?? 0, findings: findingsOpenedByDay[key] ?? 0 });
  }

  const openFindings = findingsLast30.filter((f) => !["VERIFIED", "CLOSED"].includes(f.status));
  const overdueFindings = openFindings.filter((f) => f.dueDate < now || f.status === "OVERDUE");

  const submissionsOverdue = submissions.filter((s) => s.status === "OVERDUE" || (s.dueDate && s.dueDate < now));
  const itemsDueSoon = legalItems.length + submissions.length;

  // Most recent check per worker only — see the route comment above.
  const latestCheckByWorker = new Map<string, (typeof complianceChecks)[number]>();
  for (const check of complianceChecks) {
    if (!latestCheckByWorker.has(check.workerId)) latestCheckByWorker.set(check.workerId, check);
  }
  const workersWithGap = [...latestCheckByWorker.values()].filter(
    (c) => !c.isProperlyTrained || !c.isCompetent || !c.isCertified || !c.isAuthorised || !c.isTrainingUpToDate
  );

  res.json({
    headline: {
      openNotices: openNotices.length,
      overdueNotices: overdueNotices.length,
      compliancePct,
      nonCompliantRequirements: nonCompliantRequirements.length,
      openFindings: openFindings.length,
      overdueFindings: overdueFindings.length,
      itemsDueSoon,
    },
    trends: { notices: trendSeries.map((d) => ({ date: d.date, count: d.notices })), findings: trendSeries.map((d) => ({ date: d.date, count: d.findings })) },
    breakdowns: {
      requirementsByStatus: countBy(applicableRequirements, (r) => r.status as string),
      noticesBySection: countBy(openNotices, (n) => n.section as string),
    },
    workforceCompliance: {
      workersAssessed: latestCheckByWorker.size,
      workersWithGap: workersWithGap.length,
    },
    actionQueue: {
      openNotices: openNotices.slice(0, 8).map((n) => ({
        id: n.id,
        noticeNumber: n.noticeNumber,
        section: n.section,
        description: n.description,
        complianceDeadline: n.complianceDeadline,
      })),
      openFindings: openFindings.slice(0, 8).map((f) => ({
        id: f.id,
        findingNumber: f.findingNumber,
        requirementViolated: f.requirementViolated,
        severity: f.severity,
        status: f.status,
        dueDate: f.dueDate,
      })),
      legalItems: legalItems.slice(0, 8).map((l) => ({ id: l.id, title: l.title, category: l.category, dueDate: l.dueDate, status: l.status })),
      submissionsOverdue: submissionsOverdue.slice(0, 8).map((s) => ({ id: s.id, regulator: s.regulator, subject: s.subject, dueDate: s.dueDate })),
    },
  });
});

export default router;
