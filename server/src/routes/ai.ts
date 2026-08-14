import { Router } from "express";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { computeComplianceScore } from "../services/complianceScore";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";

const router = Router();

router.use(requireAuth, requireRole("EXECUTIVE", "ADMIN"));

interface AiModule {
  buildContext: (mineId: string) => Promise<Record<string, unknown>>;
  systemPrompt: (context: any) => string;
}

async function buildGeneralManagerContext(mineId: string) {
  const [
    mine,
    sitesByStatus,
    totalWorkers,
    onShiftWorkers,
    totalEquipment,
    operationalEquipment,
    openIncidents,
    investigatingIncidents,
    openAlertsBySeverity,
    { score: complianceScore },
    overdueLegalItems,
    openHazards,
    openAuditFindings,
    pendingExpenses,
    permitsExpiringSoon,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true, location: true } }),
    prisma.site.groupBy({ by: ["status"], _count: true, where: { mineId } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { status: "OPERATIONAL", site: { mineId } } }),
    prisma.incident.count({ where: { status: "OPEN", site: { mineId } } }),
    prisma.incident.count({ where: { status: "INVESTIGATING", site: { mineId } } }),
    prisma.alert.groupBy({ by: ["severity"], where: { status: "OPEN", site: { mineId } }, _count: true }),
    computeComplianceScore(mineId),
    prisma.legalComplianceItem.count({ where: { status: "OVERDUE", site: { mineId } } }),
    prisma.hazardReport.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.auditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.permit.count({
      where: { status: "ACTIVE", site: { mineId }, expiryDate: { lte: new Date(Date.now() + 90 * 86400000) } },
    }),
  ]);

  const alertSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openAlertsBySeverity) alertSeverity[row.severity] = row._count;

  const siteStatus = { OPERATIONAL: 0, RESTRICTED: 0, SHUT_DOWN: 0 } as Record<string, number>;
  for (const row of sitesByStatus) siteStatus[row.status] = row._count;

  return {
    mine: { name: mine?.name ?? "the mine", location: mine?.location ?? null },
    sites: siteStatus,
    workforce: { total: totalWorkers, onShift: onShiftWorkers },
    equipment: {
      total: totalEquipment,
      operational: operationalEquipment,
      uptimePct: totalEquipment === 0 ? 100 : Math.round((operationalEquipment / totalEquipment) * 1000) / 10,
    },
    incidents: { open: openIncidents, investigating: investigatingIncidents },
    openAlertsBySeverity: alertSeverity,
    complianceScorePct: complianceScore,
    overdueLegalComplianceItems: overdueLegalItems,
    openHazardReports: openHazards,
    openAuditFindings,
    pendingExpenses: { count: pendingExpenses._count, totalAmount: pendingExpenses._sum.amount ?? 0 },
    permitsExpiringWithin90Days: permitsExpiringSoon,
  };
}

function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

async function buildHrManagerContext(mineId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    mine,
    workers,
    pendingLeaveRequests,
    onLeaveToday,
    newHires,
    expiringCerts,
    expiringTraining,
    openDisciplinaryCases,
    openGrievances,
    activeCcmaCases,
    activeLearnerships,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.worker.findMany({ where: { site: { mineId } }, select: { category: true, status: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
    }),
    prisma.worker.findMany({
      where: { site: { mineId }, createdAt: { gte: thirtyDaysAgo } },
      select: { name: true, role: true, category: true, createdAt: true, site: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.certificate.findMany({
      where: { status: "ACTIVE", expiryDate: { not: null }, worker: { site: { mineId } } },
      select: { type: true, expiryDate: true, worker: { select: { name: true } } },
    }),
    prisma.trainingRecord.findMany({
      where: { expiryDate: { not: null }, worker: { site: { mineId } } },
      select: { courseName: true, expiryDate: true, worker: { select: { name: true } } },
    }),
    prisma.disciplinaryCase.count({ where: { status: { in: ["OPEN", "SCHEDULED"] }, worker: { site: { mineId } } } }),
    prisma.grievanceCase.count({ where: { status: { in: ["OPEN", "UNDER_INVESTIGATION"] }, worker: { site: { mineId } } } }),
    prisma.ccmaCase.count({ where: { status: { in: ["REFERRED", "CONCILIATION", "ARBITRATION"] }, worker: { site: { mineId } } } }),
    prisma.learnership.count({ where: { status: { in: ["ENROLLED", "IN_PROGRESS"] }, mineId } }),
  ]);

  const byCategoryMap = new Map<string, { total: number; onShift: number }>();
  for (const w of workers) {
    const entry = byCategoryMap.get(w.category) ?? { total: 0, onShift: 0 };
    entry.total += 1;
    if (w.status === "ON_SHIFT") entry.onShift += 1;
    byCategoryMap.set(w.category, entry);
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, { total, onShift }]) => ({ category, total, onShift }))
    .sort((a, b) => b.total - a.total);

  const warnings = [
    ...expiringCerts
      .filter((c) => c.expiryDate && daysFromNow(c.expiryDate) <= 30)
      .map((c) => {
        const days = daysFromNow(c.expiryDate!);
        return {
          worker: c.worker.name,
          message: `${c.type.replace(/_/g, " ")} certificate ${days < 0 ? `overdue by ${Math.abs(days)}d` : `expires in ${days}d`}`,
          daysUntil: days,
        };
      }),
    ...expiringTraining
      .filter((tr) => tr.expiryDate && daysFromNow(tr.expiryDate) <= 30)
      .map((tr) => {
        const days = daysFromNow(tr.expiryDate!);
        return {
          worker: tr.worker.name,
          message: `${tr.courseName} training ${days < 0 ? `overdue by ${Math.abs(days)}d` : `due in ${days}d`}`,
          daysUntil: days,
        };
      }),
  ]
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 12);

  const totalWorkers = workers.length;
  const onShiftWorkers = workers.filter((w) => w.status === "ON_SHIFT").length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    workforce: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      byCategory,
    },
    leave: { pendingRequests: pendingLeaveRequests, onLeaveToday },
    newHiresLast30Days: newHires.map((w) => ({
      name: w.name,
      role: w.role,
      category: w.category,
      site: w.site?.name ?? null,
      hiredDaysAgo: Math.floor((Date.now() - w.createdAt.getTime()) / 86400000),
    })),
    certificateAndTrainingWarnings: warnings,
    labourRelations: {
      openDisciplinaryCases,
      openGrievances,
      activeCcmaCases,
    },
    skillsDevelopment: { activeLearnerships },
  };
}

async function buildCfoContext(mineId: string) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);

  const [
    mine,
    paidInvoices,
    paidExpensesLast6Months,
    pendingExpenses,
    overdueInvoices,
    outstandingInvoices,
    pendingPurchaseOrders,
    recentPayslips,
    upcomingInvoicesDue,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.invoice.findMany({
      where: { site: { mineId }, status: "PAID", issueDate: { gte: sixMonthsAgo } },
      select: { vatRate: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PAID", expenseDate: { gte: sixMonthsAgo } },
      select: { amount: true, category: true },
    }),
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.invoice.aggregate({
      where: { site: { mineId }, status: "OVERDUE" },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { site: { mineId }, status: { in: ["SENT", "OVERDUE"] } },
      select: { vatRate: true, dueDate: true, status: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: "SUBMITTED", site: { mineId } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.payslip.findMany({
      where: { worker: { site: { mineId } }, issuedAt: { gte: thirtyDaysAgo } },
      select: { grossPay: true, netPay: true, deductions: true, workerId: true },
    }),
    prisma.invoice.count({
      where: { site: { mineId }, status: "SENT", dueDate: { lte: in30Days } },
    }),
  ]);

  const totalEarnings = paidInvoices.reduce((sum, inv) => {
    const subtotal = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
    return sum + subtotal * (1 + inv.vatRate / 100);
  }, 0);
  const totalExpensesPaid = paidExpensesLast6Months.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals: Record<string, number> = {};
  for (const e of paidExpensesLast6Months) categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  const topExpenseCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({ category, total: Math.round(total) }));

  let overdueInvoiceTotal = 0;
  let outstandingInvoiceTotal = 0;
  for (const inv of outstandingInvoices) {
    const subtotal = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
    const total = subtotal * (1 + inv.vatRate / 100);
    outstandingInvoiceTotal += total;
    if (inv.status === "OVERDUE") overdueInvoiceTotal += total;
  }

  const payrollLast30Days = recentPayslips.reduce(
    (acc, p) => ({
      grossPay: acc.grossPay + p.grossPay,
      netPay: acc.netPay + p.netPay,
      deductions: acc.deductions + p.deductions,
    }),
    { grossPay: 0, netPay: 0, deductions: 0 }
  );

  return {
    mine: { name: mine?.name ?? "the mine" },
    financialSummaryLast6Months: {
      totalEarnings: Math.round(totalEarnings),
      totalExpensesPaid: Math.round(totalExpensesPaid),
      netMargin: Math.round(totalEarnings - totalExpensesPaid),
      topExpenseCategories,
    },
    pendingExpenseApprovals: { count: pendingExpenses._count, totalAmount: pendingExpenses._sum.amount ?? 0 },
    invoices: {
      overdueCount: overdueInvoices._count,
      overdueTotal: Math.round(overdueInvoiceTotal),
      outstandingTotal: Math.round(outstandingInvoiceTotal),
      dueWithin30Days: upcomingInvoicesDue,
    },
    pendingPurchaseOrderApprovals: {
      count: pendingPurchaseOrders._count,
      totalAmount: pendingPurchaseOrders._sum.totalAmount ?? 0,
    },
    payrollLast30Days: {
      grossPay: Math.round(payrollLast30Days.grossPay),
      netPay: Math.round(payrollLast30Days.netPay),
      deductions: Math.round(payrollLast30Days.deductions),
      workerCount: new Set(recentPayslips.map((p) => p.workerId)).size,
    },
  };
}

async function buildComplianceOfficerContext(mineId: string) {
  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 86400000);

  const [
    mine,
    { score: overallScore, breakdown },
    openRegulatoryNotices,
    escalatedRiskAssessments,
    overdueLegalItems,
    dueSoonLegalItems,
    openAuditFindings,
    criticalAuditFindings,
    openHazardReports,
    criticalHazardReports,
    overdueMedicalExams,
    unfitOrRestrictedWorkers,
    vacantStatutoryAppointments,
    openIodClaims,
    permitsExpiringWithin30Days,
    contractorsExpiringWithin30Days,
    expiredContractors,
    explosivesLicensesExpiringWithin30Days,
    rehabPlansNeedingAssessment,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    computeComplianceScore(mineId),
    prisma.regulatoryNotice.count({ where: { status: "OPEN", site: { mineId } } }),
    prisma.riskAssessment.count({ where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.legalComplianceItem.count({ where: { status: "OVERDUE", site: { mineId } } }),
    prisma.legalComplianceItem.count({ where: { status: "DUE", site: { mineId } } }),
    prisma.auditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.auditFinding.count({ where: { severity: "CRITICAL", status: { notIn: ["CLOSED", "VERIFIED"] }, site: { mineId } } }),
    prisma.hazardReport.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.hazardReport.count({ where: { riskLevel: "CRITICAL", status: { not: "CLOSED" }, site: { mineId } } }),
    prisma.medicalSurveillance.count({ where: { nextExamDue: { lt: now }, worker: { site: { mineId } } } }),
    prisma.medicalSurveillance.count({ where: { result: { in: ["UNFIT", "TEMPORARILY_UNFIT"] }, worker: { site: { mineId } } } }),
    prisma.statutoryAppointment.count({ where: { status: "VACANT", site: { mineId } } }),
    prisma.iodClaim.count({ where: { status: { in: ["REPORTED", "SUBMITTED", "UNDER_ASSESSMENT"] }, worker: { site: { mineId } } } }),
    prisma.permit.count({ where: { status: "ACTIVE", site: { mineId }, expiryDate: { lte: in30Days } } }),
    prisma.contractor.count({
      where: { status: "ACTIVE", site: { mineId }, OR: [{ goodStandingExpiry: { lte: in30Days } }, { insuranceExpiry: { lte: in30Days } }] },
    }),
    prisma.contractor.count({ where: { status: "EXPIRED", site: { mineId } } }),
    prisma.explosivesMagazine.count({ where: { status: "ACTIVE", site: { mineId }, licenseExpiry: { lte: in30Days } } }),
    prisma.closureRehabilitationPlan.count({ where: { site: { mineId }, nextAssessmentDue: { lte: now } } }),
  ]);

  return {
    mine: { name: mine?.name ?? "the mine" },
    overallComplianceScorePct: overallScore,
    complianceBreakdown: breakdown,
    openRegulatoryNotices,
    escalatedUnresolvedRiskAssessments: escalatedRiskAssessments,
    legalComplianceItems: { overdue: overdueLegalItems, dueSoon: dueSoonLegalItems },
    auditFindings: { open: openAuditFindings, criticalUnresolved: criticalAuditFindings },
    hazardReports: { open: openHazardReports, criticalUnresolved: criticalHazardReports },
    medicalSurveillance: { overdueExams: overdueMedicalExams, unfitOrRestrictedWorkers },
    statutoryAppointments: { vacantPosts: vacantStatutoryAppointments },
    iodClaims: { open: openIodClaims },
    permitsExpiringWithin30Days,
    contractors: { complianceDocsExpiringWithin30Days: contractorsExpiringWithin30Days, expired: expiredContractors },
    explosivesLicensesExpiringWithin30Days,
    closureRehabilitationPlansNeedingAssessment: rehabPlansNeedingAssessment,
  };
}

// Guardrail applied to every title's prompt, both chat and the pipeline summary below —
// the AI is structurally advisory-only (see AiRecommendation in schema.prisma: it can
// create rows, but only a human review endpoint can ever change their status).
const GUARDRAIL =
  ` You are strictly advisory. You never state or imply that you have made, finalized, executed, approved, or ` +
  `authorized any decision — especially anything safety-critical, legal, disciplinary, employment-related, ` +
  `financial-authorisation, or security-related. Every risk, prediction, or recommendation you produce is for a ` +
  `human to review, acknowledge, act on, or dismiss — you never take or claim to take the action yourself.`;

const BASE_SYSTEM_PROMPT = (mineName: string, roleTitle: string) =>
  `You are the Mine Guard AI Assistant, advising the ${roleTitle} of ${mineName}, a South African mining operation. ` +
  `Base every answer strictly on the JSON data snapshot provided in this conversation — never invent figures or names. ` +
  `If the data doesn't cover something asked, say so plainly. Keep answers concise and written for a busy executive: ` +
  `short paragraphs or bullet points, leading with the most urgent or actionable item.` +
  GUARDRAIL;

const AI_MODULES: Record<string, AiModule> = {
  GENERAL_MANAGER: {
    buildContext: buildGeneralManagerContext,
    systemPrompt: (ctx) => BASE_SYSTEM_PROMPT(ctx.mine.name, "General Manager"),
  },
  HR_MANAGER: {
    buildContext: buildHrManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "HR Manager") +
      ` Focus on workforce composition, leave, new hires, certificate/training expiries, and labour relations case load ` +
      `(disciplinary cases, grievances, CCMA referrals) — this is an HR-specific assistant, not a general operations one.`,
  },
  CFO: {
    buildContext: buildCfoContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "CFO") +
      ` Focus on financial performance (earnings, expenses, net margin), cost centres, cash owed to and by the mine ` +
      `(overdue/outstanding invoices), approvals awaiting action (pending expenses, pending purchase orders), and ` +
      `payroll cost — this is a finance-specific assistant, not a general operations one. All monetary figures are in ZAR.`,
  },
  COMPLIANCE_OFFICER: {
    buildContext: buildComplianceOfficerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Compliance Officer") +
      ` Cover the full statutory/regulatory compliance picture under the MHSA and related South African mining law: ` +
      `overall compliance score and its breakdown (codes of practice, risk assessments, permits, safety inspections, ` +
      `certificates, training records, contractors), regulatory notices, escalated risk assessments, legal compliance ` +
      `calendar items, audit findings, hazard reports, medical surveillance (overdue exams, unfit/restricted workers), ` +
      `vacant statutory appointments, IOD claims, permits/contractor documents/explosives licenses expiring soon, and ` +
      `closure & rehabilitation plans due for reassessment. Always name which specific compliance area is driving any ` +
      `risk you flag, not just an overall score.`,
  },
};

/** Extend this list as each executive's AI module is built out (see AI_MODULES above). */
const AI_ENABLED_TITLES = Object.keys(AI_MODULES) as ExecutiveTitle[];

async function resolveAiModule(req: any, res: any): Promise<{ title: ExecutiveTitle; module: AiModule } | null> {
  let title: ExecutiveTitle | null = null;
  if (req.auth!.role === "ADMIN") {
    title = "GENERAL_MANAGER";
  } else {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    if (me?.title && AI_ENABLED_TITLES.includes(me.title)) title = me.title;
  }
  if (!title) {
    res.status(403).json({ error: "The AI assistant isn't available for your role yet" });
    return null;
  }
  return { title, module: AI_MODULES[title] };
}

// The Mining Intelligence Engine pipeline: OBSERVER (context builder above) -> ANALYST ->
// RISK DETECTOR -> PREDICTOR -> ADVISOR all happen inside one model call, constrained to
// return structured JSON so each flagged item can become a tracked AiRecommendation row.
// ACTION TRACKER is deliberately NOT something the AI does — it's the human review loop
// below (PUT /recommendations/:id), which is the only thing that can ever change a row's
// status. The AI can propose; only a person can close something out.
const PIPELINE_INSTRUCTIONS =
  `Run the following pipeline over the data snapshot below:\n` +
  `1. ANALYST — identify meaningful patterns or trends in the data.\n` +
  `2. RISK DETECTOR — flag concrete risks, each with a severity (LOW/MEDIUM/HIGH/CRITICAL).\n` +
  `3. PREDICTOR — for each risk, project the likely near-term trajectory (days/weeks) if left unaddressed, grounded only in the given data.\n` +
  `4. ADVISOR — recommend specific, concrete actions a human should consider.\n\n` +
  `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
  `{"summary": "3-5 sentence plain-language overview, most urgent first", ` +
  `"items": [{"kind": "RISK" | "PREDICTION" | "RECOMMENDATION", "title": "short headline under 12 words", ` +
  `"detail": "1-2 sentence explanation grounded in the data snapshot", "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}]}\n` +
  `Include at most 8 items, ordered by severity descending. If nothing is notable, return an empty items array and say so in the summary.`;

interface PipelineItem {
  kind: "RISK" | "PREDICTION" | "RECOMMENDATION";
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
interface PipelineResult {
  summary: string;
  items: PipelineItem[];
}

const VALID_KINDS = new Set(["RISK", "PREDICTION", "RECOMMENDATION"]);
const VALID_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// The model is instructed to return bare JSON, but LLMs sometimes wrap it in a markdown
// fence anyway — stripped defensively rather than failing the whole pipeline over it.
function parsePipelineResult(raw: string): PipelineResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.items)) {
    throw new Error("AI response did not match the expected pipeline schema");
  }
  const items: PipelineItem[] = parsed.items
    .filter((it: any) => it && typeof it.title === "string" && typeof it.detail === "string")
    .slice(0, 8)
    .map((it: any) => ({
      kind: VALID_KINDS.has(it.kind) ? it.kind : "RECOMMENDATION",
      title: String(it.title).slice(0, 200),
      detail: String(it.detail).slice(0, 2000),
      severity: VALID_SEVERITIES.has(it.severity) ? it.severity : "MEDIUM",
    }));
  return { summary: parsed.summary, items };
}

// Skips items that already have an open (OPEN/ACKNOWLEDGED) recommendation with the same
// title for this mine/title, so re-running the pipeline on every dashboard load doesn't
// spam duplicate rows for a risk that's already been surfaced and is awaiting review.
async function persistNewRecommendations(mineId: string, executiveTitle: ExecutiveTitle, items: PipelineItem[]) {
  for (const item of items) {
    const existing = await prisma.aiRecommendation.findFirst({
      where: { mineId, executiveTitle, title: item.title, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.aiRecommendation.create({
      data: { mineId, executiveTitle, kind: item.kind, severity: item.severity, title: item.title, detail: item.detail },
    });
  }
}

router.get("/summary", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  if (!isAiConfigured()) {
    return res.json({ configured: false, summary: null, generatedAt: null });
  }

  try {
    const context = await resolved.module.buildContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: resolved.module.systemPrompt(context) },
      { role: "system", content: `Current data snapshot (JSON): ${JSON.stringify(context)}` },
      { role: "user", content: PIPELINE_INSTRUCTIONS },
    ];
    const raw = await aiChatComplete(messages);

    let pipeline: PipelineResult;
    try {
      pipeline = parsePipelineResult(raw);
    } catch {
      // Model didn't follow the JSON contract this time — fall back to showing its raw
      // reply as the summary rather than failing the request; nothing gets tracked this round.
      pipeline = { summary: raw, items: [] };
    }

    if (pipeline.items.length > 0) {
      await persistNewRecommendations(mineId, resolved.title, pipeline.items);
    }

    res.json({ configured: true, summary: pipeline.summary, generatedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, summary: null, generatedAt: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

router.get("/recommendations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  const statusParam = req.query.status as string | undefined;
  const statusFilter =
    statusParam && ["OPEN", "ACKNOWLEDGED", "ACTIONED", "DISMISSED"].includes(statusParam) ? (statusParam as any) : undefined;

  const recommendations = await prisma.aiRecommendation.findMany({
    where: { mineId, executiveTitle: resolved.title, status: statusFilter },
    include: { reviewedBy: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { generatedAt: "desc" }],
    take: 50,
  });
  res.json(recommendations);
});

const reviewSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "ACTIONED", "DISMISSED"]),
  reviewNote: z.string().max(1000).optional(),
});

// The only place an AiRecommendation's status can ever change — always a human, identified
// by their own auth session, never the AI itself. This is what makes "AI recommends, human
// decides" a structural guarantee rather than just a prompt instruction.
router.put("/recommendations/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid review payload" });
  }

  const existing = await prisma.aiRecommendation.findFirst({
    where: { id: req.params.id, mineId, executiveTitle: resolved.title },
  });
  if (!existing) {
    return res.status(404).json({ error: "Recommendation not found" });
  }

  const updated = await prisma.aiRecommendation.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote || null,
      reviewedById: req.auth!.userId,
      reviewedAt: new Date(),
    },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });
  res.json(updated);
});

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

router.post("/chat", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chat payload" });
  }
  if (parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user" });
  }

  if (!isAiConfigured()) {
    return res.json({ configured: false, reply: null });
  }

  try {
    const context = await resolved.module.buildContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: resolved.module.systemPrompt(context) },
      { role: "system", content: `Current data snapshot (JSON): ${JSON.stringify(context)}` },
      ...parsed.data.messages,
    ];
    const reply = await aiChatComplete(messages);
    res.json({ configured: true, reply });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, reply: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
