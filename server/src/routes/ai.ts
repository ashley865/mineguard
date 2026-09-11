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
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const currentYear = new Date().getFullYear();

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
    equityTargets,
    latestSkillsPlan,
    approvedLeaveLast30Days,
    approvedLeavePrior30Days,
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
    prisma.employmentEquityTarget.findMany({
      where: { mineId, reportingYear: { gte: currentYear - 1 } },
      select: { reportingYear: true, occupationalLevel: true, designatedGroup: true, targetPercent: true, actualHeadcount: true, totalHeadcountAtLevel: true },
      orderBy: { reportingYear: "desc" },
    }),
    prisma.workplaceSkillsPlan.findFirst({
      where: { mineId },
      orderBy: { planYear: "desc" },
      select: { planYear: true, status: true, submittedDate: true, atrSubmittedDate: true, levyPayable: true, levyGrantClaimed: true },
    }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { gte: thirtyDaysAgo } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
  ]);

  const latestEquityYear = equityTargets[0]?.reportingYear;
  const latestEquityTargets = equityTargets.filter((t) => t.reportingYear === latestEquityYear);
  const equityGaps = latestEquityTargets.filter((t) => {
    const actualPct = t.totalHeadcountAtLevel === 0 ? 0 : (t.actualHeadcount / t.totalHeadcountAtLevel) * 100;
    return actualPct < t.targetPercent;
  }).length;

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
    leave: {
      pendingRequests: pendingLeaveRequests,
      onLeaveToday,
      approvedLast30Days: approvedLeaveLast30Days,
      approvedPrior30Days: approvedLeavePrior30Days,
    },
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
    skillsDevelopment: {
      activeLearnerships,
      workplaceSkillsPlan: latestSkillsPlan
        ? {
            planYear: latestSkillsPlan.planYear,
            status: latestSkillsPlan.status,
            submitted: !!latestSkillsPlan.submittedDate,
            annualTrainingReportSubmitted: !!latestSkillsPlan.atrSubmittedDate,
            levyPayable: latestSkillsPlan.levyPayable,
            levyGrantClaimed: latestSkillsPlan.levyGrantClaimed,
          }
        : null,
    },
    employmentEquity:
      latestEquityYear === undefined
        ? null
        : {
            reportingYear: latestEquityYear,
            targetsBelowGoal: equityGaps,
            totalTargetsTracked: latestEquityTargets.length,
          },
  };
}

async function buildCfoContext(mineId: string) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setDate(1);
  threeMonthsAgo.setHours(0, 0, 0, 0);

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
    activeBudgetPlans,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.invoice.findMany({
      where: { site: { mineId }, status: "PAID", issueDate: { gte: sixMonthsAgo } },
      select: { vatRate: true, issueDate: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PAID", expenseDate: { gte: sixMonthsAgo } },
      select: { amount: true, category: true, expenseDate: true },
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
    prisma.budgetPlan.findMany({
      where: { mineId, periodStart: { lte: now }, periodEnd: { gte: now } },
      select: { category: true, siteId: true, periodStart: true, periodEnd: true, budgetedAmount: true },
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

  // Trailing 3-month net cash flow, approximated from paid invoices/expenses already
  // fetched for the 6-month summary above — a lightweight echo of the dedicated Cash Flow
  // Forecast module's own (more thorough) monthly projection, not a replacement for it.
  let netCashFlowLast3Months = 0;
  for (const inv of paidInvoices) {
    if (inv.issueDate >= threeMonthsAgo) {
      const subtotal = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
      netCashFlowLast3Months += subtotal * (1 + inv.vatRate / 100);
    }
  }
  for (const e of paidExpensesLast6Months) {
    if (e.expenseDate >= threeMonthsAgo) netCashFlowLast3Months -= e.amount;
  }
  const accountsPayable = (pendingExpenses._sum.amount ?? 0) + (pendingPurchaseOrders._sum.totalAmount ?? 0);

  // Budget variance for plans covering the current date — over-budget categories only,
  // since those are what a CFO needs flagged; under-budget is not actionable.
  const budgetVariances = await Promise.all(
    activeBudgetPlans.map(async (plan) => {
      const actual = await prisma.expense.aggregate({
        where: {
          category: plan.category,
          expenseDate: { gte: plan.periodStart, lte: plan.periodEnd },
          site: { mineId, id: plan.siteId || undefined },
        },
        _sum: { amount: true },
      });
      return { category: plan.category, budgetedAmount: plan.budgetedAmount, actualAmount: actual._sum.amount ?? 0 };
    })
  );
  const overBudgetCategories = budgetVariances
    .filter((b) => b.actualAmount > b.budgetedAmount)
    .sort((a, b) => (b.actualAmount - b.budgetedAmount) - (a.actualAmount - a.budgetedAmount))
    .slice(0, 5)
    .map((b) => ({
      category: b.category,
      budgetedAmount: Math.round(b.budgetedAmount),
      actualAmount: Math.round(b.actualAmount),
      overage: Math.round(b.actualAmount - b.budgetedAmount),
    }));

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
    budgetVariance: {
      activePlanCount: activeBudgetPlans.length,
      overBudgetCategories,
    },
    cashFlowSnapshot: {
      avgMonthlyNetCashFlowLast3Months: Math.round(netCashFlowLast3Months / 3),
      accountsReceivable: Math.round(outstandingInvoiceTotal),
      accountsPayable: Math.round(accountsPayable),
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

async function buildOperationsManagerContext(mineId: string) {
  const now = new Date();
  const recentStart = new Date(Date.now() - 14 * 86400000);
  const priorStart = new Date(Date.now() - 28 * 86400000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    mine,
    recentProduction,
    priorProduction,
    totalEquipment,
    downEquipment,
    maintenanceEquipment,
    recentMaintenance,
    overdueMaintenance,
    totalWorkers,
    onShiftWorkers,
    onLeaveToday,
    recentWeather,
    recentIncidents,
    recentHazards,
    lowStockItems,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.productionRecord.findMany({
      where: { site: { mineId }, shiftDate: { gte: recentStart } },
      select: { tonnesMined: true, targetTonnes: true },
    }),
    prisma.productionRecord.findMany({
      where: { site: { mineId }, shiftDate: { gte: priorStart, lt: recentStart } },
      select: { tonnesMined: true },
    }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { status: "DOWN", site: { mineId } } }),
    prisma.equipment.count({ where: { status: "MAINTENANCE", site: { mineId } } }),
    prisma.maintenanceSchedule.findMany({
      where: { equipment: { site: { mineId } }, scheduledDate: { gte: recentStart } },
      select: { status: true, downtimeMinutes: true, downtimeReason: true, maintenanceType: true },
    }),
    prisma.maintenanceSchedule.count({ where: { equipment: { site: { mineId } }, status: "OVERDUE" } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
    }),
    prisma.weatherReading.findMany({
      where: { site: { mineId }, recordedAt: { gte: recentStart } },
      select: { condition: true, alertIssued: true, windSpeed: true, precipitation: true },
    }),
    prisma.incident.findMany({
      where: { site: { mineId }, createdAt: { gte: recentStart } },
      select: { severity: true, status: true },
    }),
    prisma.hazardReport.count({ where: { site: { mineId }, createdAt: { gte: recentStart } } }),
    prisma.inventoryItem.findMany({
      where: { site: { mineId }, reorderPoint: { not: null } },
      select: { quantityOnHand: true, reorderPoint: true },
    }),
  ]);

  const lowStockCount = lowStockItems.filter((i) => i.quantityOnHand <= (i.reorderPoint ?? 0)).length;

  const recentTonnes = recentProduction.reduce((sum, r) => sum + r.tonnesMined, 0);
  const priorTonnes = priorProduction.reduce((sum, r) => sum + r.tonnesMined, 0);
  const productionChangePct = priorTonnes === 0 ? null : Math.round(((recentTonnes - priorTonnes) / priorTonnes) * 1000) / 10;

  const targetTotal = recentProduction.reduce((sum, r) => sum + (r.targetTonnes ?? 0), 0);
  const targetAttainmentPct = targetTotal === 0 ? null : Math.round((recentTonnes / targetTotal) * 1000) / 10;

  const downtimeByReason: Record<string, number> = {};
  let totalDowntimeMinutes = 0;
  let delayedMaintenanceCount = 0;
  for (const m of recentMaintenance) {
    if (m.downtimeMinutes) {
      totalDowntimeMinutes += m.downtimeMinutes;
      const reason = m.downtimeReason?.trim() || "Unspecified";
      downtimeByReason[reason] = (downtimeByReason[reason] ?? 0) + m.downtimeMinutes;
    }
    if (m.status === "SCHEDULED" && m.maintenanceType !== "EMERGENCY") delayedMaintenanceCount += 1;
  }
  const topDowntimeReasons = Object.entries(downtimeByReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, minutes]) => ({ reason, minutes: Math.round(minutes) }));

  const weatherDisruptiveDays = recentWeather.filter(
    (w) => w.alertIssued || w.condition === "STORM" || w.condition === "HIGH_WIND" || w.condition === "FOG"
  ).length;

  const incidentSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const i of recentIncidents) incidentSeverity[i.severity] += 1;

  return {
    mine: { name: mine?.name ?? "the mine" },
    productionLast14Days: {
      tonnesMined: Math.round(recentTonnes),
      changeVsPrior14DaysPct: productionChangePct,
      targetAttainmentPct,
      recordCount: recentProduction.length,
    },
    equipment: {
      total: totalEquipment,
      down: downEquipment,
      inMaintenance: maintenanceEquipment,
      availabilityPct: totalEquipment === 0 ? 100 : Math.round(((totalEquipment - downEquipment) / totalEquipment) * 1000) / 10,
    },
    maintenanceLast14Days: {
      totalDowntimeMinutes: Math.round(totalDowntimeMinutes),
      topDowntimeReasons,
      overdueMaintenanceItems: overdueMaintenance,
      delayedScheduledMaintenance: delayedMaintenanceCount,
      recordCount: recentMaintenance.length,
    },
    workforce: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      onApprovedLeaveToday: onLeaveToday,
    },
    weatherLast14Days: {
      readingsRecorded: recentWeather.length,
      disruptiveConditionDays: weatherDisruptiveDays,
      dataAvailable: recentWeather.length > 0,
    },
    operationalEventsLast14Days: { incidentsBySeverity: incidentSeverity, hazardReportsLogged: recentHazards },
    supplyChain: { itemsAtOrBelowReorderPoint: lowStockCount },
  };
}

// Distinct from both the General Manager (strategic, mine-wide) and Operations Manager
// (production root-cause deep dive): the COO's lens is day-to-day execution across
// departments — is the operation running, is it safe, is cross-department work flowing.
async function buildCooContext(mineId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);

  const [
    mine,
    sitesByStatus,
    openIncidentsBySeverity,
    openHazards,
    safetyInspectionsCompleted,
    safetyInspectionsTotal,
    recentProduction,
    totalWorkers,
    onShiftWorkers,
    pendingLeaveRequests,
    totalEquipment,
    downEquipment,
    overdueMaintenance,
    pendingPermitsToWork,
    escalatedRiskAssessments,
    activeContractors,
    contractorsExpiringSoon,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.site.groupBy({ by: ["status"], _count: true, where: { mineId } }),
    prisma.incident.groupBy({ by: ["severity"], where: { status: { in: ["OPEN", "INVESTIGATING"] }, site: { mineId } }, _count: true }),
    prisma.hazardReport.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.safetyInspection.count({ where: { status: "COMPLETED", site: { mineId } } }),
    prisma.safetyInspection.count({ where: { site: { mineId } } }),
    prisma.productionRecord.findMany({
      where: { site: { mineId }, shiftDate: { gte: sevenDaysAgo } },
      select: { tonnesMined: true, targetTonnes: true },
    }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { status: "DOWN", site: { mineId } } }),
    prisma.maintenanceSchedule.count({ where: { equipment: { site: { mineId } }, status: "OVERDUE" } }),
    prisma.permitToWork.count({ where: { status: "PENDING_EXECUTIVE", site: { mineId } } }),
    prisma.riskAssessment.count({ where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.contractor.count({ where: { status: "ACTIVE", site: { mineId } } }),
    prisma.contractor.count({
      where: { status: "ACTIVE", site: { mineId }, OR: [{ goodStandingExpiry: { lte: in30Days } }, { insuranceExpiry: { lte: in30Days } }] },
    }),
  ]);

  const incidentSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openIncidentsBySeverity) incidentSeverity[row.severity] = row._count;

  const siteStatus = { OPERATIONAL: 0, RESTRICTED: 0, SHUT_DOWN: 0 } as Record<string, number>;
  for (const row of sitesByStatus) siteStatus[row.status] = row._count;

  const tonnesMined = recentProduction.reduce((sum, r) => sum + r.tonnesMined, 0);
  const targetTonnes = recentProduction.reduce((sum, r) => sum + (r.targetTonnes ?? 0), 0);

  return {
    mine: { name: mine?.name ?? "the mine" },
    sites: siteStatus,
    safety: {
      openIncidentsBySeverity: incidentSeverity,
      openHazardReports: openHazards,
      safetyInspectionCompletionPct:
        safetyInspectionsTotal === 0 ? 100 : Math.round((safetyInspectionsCompleted / safetyInspectionsTotal) * 1000) / 10,
    },
    productionLast7Days: {
      tonnesMined: Math.round(tonnesMined),
      targetAttainmentPct: targetTonnes === 0 ? null : Math.round((tonnesMined / targetTonnes) * 1000) / 10,
    },
    workforce: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      pendingLeaveRequests,
    },
    equipment: {
      total: totalEquipment,
      down: downEquipment,
      availabilityPct: totalEquipment === 0 ? 100 : Math.round(((totalEquipment - downEquipment) / totalEquipment) * 1000) / 10,
      overdueMaintenanceItems: overdueMaintenance,
    },
    crossDepartmentCoordination: {
      permitsToWorkPendingExecutiveApproval: pendingPermitsToWork,
      escalatedUnresolvedRiskAssessments: escalatedRiskAssessments,
    },
    contractors: { active: activeContractors, complianceDocsExpiringWithin30Days: contractorsExpiringSoon },
  };
}

async function buildSecurityManagerContext(mineId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    mine,
    incidentsBySeverity,
    incidentsByCategory,
    openIncidents,
    camerasByStatus,
    camerasTotal,
    patrolsCompleted,
    patrolsScheduled,
    patrolsMissed,
    visitorsCheckedIn,
    pendingVisitorApprovals,
    guardObservationsByCategory,
    pendingPermitsToWork,
    suspendedExplosivesMagazines,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.securityIncident.groupBy({ by: ["severity"], where: { occurredAt: { gte: sevenDaysAgo }, site: { mineId } }, _count: true }),
    prisma.securityIncident.groupBy({ by: ["category"], where: { occurredAt: { gte: sevenDaysAgo }, site: { mineId } }, _count: true }),
    prisma.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] }, site: { mineId } } }),
    prisma.securityCamera.groupBy({ by: ["status"], where: { site: { mineId } }, _count: true }),
    prisma.securityCamera.count({ where: { site: { mineId } } }),
    prisma.patrolAssignment.count({ where: { status: "COMPLETED", shiftDate: { gte: sevenDaysAgo }, site: { mineId } } }),
    prisma.patrolAssignment.count({ where: { shiftDate: { gte: sevenDaysAgo }, site: { mineId } } }),
    prisma.patrolAssignment.count({ where: { status: "MISSED", shiftDate: { gte: sevenDaysAgo }, site: { mineId } } }),
    prisma.visitor.count({ where: { status: "CHECKED_IN", site: { mineId } } }),
    prisma.visitor.count({ where: { status: "PENDING_APPROVAL", site: { mineId } } }),
    prisma.patrolLogEntry.groupBy({
      by: ["category"],
      where: { category: { not: null }, loggedAt: { gte: sevenDaysAgo }, site: { mineId } },
      _count: true,
    }),
    prisma.permitToWork.count({ where: { status: "PENDING_EXECUTIVE", site: { mineId } } }),
    prisma.explosivesMagazine.count({ where: { status: "SUSPENDED", site: { mineId } } }),
  ]);

  const incidentSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of incidentsBySeverity) incidentSeverity[row.severity] = row._count;

  const incidentCategory: Record<string, number> = {};
  for (const row of incidentsByCategory) incidentCategory[row.category] = row._count;

  const cameraStatus = { ONLINE: 0, OFFLINE: 0, MAINTENANCE: 0, DECOMMISSIONED: 0 } as Record<string, number>;
  for (const row of camerasByStatus) cameraStatus[row.status] = row._count;

  const observationCategory: Record<string, number> = {};
  for (const row of guardObservationsByCategory) if (row.category) observationCategory[row.category] = row._count;

  return {
    mine: { name: mine?.name ?? "the mine" },
    incidentsLast7Days: { bySeverity: incidentSeverity, byCategory: incidentCategory, open: openIncidents },
    cctv: {
      total: camerasTotal,
      byStatus: cameraStatus,
      onlinePct: camerasTotal === 0 ? 100 : Math.round((cameraStatus.ONLINE / camerasTotal) * 1000) / 10,
    },
    patrolsLast7Days: {
      completed: patrolsCompleted,
      scheduled: patrolsScheduled,
      missed: patrolsMissed,
      completionPct: patrolsScheduled === 0 ? 100 : Math.round((patrolsCompleted / patrolsScheduled) * 1000) / 10,
    },
    visitors: { checkedInNow: visitorsCheckedIn, pendingApproval: pendingVisitorApprovals },
    guardObservationsLast7DaysByCategory: observationCategory,
    permitsToWorkPendingExecutiveApproval: pendingPermitsToWork,
    suspendedExplosivesMagazines,
  };
}

async function buildSafetyManagerContext(mineId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    mine,
    incidentsBySeverity,
    openHazardsByRisk,
    overdueHazards,
    safetyInspectionsCompleted,
    safetyInspectionsTotal,
    overdueMedicalExams,
    unfitOrRestrictedWorkers,
    occupationalDiseaseFlags,
    activeEmergencyEvents,
    refugeBaysOverdueInspection,
    baSetsNotServiceable,
    activeRescueTeamMembers,
    ventilationReadingsOutOfRequirement,
    escalatedRiskAssessments,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.incident.groupBy({ by: ["severity"], where: { status: { in: ["OPEN", "INVESTIGATING"] }, site: { mineId } }, _count: true }),
    prisma.hazardReport.groupBy({ by: ["riskLevel"], where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } }, _count: true }),
    prisma.hazardReport.count({ where: { status: "OVERDUE", site: { mineId } } }),
    prisma.safetyInspection.count({ where: { status: "COMPLETED", scheduledDate: { gte: sevenDaysAgo }, site: { mineId } } }),
    prisma.safetyInspection.count({ where: { scheduledDate: { gte: sevenDaysAgo }, site: { mineId } } }),
    prisma.medicalSurveillance.count({ where: { nextExamDue: { lt: now }, worker: { site: { mineId } } } }),
    prisma.medicalSurveillance.count({ where: { result: { in: ["UNFIT", "TEMPORARILY_UNFIT"] }, worker: { site: { mineId } } } }),
    prisma.medicalSurveillance.count({ where: { diseaseClassification: { not: "NONE" }, worker: { site: { mineId } } } }),
    prisma.emergencyEvent.count({ where: { status: { in: ["ACTIVE", "RESPONDING", "CONTAINED"] }, site: { mineId } } }),
    prisma.refugeBay.count({ where: { nextInspectionDue: { lt: now }, site: { mineId } } }),
    prisma.breathingApparatusSet.count({ where: { status: { in: ["OUT_OF_SERVICE", "DUE_FOR_SERVICE"] }, site: { mineId } } }),
    prisma.rescueTeamMember.count({ where: { status: "ACTIVE", site: { mineId } } }),
    prisma.ventilationReading.count({ where: { withinRequirement: false, readingDate: { gte: sevenDaysAgo }, district: { site: { mineId } } } }),
    prisma.riskAssessment.count({ where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
  ]);

  const incidentSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of incidentsBySeverity) incidentSeverity[row.severity] = row._count;

  const hazardRisk = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openHazardsByRisk) hazardRisk[row.riskLevel] = row._count;

  return {
    mine: { name: mine?.name ?? "the mine" },
    incidents: { openBySeverity: incidentSeverity },
    hazardReports: { openByRiskLevel: hazardRisk, overdue: overdueHazards },
    safetyInspectionsLast7Days: {
      completed: safetyInspectionsCompleted,
      total: safetyInspectionsTotal,
      completionPct: safetyInspectionsTotal === 0 ? 100 : Math.round((safetyInspectionsCompleted / safetyInspectionsTotal) * 1000) / 10,
    },
    medicalSurveillance: { overdueExams: overdueMedicalExams, unfitOrRestrictedWorkers, occupationalDiseaseFlags },
    emergencyPreparedness: {
      activeEmergencyEvents,
      refugeBaysOverdueInspection,
      breathingApparatusSetsNeedingService: baSetsNotServiceable,
      activeRescueTeamMembers,
    },
    ventilationReadingsOutOfRequirementLast7Days: ventilationReadingsOutOfRequirement,
    escalatedUnresolvedRiskAssessments: escalatedRiskAssessments,
  };
}

async function buildItManagerContext(mineId: string) {
  const in90Days = new Date(Date.now() + 90 * 86400000);

  const [
    mine,
    sensorsByInstallationStatus,
    sensorsByStatus,
    totalSensors,
    camerasByIntegrationStatus,
    totalUsers,
    inactiveUsers,
    pendingExecutiveInvites,
    assetsByStatus,
    openTickets,
    urgentOpenTickets,
    licenses,
    backupRecords,
    openIncidents,
    unresolvedCriticalIncidents,
    plannedChanges,
    openHighRiskChanges,
    vendorContracts,
    pendingAccessRequests,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.sensor.groupBy({ by: ["installationStatus"], where: { zone: { site: { mineId } } }, _count: true }),
    prisma.sensor.groupBy({ by: ["status"], where: { zone: { site: { mineId } } }, _count: true }),
    prisma.sensor.count({ where: { zone: { site: { mineId } } } }),
    prisma.securityCamera.groupBy({ by: ["integrationStatus"], where: { site: { mineId } }, _count: true }),
    prisma.user.count({ where: { mineId } }),
    prisma.user.count({ where: { mineId, isActive: false } }),
    prisma.executiveInvite.count({ where: { mineId, status: "PENDING" } }),
    prisma.iTAsset.groupBy({ by: ["status"], where: { mineId }, _count: true }),
    prisma.iTTicket.count({ where: { mineId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.iTTicket.count({ where: { mineId, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "URGENT" } }),
    prisma.iTSoftwareLicense.findMany({ where: { mineId, status: "ACTIVE" }, select: { productName: true, seatsTotal: true, seatsUsed: true, renewalDate: true } }),
    prisma.iTBackupRecord.findMany({ where: { mineId }, select: { systemName: true, lastRunStatus: true, lastDrTestResult: true } }),
    prisma.iTSecurityIncident.count({ where: { mineId, status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.iTSecurityIncident.count({ where: { mineId, severity: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.iTChangeRequest.count({ where: { mineId, status: "PLANNED" } }),
    prisma.iTChangeRequest.count({ where: { mineId, riskLevel: "HIGH", status: { in: ["PLANNED", "APPROVED", "IN_PROGRESS"] } } }),
    prisma.iTVendorContract.findMany({ where: { mineId, status: "ACTIVE" }, select: { vendorName: true, annualCost: true, renewalDate: true } }),
    prisma.iTAccessRequest.count({ where: { mineId, status: "REQUESTED" } }),
  ]);

  const installStatus = { REQUESTED: 0, SCHEDULED: 0, INSTALLED: 0, COMMISSIONED: 0 } as Record<string, number>;
  for (const row of sensorsByInstallationStatus) installStatus[row.installationStatus] = row._count;

  const sensorStatus = { ACTIVE: 0, INACTIVE: 0, FAULT: 0 } as Record<string, number>;
  for (const row of sensorsByStatus) sensorStatus[row.status] = row._count;

  const integrationStatus = { CONNECTED: 0, DISCONNECTED: 0, PENDING: 0, NOT_APPLICABLE: 0 } as Record<string, number>;
  for (const row of camerasByIntegrationStatus) integrationStatus[row.integrationStatus] = row._count;

  const assetStatus = { ACTIVE: 0, IN_REPAIR: 0, RETIRED: 0, LOST: 0 } as Record<string, number>;
  for (const row of assetsByStatus) assetStatus[row.status] = row._count;

  const licensesExpiringSoon = licenses.filter((l) => l.renewalDate && l.renewalDate <= in90Days).map((l) => l.productName);
  const overAllocatedLicenses = licenses.filter((l) => l.seatsUsed > l.seatsTotal).map((l) => l.productName);
  const failedBackups = backupRecords.filter((b) => b.lastRunStatus === "FAILED").map((b) => b.systemName);
  const untestedDrSystems = backupRecords.filter((b) => b.lastDrTestResult === "NOT_TESTED").map((b) => b.systemName);
  const vendorContractsExpiringSoon = vendorContracts.filter((v) => v.renewalDate && v.renewalDate <= in90Days).map((v) => v.vendorName);
  const totalActiveVendorSpend = vendorContracts.reduce((sum, v) => sum + (v.annualCost ?? 0), 0);

  return {
    mine: { name: mine?.name ?? "the mine" },
    sensors: { total: totalSensors, byInstallationStatus: installStatus, byOperationalStatus: sensorStatus },
    cctvVmsIntegration: { byStatus: integrationStatus },
    userAccounts: { total: totalUsers, deactivated: inactiveUsers, pendingExecutiveInvites },
    itAssets: { byStatus: assetStatus },
    supportTickets: { openOrInProgress: openTickets, urgentOpen: urgentOpenTickets },
    softwareLicenses: { activeCount: licenses.length, expiringSoon: licensesExpiringSoon, overAllocated: overAllocatedLicenses },
    backups: { totalSystems: backupRecords.length, failedLastRun: failedBackups, drNotTested: untestedDrSystems },
    securityIncidents: { openOrInvestigating: openIncidents, unresolvedCritical: unresolvedCriticalIncidents },
    changeRequests: { planned: plannedChanges, openHighRisk: openHighRiskChanges },
    vendorContracts: { activeCount: vendorContracts.length, expiringSoon: vendorContractsExpiringSoon, totalAnnualCost: Math.round(totalActiveVendorSpend) },
    accessRequests: { pending: pendingAccessRequests },
  };
}

// The MHSA 2.13.1 engineering appointee. Deliberately narrower than the Operations
// Manager's context, which covers the production side of the same plant: this one is about
// whether the asset base is being maintained and whether the statutory inspection regime on
// winding plant and shafts is current. Thresholds mirror routes/engineeringDashboard.ts so
// the assistant and the dashboard can't tell the executive two different things.
async function buildEngineeringManagerContext(mineId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const staleInspectionBefore = new Date(Date.now() - 90 * 86400000);

  const [
    mine,
    equipmentByStatus,
    openMaintenance,
    overdueMaintenance,
    completedMaintenance,
    downtimeByCategory,
    winders,
    ropes,
    shaftInspections,
    consumableParts,
    liftingEquipment,
    pressureEquipment,
    electricalInstallations,
    reliabilityProfiles,
    recentFailures,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.equipment.groupBy({ by: ["status"], where: { site: { mineId } }, _count: true }),
    prisma.maintenanceSchedule.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, equipment: { site: { mineId } } },
    }),
    prisma.maintenanceSchedule.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, scheduledDate: { lt: now }, equipment: { site: { mineId } } },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { completedDate: { gte: thirtyDaysAgo }, equipment: { site: { mineId } } },
      select: { maintenanceType: true, cost: true, downtimeMinutes: true },
    }),
    prisma.downtimeEvent.groupBy({
      by: ["category"],
      where: { startedAt: { gte: thirtyDaysAgo }, site: { mineId } },
      _count: true,
    }),
    prisma.winder.findMany({
      where: { site: { mineId } },
      select: {
        status: true,
        inspections: { orderBy: { inspectionDate: "desc" }, take: 1, select: { inspectionDate: true, nextInspectionDue: true, brakeTestResult: true } },
      },
    }),
    prisma.conveyanceRope.findMany({
      where: { status: "IN_SERVICE", winder: { site: { mineId } } },
      select: { discardDate: true, nextTestDue: true },
    }),
    prisma.shaftInspection.findMany({
      where: { site: { mineId } },
      select: { shaftName: true, inspectionDate: true, nextInspectionDue: true },
      orderBy: { inspectionDate: "desc" },
    }),
    prisma.equipmentConsumablePart.findMany({
      where: { status: "IN_SERVICE", equipment: { site: { mineId } } },
      select: { partType: true, initialMeasurement: true, currentMeasurement: true },
    }),
    // Statutory plant registers. Scoped to items actually in service — a quarantined
    // sling or an isolated board is already off the job, so counting it as a lapse
    // would tell the model to chase something the department has already handled.
    prisma.liftingEquipment.findMany({
      where: { site: { mineId }, status: "IN_SERVICE" },
      select: { equipmentType: true, nextInspectionDue: true, nextLoadTestDue: true, safeWorkingLoadKg: true },
    }),
    prisma.pressureEquipment.findMany({
      where: { site: { mineId }, status: "IN_SERVICE" },
      select: { equipmentType: true, certificateExpiry: true, nextInspectionDue: true, safetyValveNextDue: true },
    }),
    prisma.electricalInstallation.findMany({
      where: { site: { mineId }, status: "IN_SERVICE" },
      select: { hazardousArea: true, exProtection: true, exCertificateExpiry: true, earthLeakageProtected: true, nextTestDue: true },
    }),
    prisma.assetReliabilityProfile.findMany({
      where: { equipment: { site: { mineId } } },
      select: { equipmentId: true, criticality: true, currentRunHours: true, targetAvailabilityPct: true },
    }),
    prisma.equipmentFailure.findMany({
      where: { equipment: { site: { mineId } }, failureDate: { gte: thirtyDaysAgo } },
      select: { equipmentId: true, failureMode: true, downtimeHours: true, rootCause: true, recurrencePrevented: true },
    }),
  ]);

  const equipmentStatus = { OPERATIONAL: 0, MAINTENANCE: 0, DOWN: 0 } as Record<string, number>;
  for (const row of equipmentByStatus) equipmentStatus[row.status] = row._count;

  const maintenanceTypeCounts: Record<string, number> = {};
  for (const m of completedMaintenance) maintenanceTypeCounts[m.maintenanceType] = (maintenanceTypeCounts[m.maintenanceType] ?? 0) + 1;

  // Work chosen versus work forced on the plant. The ratio is the maintenance-maturity
  // signal the appointee is judged on, so it's precomputed rather than left for the model
  // to derive from the type counts and risk it arithmetically.
  const proactiveTypes = ["PLANNED", "PREVENTIVE", "INSPECTION"];
  const proactiveCount = completedMaintenance.filter((m) => proactiveTypes.includes(m.maintenanceType)).length;
  const plannedSharePct = completedMaintenance.length === 0 ? null : Math.round((proactiveCount / completedMaintenance.length) * 1000) / 10;

  const downtimeCategories: Record<string, number> = {};
  for (const row of downtimeByCategory) downtimeCategories[row.category] = row._count;

  const windersNeverInspected = winders.filter((w) => !w.inspections[0]).length;
  const windersInspectionOverdue = winders.filter((w) => {
    const next = w.inspections[0]?.nextInspectionDue;
    return next != null && next < now;
  }).length;
  const windersFailedBrakeTest = winders.filter((w) => w.inspections[0]?.brakeTestResult === "FAIL").length;

  // Rope discard dates are a hard regulatory ceiling, not a soft reminder — a rope past
  // its discard date is the single most serious item this context can carry.
  const ropesPastDiscard = ropes.filter((r) => r.discardDate != null && r.discardDate < now).length;
  const ropesDiscardWithin30Days = ropes.filter((r) => r.discardDate != null && r.discardDate >= now && r.discardDate <= in30Days).length;
  const ropesTestOverdue = ropes.filter((r) => r.nextTestDue != null && r.nextTestDue < now).length;

  // Latest inspection per shaft only; older rows for the same shaft would each otherwise
  // read as separately overdue.
  const latestByShaft = new Map<string, (typeof shaftInspections)[number]>();
  for (const s of shaftInspections) if (!latestByShaft.has(s.shaftName)) latestByShaft.set(s.shaftName, s);
  const shaftsOverdue = [...latestByShaft.values()].filter(
    (s) => (s.nextInspectionDue != null && s.nextInspectionDue < now) || (s.nextInspectionDue == null && s.inspectionDate < staleInspectionBefore)
  ).length;

  // Only parts with both readings can have a wear ratio; an unmeasured part is unknown,
  // not healthy, so it's reported separately rather than folded into the "within limit" count.
  const measuredParts = consumableParts.filter(
    (p) => p.initialMeasurement != null && p.currentMeasurement != null && p.initialMeasurement > 0
  );
  const partsPastWearLimit = measuredParts.filter((p) => p.currentMeasurement! / p.initialMeasurement! <= 0.2).length;

  // A missing due date counts as lapsed, not as compliant: on a register the mine must
  // produce on demand, "we never set a date" is the same finding as "the date passed",
  // and reporting it as compliant would hide the worst-maintained items entirely.
  const lapsed = (date: Date | null) => !date || date < now;

  const liftingInspectionOverdue = liftingEquipment.filter((i) => lapsed(i.nextInspectionDue)).length;
  const liftingLoadTestOverdue = liftingEquipment.filter((i) => i.nextLoadTestDue != null && i.nextLoadTestDue < now).length;
  const liftingWithoutSwl = liftingEquipment.filter((i) => i.safeWorkingLoadKg == null).length;

  const pressureCertificateLapsed = pressureEquipment.filter((i) => lapsed(i.certificateExpiry)).length;
  const pressureInspectionOverdue = pressureEquipment.filter((i) => lapsed(i.nextInspectionDue)).length;
  const pressureValveOverdue = pressureEquipment.filter((i) => i.safetyValveNextDue != null && i.safetyValveNextDue < now).length;

  const hazardousInstallations = electricalInstallations.filter((i) => i.hazardousArea);
  const exUnprotectedInHazardousArea = hazardousInstallations.filter((i) => i.exProtection === "NONE").length;
  const exCertificateLapsed = hazardousInstallations.filter((i) => i.exProtection !== "NONE" && lapsed(i.exCertificateExpiry)).length;
  const electricalTestOverdue = electricalInstallations.filter((i) => lapsed(i.nextTestDue)).length;
  const withoutEarthLeakageProtection = electricalInstallations.filter((i) => !i.earthLeakageProtected).length;

  const failureDowntimeByEquipment = new Map<string, number>();
  const downtimeByFailureMode: Record<string, number> = {};
  for (const f of recentFailures) {
    const hours = f.downtimeHours ?? 0;
    failureDowntimeByEquipment.set(f.equipmentId, (failureDowntimeByEquipment.get(f.equipmentId) ?? 0) + hours);
    downtimeByFailureMode[f.failureMode] = Math.round(((downtimeByFailureMode[f.failureMode] ?? 0) + hours) * 10) / 10;
  }
  const windowHours = 30 * 24;
  const assetsBelowAvailabilityTarget = reliabilityProfiles.filter((p) => {
    if (p.targetAvailabilityPct == null) return false;
    const downtime = failureDowntimeByEquipment.get(p.equipmentId) ?? 0;
    return ((windowHours - downtime) / windowHours) * 100 < p.targetAvailabilityPct;
  }).length;
  const failuresWithRootCause = recentFailures.filter((f) => f.rootCause).length;
  const failuresRecurrencePrevented = recentFailures.filter((f) => f.recurrencePrevented).length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    equipment: { byStatus: equipmentStatus, total: Object.values(equipmentStatus).reduce((a, b) => a + b, 0) },
    maintenanceBacklog: { open: openMaintenance, overdue: overdueMaintenance },
    maintenanceLast30Days: {
      completed: completedMaintenance.length,
      byType: maintenanceTypeCounts,
      plannedSharePct,
      plannedShareNote:
        "Share of completed work that was PLANNED/PREVENTIVE/INSPECTION rather than CORRECTIVE/EMERGENCY. Industry expectation is 80%+; a low share means the plant is dictating the schedule.",
      totalCost: Math.round(completedMaintenance.reduce((sum, m) => sum + (m.cost ?? 0), 0)),
      downtimeHours: Math.round(completedMaintenance.reduce((sum, m) => sum + (m.downtimeMinutes ?? 0), 0) / 6) / 10,
    },
    downtimeEventsLast30DaysByCategory: downtimeCategories,
    windingPlant: {
      winders: winders.length,
      neverInspected: windersNeverInspected,
      inspectionOverdue: windersInspectionOverdue,
      failedBrakeTest: windersFailedBrakeTest,
    },
    conveyanceRopes: {
      inService: ropes.length,
      pastDiscardDate: ropesPastDiscard,
      discardDueWithin30Days: ropesDiscardWithin30Days,
      testOverdue: ropesTestOverdue,
      discardNote: "A rope past its discard date must be replaced — this is a regulatory ceiling, not a scheduling preference.",
    },
    shafts: { tracked: latestByShaft.size, inspectionOverdue: shaftsOverdue },
    consumableParts: {
      inService: consumableParts.length,
      withWearReadings: measuredParts.length,
      pastWearLimit: partsPastWearLimit,
      unmeasured: consumableParts.length - measuredParts.length,
    },
    liftingRegister: {
      inService: liftingEquipment.length,
      inspectionOverdue: liftingInspectionOverdue,
      loadTestOverdue: liftingLoadTestOverdue,
      withoutSafeWorkingLoad: liftingWithoutSwl,
      note:
        "Driven Machinery Regulations. Every lifting machine and every piece of loose tackle needs a current examination; " +
        "inspectionOverdue counts items with no next-inspection date as overdue, because an undated item is the least " +
        "visible and the longest neglected. Tackle without a legible safe working load must be withdrawn from service.",
    },
    pressureRegister: {
      inService: pressureEquipment.length,
      certificateLapsed: pressureCertificateLapsed,
      inspectionOverdue: pressureInspectionOverdue,
      safetyValveTestOverdue: pressureValveOverdue,
      note:
        "Pressure Equipment Regulations. certificateLapsed and inspectionOverdue are separate failures: a vessel can be " +
        "inside its inspection interval while its Approved Inspection Authority certificate has expired, and only the " +
        "certificate is what an inspector asks to see. A receiver failure is an explosive event, not a leak.",
    },
    electricalRegister: {
      inService: electricalInstallations.length,
      inHazardousArea: hazardousInstallations.length,
      unprotectedInHazardousArea: exUnprotectedInHazardousArea,
      exCertificateLapsed: exCertificateLapsed,
      testOverdue: electricalTestOverdue,
      withoutEarthLeakageProtection,
      note:
        "MHSA Chapter 8 and IEC 60079. unprotectedInHazardousArea is energised apparatus with no explosion-protection " +
        "technique in a classified area — an ignition source, and the most serious item in this register by a wide margin. " +
        "exCertificateLapsed is protected apparatus whose certification has expired.",
    },
    assetReliability: {
      profiledAssets: reliabilityProfiles.length,
      criticalAssets: reliabilityProfiles.filter((p) => p.criticality === "CRITICAL").length,
      assetsBelowAvailabilityTarget,
      failuresLast30Days: recentFailures.length,
      failureDowntimeHoursLast30Days: Math.round(recentFailures.reduce((sum, f) => sum + (f.downtimeHours ?? 0), 0) * 10) / 10,
      downtimeByFailureMode,
      failuresWithRootCause,
      failuresRecurrencePrevented,
      note:
        "downtimeByFailureMode is a Pareto in hours lost, not incident count — a rare failure costing a week beats a " +
        "weekly one costing an hour. failuresRecurrencePrevented is where the corrective action was judged to address " +
        "the cause rather than the symptom; a repeat of the same mode on the same asset means that judgement was wrong.",
    },
  };
}

// The environmental control officer appointee. Covers the operational environmental
// picture — monitoring, tailings integrity, water balance, closure provision — as distinct
// from the Compliance Officer's context, which tracks filing and authorisation status for
// the same obligations. Thresholds mirror routes/environmentalDashboard.ts.
async function buildEnvironmentalManagerContext(mineId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const staleInspectionBefore = new Date(Date.now() - 90 * 86400000);

  const [
    mine,
    readingsTotal,
    exceedancesByParameter,
    tailingsFacilities,
    waterRecords,
    latestEnergy,
    latestGhg,
    closurePlans,
    pollutionDams,
    environmentalIncidentsOpen,
    wasteStreams,
    emissionLicences,
    dustExceedancesLast30Days,
    boreholes,
    environmentalIncidentsYear,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.environmentalReading.count({ where: { recordedAt: { gte: thirtyDaysAgo }, site: { mineId } } }),
    prisma.environmentalReading.groupBy({
      by: ["parameterType"],
      where: { withinLimits: false, recordedAt: { gte: thirtyDaysAgo }, site: { mineId } },
      _count: true,
    }),
    prisma.tailingsFacility.findMany({
      where: { site: { mineId } },
      select: {
        name: true,
        gistmClassification: true,
        inspections: {
          orderBy: { inspectionDate: "desc" },
          take: 1,
          select: { inspectionDate: true, structuralRating: true, seepageObserved: true, freeboardMeters: true, engineerSignOff: true },
        },
      },
    }),
    prisma.waterBalanceRecord.findMany({
      where: { recordDate: { gte: thirtyDaysAgo }, site: { mineId } },
      select: { abstractedVolume: true, dischargedVolume: true, recycledVolume: true, licenseLimit: true, withinLimit: true, unit: true },
    }),
    prisma.energyConsumptionRecord.findFirst({
      where: { site: { mineId } },
      orderBy: { recordMonth: "desc" },
      select: { recordMonth: true, gridConsumptionKwh: true, renewableConsumptionKwh: true, dieselConsumptionLiters: true },
    }),
    prisma.ghgEmissionsRecord.findFirst({
      where: { mineId },
      orderBy: { reportingYear: "desc" },
      select: { reportingYear: true, scope1TonnesCO2e: true, scope2TonnesCO2e: true, carbonTaxLiability: true },
    }),
    prisma.closureRehabilitationPlan.findMany({
      where: { site: { mineId } },
      select: { financialProvisionAmount: true, nextAssessmentDue: true, status: true },
    }),
    prisma.pollutionControlDam.findMany({
      where: { site: { mineId } },
      select: { status: true, currentLevel: true, capacity: true, lastInspectionDate: true },
    }),
    prisma.incident.count({
      where: { status: { in: ["OPEN", "INVESTIGATING"] }, site: { mineId } },
    }),
    prisma.wasteStream.findMany({
      where: { site: { mineId }, status: "ACTIVE" },
      select: {
        wasteType: true,
        storageStartDate: true,
        storageLimitMonths: true,
        manifests: { select: { id: true }, take: 1 },
      },
    }),
    prisma.emissionLicence.findMany({
      where: { site: { mineId } },
      select: {
        status: true,
        expiryDate: true,
        stackTests: { orderBy: { testDate: "desc" }, take: 1, select: { compliant: true } },
      },
    }),
    prisma.dustFalloutReading.count({
      where: { site: { mineId }, readingMonth: { gte: thirtyDaysAgo }, withinLimit: false },
    }),
    prisma.monitoringBorehole.findMany({
      where: { site: { mineId }, status: "ACTIVE" },
      select: {
        staticWaterLevelBaselineM: true,
        readings: { orderBy: { readingDate: "desc" }, take: 1, select: { waterLevelMbgl: true, withinLimits: true } },
      },
    }),
    prisma.environmentalIncident.findMany({
      where: { site: { mineId }, incidentDate: { gte: new Date(Date.now() - 365 * 86400000) } },
      select: { regulatorNotificationRequired: true, regulatorNotifiedAt: true, incidentDate: true, remediationStatus: true },
    }),
  ]);

  const exceedanceCounts: Record<string, number> = {};
  for (const row of exceedancesByParameter) exceedanceCounts[row.parameterType] = row._count;
  const totalExceedances = Object.values(exceedanceCounts).reduce((a, b) => a + b, 0);

  // A facility is at risk on a poor rating, observed seepage, or no inspection inside the
  // assumed interval. Never-inspected counts as at risk rather than unknown — an
  // uninspected dam is precisely the case worth escalating.
  const tailingsAtRisk = tailingsFacilities.filter((f) => {
    const latest = f.inspections[0];
    if (!latest) return true;
    if (["POOR", "UNSATISFACTORY"].includes(latest.structuralRating)) return true;
    if (latest.seepageObserved) return true;
    return latest.inspectionDate < staleInspectionBefore;
  });
  const tailingsNeverInspected = tailingsFacilities.filter((f) => !f.inspections[0]).length;
  const tailingsSeepage = tailingsFacilities.filter((f) => f.inspections[0]?.seepageObserved).length;
  const tailingsPoorRating = tailingsFacilities.filter((f) =>
    ["POOR", "UNSATISFACTORY"].includes(f.inspections[0]?.structuralRating ?? "")
  ).length;
  const tailingsNoEngineerSignOff = tailingsFacilities.filter((f) => f.inspections[0] && !f.inspections[0].engineerSignOff).length;

  const abstracted = waterRecords.reduce((sum, w) => sum + w.abstractedVolume, 0);
  const limitTotal = waterRecords.reduce((sum, w) => sum + (w.licenseLimit ?? 0), 0);
  // Licence limits are per-record, so abstraction is compared against the sum of the limits
  // that actually applied over the window rather than any single figure.
  const licenceUsedPct = limitTotal > 0 ? Math.round((abstracted / limitTotal) * 1000) / 10 : null;

  const closureDue = closurePlans.filter((p) => p.nextAssessmentDue != null && p.nextAssessmentDue <= in30Days).length;
  const closureOverdue = closurePlans.filter((p) => p.nextAssessmentDue != null && p.nextAssessmentDue < now).length;

  const damsOverdueInspection = pollutionDams.filter(
    (d) => d.lastInspectionDate == null || d.lastInspectionDate < staleInspectionBefore
  ).length;

  // A missing due date counts as lapsed, not compliant — the same reasoning applied to
  // the engineering plant registers. An unset date is the least visible, longest
  // neglected case, and reporting it as clean would hide exactly that.
  const lapsed = (date: Date | null) => !date || date < now;

  const hazardousStreams = wasteStreams.filter((s) => s.wasteType === "HAZARDOUS");
  const hazardousOverStorageLimit = hazardousStreams.filter((s) => {
    if (s.storageLimitMonths == null) return false;
    if (!s.storageStartDate) return true;
    const monthsInStorage = (now.getTime() - s.storageStartDate.getTime()) / (30.44 * 86400000);
    return monthsInStorage > s.storageLimitMonths;
  }).length;
  const wasteStreamsNeverManifested = wasteStreams.filter((s) => s.manifests.length === 0).length;

  const activeLicences = emissionLicences.filter((l) => l.status === "ACTIVE");
  const licencesLapsedOrUndated = activeLicences.filter((l) => lapsed(l.expiryDate)).length;
  const nonCompliantLastStackTest = emissionLicences.filter((l) => l.stackTests[0] && !l.stackTests[0].compliant).length;

  const boreholesOutOfLimits = boreholes.filter((b) => b.readings[0] && !b.readings[0].withinLimits).length;
  // Drawdown: latest level more than 10% below the baseline is a trend worth
  // investigating, not itself a quality exceedance (that's withinLimits above).
  const boreholesDrawingDown = boreholes.filter((b) => {
    const latest = b.readings[0]?.waterLevelMbgl;
    if (latest == null || b.staticWaterLevelBaselineM == null || b.staticWaterLevelBaselineM <= 0) return false;
    return latest > b.staticWaterLevelBaselineM * 1.1;
  }).length;

  const notificationsRequired = environmentalIncidentsYear.filter((i) => i.regulatorNotificationRequired);
  const notificationsOutstanding = notificationsRequired.filter((i) => !i.regulatorNotifiedAt).length;
  const notifiedHours = notificationsRequired
    .filter((i) => i.regulatorNotifiedAt)
    .map((i) => (i.regulatorNotifiedAt!.getTime() - i.incidentDate.getTime()) / 3_600_000);
  const avgNotificationHours = notifiedHours.length > 0 ? Math.round((notifiedHours.reduce((a, b) => a + b, 0) / notifiedHours.length) * 10) / 10 : null;
  const incidentsUnremediated = environmentalIncidentsYear.filter(
    (i) => i.remediationStatus === "NOT_STARTED" || i.remediationStatus === "IN_PROGRESS"
  ).length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    tailingsFacilities: {
      total: tailingsFacilities.length,
      atRisk: tailingsAtRisk.length,
      neverInspected: tailingsNeverInspected,
      seepageObserved: tailingsSeepage,
      poorOrUnsatisfactoryRating: tailingsPoorRating,
      latestInspectionLacksEngineerSignOff: tailingsNoEngineerSignOff,
      note: "A tailings storage facility is the highest-consequence structure on most mines. Seepage, a poor structural rating, or an uninspected facility outranks any larger number elsewhere in this snapshot.",
    },
    monitoringLast30Days: {
      totalReadings: readingsTotal,
      exceedances: totalExceedances,
      exceedancesByParameter: exceedanceCounts,
      note: "Exceedances must be read against total readings: a fall in exceedances alongside a fall in readings means less was measured, not that performance improved.",
    },
    waterBalanceLast30Days: {
      abstracted: Math.round(abstracted * 10) / 10,
      discharged: Math.round(waterRecords.reduce((sum, w) => sum + w.dischargedVolume, 0) * 10) / 10,
      recycled: Math.round(waterRecords.reduce((sum, w) => sum + w.recycledVolume, 0) * 10) / 10,
      unit: waterRecords[0]?.unit ?? "kL",
      licenceUsedPct,
      licenceBreaches: waterRecords.filter((w) => !w.withinLimit).length,
    },
    energyLatestMonth: latestEnergy
      ? {
          month: latestEnergy.recordMonth,
          gridKwh: latestEnergy.gridConsumptionKwh,
          renewableKwh: latestEnergy.renewableConsumptionKwh,
          dieselLitres: latestEnergy.dieselConsumptionLiters,
        }
      : null,
    greenhouseGas: latestGhg
      ? {
          reportingYear: latestGhg.reportingYear,
          scope1TonnesCO2e: latestGhg.scope1TonnesCO2e,
          scope2TonnesCO2e: latestGhg.scope2TonnesCO2e,
          carbonTaxLiability: latestGhg.carbonTaxLiability,
        }
      : null,
    closureRehabilitation: {
      plans: closurePlans.length,
      assessmentsDueWithin30Days: closureDue,
      assessmentsOverdue: closureOverdue,
      totalFinancialProvision: Math.round(closurePlans.reduce((sum, p) => sum + (p.financialProvisionAmount ?? 0), 0)),
    },
    pollutionControlDams: { total: pollutionDams.length, overdueInspection: damsOverdueInspection },
    openIncidentsAtMine: environmentalIncidentsOpen,
    wasteManagement: {
      activeStreams: wasteStreams.length,
      hazardousStreams: hazardousStreams.length,
      hazardousOverStorageLimit,
      neverManifested: wasteStreamsNeverManifested,
      note: "Hazardous waste may not be stockpiled longer than its storageLimitMonths (23 months by default under NEMWA Norm 4) without a permit. A stream with no manifest yet is unproven disposal, not a minor gap.",
    },
    airQualityCompliance: {
      activeLicences: activeLicences.length,
      licencesLapsedOrUndated,
      nonCompliantLastStackTest,
      dustExceedancesLast30Days,
      note: "licencesLapsedOrUndated includes licences with no expiry date on record, which is itself a finding, not missing data.",
    },
    groundwater: {
      activeBoreholes: boreholes.length,
      outOfLimits: boreholesOutOfLimits,
      drawingDown: boreholesDrawingDown,
      note: "drawingDown is a water-level trend worth investigating (>10% below baseline), distinct from outOfLimits which is a quality exceedance.",
    },
    environmentalIncidentsLast365Days: {
      total: environmentalIncidentsYear.length,
      notificationsRequired: notificationsRequired.length,
      notificationsOutstanding,
      avgNotificationHours,
      unremediated: incidentsUnremediated,
      note: "NEMA requires a material incident to be reported to the relevant authority without delay. notificationsOutstanding is a live legal exposure, not a backlog item — it should be raised ahead of routine monitoring data.",
    },
  };
}

// The surveyor/resource appointee. ResourceEstimate is versioned: a revision supersedes
// rather than overwrites its predecessor, so every tonnage here is derived from the latest
// version per site/mineral/classification. Summing the raw table would count each revision
// again and inflate the resource statement — the one figure in this context that cannot be
// allowed to be wrong. Mirrors routes/mineralResourcesDashboard.ts.
async function buildMineralResourcesManagerContext(mineId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const oneYearAgo = new Date(Date.now() - 365 * 86400000);

  const [
    mine,
    estimates,
    holesByStatus,
    completedHoles,
    assays,
    productionYear,
    surveyPlans,
    beacons,
    qaqcSamplesRecent,
    mineralRights,
    reconciliations,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.resourceEstimate.findMany({
      where: { site: { mineId } },
      select: {
        siteId: true,
        estimateDate: true,
        mineralType: true,
        classification: true,
        tonnage: true,
        grade: true,
        gradeUnit: true,
        competentPerson: true,
        version: true,
      },
    }),
    prisma.drillHole.groupBy({ by: ["status"], where: { site: { mineId } }, _count: true }),
    prisma.drillHole.findMany({
      where: { status: "COMPLETED", site: { mineId } },
      select: { totalDepth: true, drilledDate: true, _count: { select: { assayIntervals: true } } },
    }),
    prisma.assayInterval.findMany({
      where: { drillHole: { site: { mineId } } },
      select: { mineralType: true, grade: true, gradeUnit: true, fromDepth: true, toDepth: true },
    }),
    prisma.productionRecord.findMany({
      where: { shiftDate: { gte: oneYearAgo }, site: { mineId } },
      select: { tonnesMined: true },
    }),
    prisma.surveyPlan.findMany({
      where: { site: { mineId } },
      select: { siteId: true, surveyDate: true, nextSurveyDue: true },
    }),
    prisma.boundaryBeacon.findMany({
      where: { site: { mineId } },
      select: { condition: true, nextVerificationDue: true },
    }),
    prisma.qaqcSample.findMany({
      where: { site: { mineId }, sampleDate: { gte: new Date(Date.now() - 90 * 86400000) } },
      select: { sampleType: true, result: true },
    }),
    prisma.mineralRight.findMany({
      where: { mineId },
      select: { rightReferenceNumber: true, rightType: true, status: true, expiryDate: true, renewalApplicationDue: true, renewalLodgedDate: true },
    }),
    prisma.gradeReconciliation.findMany({
      where: { site: { mineId }, periodStart: { gte: oneYearAgo } },
      select: {
        mineralType: true,
        estimatedTonnes: true,
        estimatedGrade: true,
        actualTonnesMined: true,
        actualGradeMined: true,
        actualTonnesMilled: true,
        actualGradeMilled: true,
        varianceExplanation: true,
      },
    }),
  ]);

  // Highest version per site + mineral + classification; most recent date breaks a tie.
  const latest = new Map<string, (typeof estimates)[number]>();
  for (const e of estimates) {
    const key = `${e.siteId}|${e.mineralType}|${e.classification}`;
    const held = latest.get(key);
    if (!held || e.version > held.version || (e.version === held.version && e.estimateDate > held.estimateDate)) {
      latest.set(key, e);
    }
  }
  const current = [...latest.values()];

  const tonnageByClassification: Record<string, number> = {};
  for (const e of current) tonnageByClassification[e.classification] = (tonnageByClassification[e.classification] ?? 0) + e.tonnage;
  for (const k of Object.keys(tonnageByClassification)) tonnageByClassification[k] = Math.round(tonnageByClassification[k] * 10) / 10;

  const sumOf = (classes: string[]) =>
    Math.round(current.filter((e) => classes.includes(e.classification)).reduce((s, e) => s + e.tonnage, 0) * 10) / 10;

  const reserves = sumOf(["PROVED_RESERVE", "PROBABLE_RESERVE"]);
  const annualProduction = productionYear.reduce((s, p) => s + p.tonnesMined, 0);
  // null rather than a number when nothing was mined: with no production the ratio is
  // undefined, not unlimited, and an "infinite reserve life" would be a dangerous readout.
  const reserveLifeYears = annualProduction > 0 && reserves > 0 ? Math.round((reserves / annualProduction) * 10) / 10 : null;

  const holeStatus: Record<string, number> = {};
  for (const row of holesByStatus) holeStatus[row.status] = row._count;

  const holesAwaitingAssay = completedHoles.filter((h) => h._count.assayIntervals === 0).length;
  const holesDrilledLast30Days = completedHoles.filter((h) => h.drilledDate != null && h.drilledDate >= thirtyDaysAgo).length;

  // Length-weighted, because a 20 m interval at 3 g/t and a 1 m interval at 9 g/t do not
  // average to 6 g/t. An unweighted mean would misstate the deposit.
  const gradeAcc: Record<string, { weighted: number; metres: number; unit: string | null }> = {};
  for (const a of assays) {
    if (a.grade == null) continue;
    const length = Math.max(0, a.toDepth - a.fromDepth);
    if (length === 0) continue;
    const bucket = (gradeAcc[a.mineralType] ??= { weighted: 0, metres: 0, unit: a.gradeUnit });
    bucket.weighted += a.grade * length;
    bucket.metres += length;
  }
  const averageGrades = Object.fromEntries(
    Object.entries(gradeAcc).map(([mineral, b]) => [
      mineral,
      { lengthWeightedGrade: Math.round((b.weighted / b.metres) * 1000) / 1000, unit: b.unit, metresSampled: Math.round(b.metres * 10) / 10 },
    ])
  );

  const staleEstimates = current.filter((e) => e.estimateDate < oneYearAgo).length;
  const missingCompetentPerson = current.filter((e) => !e.competentPerson || !e.competentPerson.trim()).length;

  // --- Survey & boundary compliance ------------------------------------------
  const latestSurveyBySite = new Map<string, (typeof surveyPlans)[number]>();
  for (const p of surveyPlans) {
    const held = latestSurveyBySite.get(p.siteId);
    if (!held || p.surveyDate > held.surveyDate) latestSurveyBySite.set(p.siteId, p);
  }
  const sitesWithoutCurrentSurvey = [...latestSurveyBySite.values()].filter((p) => !p.nextSurveyDue || p.nextSurveyDue < now).length;
  const beaconsWithIssue = beacons.filter((b) => b.condition === "DAMAGED" || b.condition === "MISSING").length;
  const beaconsVerificationOverdue = beacons.filter((b) => !b.nextVerificationDue || b.nextVerificationDue < now).length;

  // --- QAQC program (last 90 days) -------------------------------------------
  const qaqcFail = qaqcSamplesRecent.filter((s) => s.result === "FAIL").length;
  const qaqcPassRatePct = qaqcSamplesRecent.length > 0 ? Math.round(((qaqcSamplesRecent.length - qaqcFail) / qaqcSamplesRecent.length) * 100) : null;
  const qaqcTypesCovered = new Set(qaqcSamplesRecent.map((s) => s.sampleType)).size;

  // --- Mineral rights & tenure -------------------------------------------------
  const activeRights = mineralRights.filter((r) => r.status === "ACTIVE" || r.status === "RENEWAL_PENDING");
  const renewalOverdue = activeRights.filter((r) => r.renewalApplicationDue && !r.renewalLodgedDate && r.renewalApplicationDue < now).length;
  const expiredStillActive = mineralRights.filter((r) => r.status === "ACTIVE" && r.expiryDate && r.expiryDate < now).length;

  // --- Grade reconciliation (Mine Call Factor) --------------------------------
  const mcfValues = reconciliations
    .map((r) => {
      const estimatedMetal = r.estimatedTonnes * r.estimatedGrade;
      if (estimatedMetal <= 0) return null;
      const actualTonnes = r.actualTonnesMilled ?? r.actualTonnesMined;
      const actualGrade = r.actualGradeMilled ?? r.actualGradeMined;
      if (actualTonnes == null || actualGrade == null) return null;
      return { mcf: (actualTonnes * actualGrade / estimatedMetal) * 100, explained: !!r.varianceExplanation?.trim() };
    })
    .filter((v): v is { mcf: number; explained: boolean } => v != null);
  const avgMcfPct = mcfValues.length > 0 ? Math.round((mcfValues.reduce((s, v) => s + v.mcf, 0) / mcfValues.length) * 10) / 10 : null;
  const unexplainedVariances = mcfValues.filter((v) => Math.abs(v.mcf - 100) > 10 && !v.explained).length;
  const reconciliationsAwaitingActuals = reconciliations.length - mcfValues.length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    resourceStatement: {
      measuredPlusIndicated: sumOf(["MEASURED", "INDICATED"]),
      inferred: sumOf(["INFERRED"]),
      reserves,
      tonnageByClassification,
      basisNote:
        "Latest version of each estimate only — superseded revisions are excluded. Confidence descends Measured > Indicated > Inferred; only Proved/Probable reserves are the economically mineable subset.",
    },
    depletion: {
      tonnesMinedLast12Months: Math.round(annualProduction * 10) / 10,
      reserveLifeYears,
      reserveLifeNote: "null means no production was recorded in the window, so reserve life is undefined rather than unlimited.",
    },
    drilling: {
      holesByStatus: holeStatus,
      completedHoles: completedHoles.length,
      holesDrilledLast30Days,
      metresDrilled: Math.round(completedHoles.reduce((s, h) => s + (h.totalDepth ?? 0), 0) * 10) / 10,
      assayIntervals: assays.length,
      holesAwaitingAssay,
      awaitingAssayNote: "Completed holes with no assay intervals — drilling spend that has not yet become usable data.",
    },
    averageGradesByMineral: averageGrades,
    estimateGovernance: {
      currentEstimates: current.length,
      supersededVersions: estimates.length - current.length,
      notRevisedIn12Months: staleEstimates,
      missingCompetentPerson,
      governanceNote:
        "SAMREC requires a named competent person behind a public resource or reserve figure; an estimate without one is a reporting gap, not merely a blank field.",
    },
    surveyAndBoundary: {
      sitesTracked: latestSurveyBySite.size,
      sitesWithoutCurrentSurvey,
      beaconsTracked: beacons.length,
      beaconsWithIssue,
      beaconsVerificationOverdue,
      note:
        "Mine Survey Regulations. A site with no current survey plan, or a damaged/missing boundary beacon, is evidence the mine cannot currently prove it hasn't mined beyond its boundary — treat as a compliance exposure, not a scheduling backlog.",
    },
    qaqcProgramLast90Days: {
      totalSamples: qaqcSamplesRecent.length,
      failed: qaqcFail,
      passRatePct: qaqcPassRatePct,
      sampleTypesCovered: qaqcTypesCovered,
      note:
        "SAMREC Table 1 expects certified standards, field/pulp duplicates and blanks all represented, not just one. sampleTypesCovered below 4 means the program has a gap even if the pass rate looks healthy. passRatePct is null when nothing was submitted.",
    },
    mineralRightsAndTenure: {
      activeRights: activeRights.length,
      renewalApplicationOverdueWithNoLodgement: renewalOverdue,
      expiredButStillMarkedActive: expiredStillActive,
      note:
        "MPRDA s23. A missed renewal-application deadline with nothing lodged is a live risk of losing the legal right to mine — rank it above resource/reserve figures, since without the right the resource is unmineable regardless of its size.",
    },
    gradeReconciliationLast12Months: {
      periodsRecorded: reconciliations.length,
      periodsAwaitingActuals: reconciliationsAwaitingActuals,
      avgMineCallFactorPct: avgMcfPct,
      unexplainedVariances,
      note:
        "Mine Call Factor: actual metal accounted for against what the resource model predicted for the same tonnes. A factor persistently off 100% without explanation calls the resource model itself into question — this is the evidence for or against the reserve figures reported above, not a separate production metric.",
    },
  };
}

// The ventilation officer / occupational hygienist appointments. Two halves of one role:
// airflow keeps the workings breathable now, exposure sampling determines who develops
// occupational lung disease in twenty years. Both are carried here because the same
// appointee answers for them.
async function buildVentilationManagerContext(mineId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    mine,
    districts,
    readingsTotal,
    readingsBelowRequirement,
    exposureRecords,
    refugeBays,
    refugeBaysOverdue,
    dustExposedWorkers,
    occupationalDiseaseCases,
    unsubmittedMbodCases,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.ventilationDistrict.findMany({
      where: { site: { mineId } },
      select: {
        name: true,
        requiredAirflowQuantity: true,
        unit: true,
        status: true,
        readings: { orderBy: { readingDate: "desc" }, take: 1, select: { airflowQuantity: true, withinRequirement: true, readingDate: true } },
      },
    }),
    prisma.ventilationReading.count({ where: { readingDate: { gte: thirtyDaysAgo }, district: { site: { mineId } } } }),
    prisma.ventilationReading.count({
      where: { withinRequirement: false, readingDate: { gte: thirtyDaysAgo }, district: { site: { mineId } } },
    }),
    prisma.occupationalExposureRecord.findMany({
      where: { sampleDate: { gte: thirtyDaysAgo }, worker: { site: { mineId } } },
      select: { pollutant: true, sampleType: true, measuredValue: true, occupationalExposureLimit: true, exceedsLimit: true },
    }),
    prisma.refugeBay.count({ where: { site: { mineId } } }),
    prisma.refugeBay.count({ where: { nextInspectionDue: { lt: now }, site: { mineId } } }),
    prisma.medicalSurveillance.count({ where: { dustExposed: true, worker: { site: { mineId } } } }),
    prisma.medicalSurveillance.count({ where: { diseaseClassification: { not: "NONE" }, worker: { site: { mineId } } } }),
    prisma.medicalSurveillance.count({
      where: { diseaseClassification: { not: "NONE" }, submittedToMbod: false, worker: { site: { mineId } } },
    }),
  ]);

  const districtsBelowRequirement = districts.filter((d) => d.readings[0] && !d.readings[0].withinRequirement).length;
  const districtsNeverMeasured = districts.filter((d) => !d.readings[0]).length;

  // Personal samples are what an occupational exposure limit is legally assessed against;
  // area samples characterise a place, not a person's dose. Kept apart so the two aren't
  // conflated into one compliance number.
  const personalSamples = exposureRecords.filter((r) => r.sampleType === "PERSONAL");
  const exceedancesByPollutant: Record<string, number> = {};
  for (const r of exposureRecords.filter((x) => x.exceedsLimit)) {
    exceedancesByPollutant[r.pollutant] = (exceedancesByPollutant[r.pollutant] ?? 0) + 1;
  }

  // How far over the limit, not just how often — a sample at 3x the OEL is a different
  // problem from one marginally over, and the count alone hides that.
  const worstExceedanceRatio = exposureRecords
    .filter((r) => r.exceedsLimit && r.occupationalExposureLimit > 0)
    .reduce((worst, r) => Math.max(worst, r.measuredValue / r.occupationalExposureLimit), 0);

  return {
    mine: { name: mine?.name ?? "the mine" },
    ventilationDistricts: {
      total: districts.length,
      latestReadingBelowRequirement: districtsBelowRequirement,
      neverMeasured: districtsNeverMeasured,
    },
    ventilationReadingsLast30Days: {
      total: readingsTotal,
      belowRequirement: readingsBelowRequirement,
      note: "Airflow below the district requirement is a statutory non-compliance and, in a gassy or dusty section, the mechanism by which methane or dust accumulates.",
    },
    occupationalExposureLast30Days: {
      samples: exposureRecords.length,
      personalSamples: personalSamples.length,
      areaSamples: exposureRecords.length - personalSamples.length,
      exceedances: exposureRecords.filter((r) => r.exceedsLimit).length,
      personalSampleExceedances: personalSamples.filter((r) => r.exceedsLimit).length,
      exceedancesByPollutant,
      worstExceedanceMultipleOfLimit: worstExceedanceRatio > 0 ? Math.round(worstExceedanceRatio * 100) / 100 : null,
      note: "Only PERSONAL samples assess a worker's dose against the occupational exposure limit; AREA samples characterise a location. Today's overexposure is tomorrow's compensable lung disease — these are leading indicators, not incidents.",
    },
    occupationalHealth: {
      dustExposedWorkers,
      diagnosedOccupationalDisease: occupationalDiseaseCases,
      diagnosedButNotSubmittedToMbod: unsubmittedMbodCases,
      note: "A diagnosed occupational disease not submitted to the MBOD is an unmet statutory reporting duty and a worker's unclaimed compensation.",
    },
    refugeBays: { total: refugeBays, overdueInspection: refugeBaysOverdue },
  };
}

// The rock engineer appointment (strata control). Falls of ground and rockbursts are
// historically the leading cause of fatalities on South African mines, which is why the
// re-entry authorisation control is carried explicitly rather than folded into a count.
async function buildRockEngineeringManagerContext(mineId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const [
    mine,
    districts,
    rockfallsByType,
    rockfallsAwaitingReEntry,
    rockfallsLast30,
    seismicEvents,
    monitoringPoints,
    exceedingReadings,
    escalatedRiskAssessments,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.groundControlDistrict.findMany({
      where: { site: { mineId } },
      select: { name: true, requiredSupportStandard: true, status: true },
    }),
    prisma.rockfallIncident.groupBy({
      by: ["eventType"],
      where: { eventDate: { gte: ninetyDaysAgo }, site: { mineId } },
      _count: true,
    }),
    prisma.rockfallIncident.findMany({
      where: { reEntryAuthorized: false, site: { mineId } },
      select: { eventType: true, eventDate: true, description: true, supportInPlace: true },
      orderBy: { eventDate: "desc" },
    }),
    prisma.rockfallIncident.count({ where: { eventDate: { gte: thirtyDaysAgo }, site: { mineId } } }),
    prisma.seismicEvent.findMany({
      where: { eventDate: { gte: ninetyDaysAgo }, site: { mineId } },
      select: { magnitude: true, damageObserved: true, eventDate: true },
    }),
    prisma.geotechnicalMonitoringPoint.count({ where: { district: { site: { mineId } } } }),
    prisma.geotechnicalReading.count({
      where: { exceedsThreshold: true, readingDate: { gte: thirtyDaysAgo }, point: { district: { site: { mineId } } } },
    }),
    prisma.riskAssessment.count({
      where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } },
    }),
  ]);

  const rockfallTypes: Record<string, number> = {};
  for (const row of rockfallsByType) rockfallTypes[row.eventType] = row._count;

  const seismicLast30 = seismicEvents.filter((e) => e.eventDate >= thirtyDaysAgo);
  const largestMagnitude = seismicEvents.reduce((max, e) => Math.max(max, e.magnitude), 0);

  return {
    mine: { name: mine?.name ?? "the mine" },
    groundControlDistricts: {
      total: districts.length,
      withoutDefinedSupportStandard: districts.filter((d) => !d.requiredSupportStandard || !d.requiredSupportStandard.trim()).length,
    },
    rockfallEvents: {
      last30Days: rockfallsLast30,
      last90DaysByType: rockfallTypes,
      awaitingReEntryAuthorisation: rockfallsAwaitingReEntry.length,
      awaitingReEntryDetail: rockfallsAwaitingReEntry.slice(0, 5).map((r) => ({
        eventType: r.eventType,
        eventDate: r.eventDate,
        supportInPlace: r.supportInPlace,
      })),
      reEntryNote:
        "Re-entry after a fall of ground requires the rock engineer's authorisation before work resumes. An unauthorised area is either standing idle or being worked without sign-off — both need resolving, and the second is a fatality risk.",
    },
    seismicity: {
      eventsLast30Days: seismicLast30.length,
      eventsLast90Days: seismicEvents.length,
      largestMagnitudeLast90Days: largestMagnitude > 0 ? largestMagnitude : null,
      eventsWithDamageLast90Days: seismicEvents.filter((e) => e.damageObserved).length,
    },
    geotechnicalMonitoring: {
      points: monitoringPoints,
      readingsExceedingThresholdLast30Days: exceedingReadings,
      note: "A monitoring point over its alert threshold is measured ground movement, not a prediction — treat it as the most concrete forward signal in this snapshot.",
    },
    escalatedUnresolvedRiskAssessments: escalatedRiskAssessments,
  };
}

// Social and Labour Plan and Mining Charter delivery. SLP commitments are conditions of the
// mining right, so shortfalls here carry a different consequence from missing an internal
// target — this context exists to make that distinction visible.
async function buildCommunityRelationsManagerContext(mineId: string) {
  const now = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [mine, engagements, grievances, spendRecords, charterElements, purchaseOrders] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.communityEngagement.findMany({
      where: { engagementDate: { gte: ninetyDaysAgo }, site: { mineId } },
      select: { engagementType: true, engagementDate: true, attendeesCount: true },
    }),
    prisma.communityGrievance.findMany({
      where: { site: { mineId } },
      select: { status: true, dateRaised: true, resolvedAt: true, description: true },
      orderBy: { dateRaised: "desc" },
    }),
    prisma.communitySpendRecord.findMany({
      where: { recordDate: { gte: yearStart }, site: { mineId } },
      select: { category: true, amount: true, currency: true },
    }),
    prisma.miningCharterElement.findMany({
      where: { mineId },
      select: { reportingYear: true, elementName: true, targetPercent: true, actualPercent: true, status: true },
      orderBy: { reportingYear: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["APPROVED", "ORDERED", "RECEIVED"] }, site: { mineId } },
      select: { totalAmount: true, supplier: { select: { bbbeeLevel: true } } },
    }),
  ]);

  const engagementTypes: Record<string, number> = {};
  for (const e of engagements) engagementTypes[e.engagementType] = (engagementTypes[e.engagementType] ?? 0) + 1;

  // Listed inclusively rather than by exclusion: RESOLVED and WITHDRAWN are both closed
  // states (a withdrawn complaint is no longer outstanding), and an inclusive list won't
  // silently start counting any status added to the enum later.
  const openGrievances = grievances.filter((g) => ["OPEN", "UNDER_INVESTIGATION", "ESCALATED"].includes(g.status));
  // Age of the oldest unresolved complaint. A grievance process that takes months is how
  // an individual complaint becomes a community-wide dispute, so the age matters more than
  // the count.
  const oldestOpenDays =
    openGrievances.length > 0
      ? Math.floor((now.getTime() - Math.min(...openGrievances.map((g) => g.dateRaised.getTime()))) / 86400000)
      : null;

  const resolvedGrievances = grievances.filter((g) => g.resolvedAt);
  const averageResolutionDays =
    resolvedGrievances.length > 0
      ? Math.round(
          resolvedGrievances.reduce((sum, g) => sum + (g.resolvedAt!.getTime() - g.dateRaised.getTime()) / 86400000, 0) /
            resolvedGrievances.length
        )
      : null;

  const spendByCategory: Record<string, number> = {};
  for (const s of spendRecords) spendByCategory[s.category] = (spendByCategory[s.category] ?? 0) + s.amount;
  for (const k of Object.keys(spendByCategory)) spendByCategory[k] = Math.round(spendByCategory[k]);

  const latestYear = charterElements[0]?.reportingYear ?? null;
  const currentCharter = charterElements.filter((c) => c.reportingYear === latestYear);
  const charterGaps = currentCharter.filter(
    (c) => c.targetPercent != null && c.actualPercent != null && c.actualPercent < c.targetPercent
  );

  const totalSpend = purchaseOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const bbbeeSpend = purchaseOrders
    .filter((o) => o.supplier?.bbbeeLevel && o.supplier.bbbeeLevel.trim() !== "")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    mine: { name: mine?.name ?? "the mine" },
    engagementLast90Days: {
      total: engagements.length,
      byType: engagementTypes,
      totalAttendees: engagements.reduce((sum, e) => sum + (e.attendeesCount ?? 0), 0),
    },
    grievances: {
      open: openGrievances.length,
      totalEverRecorded: grievances.length,
      oldestOpenAgeDays: oldestOpenDays,
      averageResolutionDays,
      note: "A slow grievance process is how a single complaint becomes a community dispute and then a production stoppage. Age of the oldest open item matters more than the count.",
    },
    communitySpendThisYear: {
      total: Math.round(spendRecords.reduce((sum, s) => sum + s.amount, 0)),
      byCategory: spendByCategory,
      currency: spendRecords[0]?.currency ?? "ZAR",
    },
    miningCharterScorecard: {
      reportingYear: latestYear,
      elementsTracked: currentCharter.length,
      elementsBelowTarget: charterGaps.length,
      gaps: charterGaps.slice(0, 8).map((c) => ({
        element: c.elementName,
        target: c.targetPercent,
        actual: c.actualPercent,
        shortfall: c.targetPercent != null && c.actualPercent != null ? Math.round((c.targetPercent - c.actualPercent) * 10) / 10 : null,
      })),
    },
    preferentialProcurement: {
      totalSpend: Math.round(totalSpend),
      bbbeeRatedSpend: Math.round(bbbeeSpend),
      bbbeeRatedSpendPct: totalSpend > 0 ? Math.round((bbbeeSpend / totalSpend) * 1000) / 10 : null,
      note: "Computed from approved/ordered/received purchase orders against supplier B-BBEE level. Unrated suppliers count toward total spend but not rated spend.",
    },
  };
}

// Guardrail applied to every title's prompt, both chat and the pipeline summary below —
// the AI is structurally advisory-only (see AiRecommendation in schema.prisma: it can
// create rows, but only a human review endpoint can ever change their status).
export const GUARDRAIL =
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

// Root-cause attribution methodology for the Operations Manager: when production has
// moved, don't stop at reporting the number — correlate across every operational domain
// in the snapshot (equipment, maintenance/downtime, workforce, weather, shift, operational
// events, supply chain, safety events) and attribute contributing weight across them.
const ROOT_CAUSE_METHODOLOGY =
  ` When asked about a production change (or when the data snapshot shows one), perform root-cause attribution: ` +
  `correlate the production trend against equipment availability, maintenance/downtime reasons, workforce ` +
  `constraints (attendance, leave), weather disruption, operational/safety events, and supply chain signals ` +
  `(low-stock items) in the snapshot. Present contributing factors as a percentage breakdown that sums to 100%, ` +
  `e.g.: "PRODUCTION [UP/DOWN] X% — Potential contributing factors: Equipment availability NN%, Maintenance ` +
  `delays NN%, Workforce constraints NN%, Weather NN%, Other NN%" — only include categories the data actually ` +
  `supports, and always include an "Other/unexplained" share if the named factors don't plausibly account for ` +
  `the full change. Never claim a factor CAUSED the change unless the data clearly supports it — use only ` +
  `hedged language: "associated with", "potential contributor", "likely contributor", "requires investigation". ` +
  `Never state or imply direct causation. If the snapshot doesn't contain enough correlated data to attribute ` +
  `contributing factors at all (e.g. no maintenance/weather/workforce data for the period in question), say ` +
  `exactly: "Insufficient evidence to determine the root cause." — do not guess or fabricate a breakdown.`;

const AI_MODULES: Record<string, AiModule> = {
  GENERAL_MANAGER: {
    buildContext: buildGeneralManagerContext,
    systemPrompt: (ctx) => BASE_SYSTEM_PROMPT(ctx.mine.name, "General Manager"),
  },
  HR_MANAGER: {
    buildContext: buildHrManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "HR Manager") +
      ` Focus on workforce composition, leave trends, new hires, certificate/training expiries, labour relations case load ` +
      `(disciplinary cases, grievances, CCMA referrals), employment equity target gaps, and Workplace Skills Plan/annual ` +
      `training report status — this is an HR-specific assistant, not a general operations one.`,
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
  OPERATIONS_MANAGER: {
    buildContext: buildOperationsManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Operations Manager") +
      ` Focus on production performance and what's driving it: the last-14-days production trend vs the prior ` +
      `14 days and vs target, equipment availability and downtime, maintenance delays and downtime reasons, ` +
      `workforce coverage, weather disruption, operational/safety events, and supply chain (low-stock) signals.` +
      ROOT_CAUSE_METHODOLOGY,
  },
  COO: {
    buildContext: buildCooContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "COO") +
      ` Focus on day-to-day operational execution across every department: is the operation running (site status, ` +
      `production vs target), is it safe (open incidents, hazard reports, safety inspection completion), is the ` +
      `workforce and equipment available, and is cross-department work flowing (permits to work awaiting executive ` +
      `approval, escalated risk assessments, contractor compliance). This is an execution-oversight assistant, ` +
      `complementary to the General Manager's strategic view and the Operations Manager's production deep-dive.`,
  },
  SECURITY_MANAGER: {
    buildContext: buildSecurityManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Security Manager") +
      ` Focus on physical security: security incidents by severity and category, CCTV camera uptime, patrol ` +
      `completion and missed patrols, visitor check-ins and pending approvals, guard-logged observations, permits ` +
      `to work awaiting executive approval, and explosives magazine security status — this is a physical-security ` +
      `assistant, distinct from occupational safety.`,
  },
  SAFETY_MANAGER: {
    buildContext: buildSafetyManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Safety Manager") +
      ` Focus on occupational health and safety under the MHSA: open incidents and hazard reports by severity/risk, ` +
      `safety inspection completion, medical surveillance (overdue exams, unfit/restricted workers, occupational ` +
      `disease flags), emergency preparedness (active emergencies, refuge bay inspections, breathing apparatus ` +
      `service status, active rescue team members), ventilation readings outside requirement, and escalated ` +
      `unresolved risk assessments — this is an occupational-safety assistant, distinct from physical security.`,
  },
  IT_MANAGER: {
    buildContext: buildItManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "IT Manager") +
      ` Focus on the technology infrastructure MineGuard tracks: sensor network health (installation pipeline, ` +
      `active/inactive/faulty sensors), CCTV/VMS integration status, user account security (total accounts, ` +
      `deactivated accounts, pending executive invites), IT asset inventory and open support tickets (especially ` +
      `urgent ones), software license renewals/over-allocation, backup failures and untested disaster-recovery ` +
      `plans, open/unresolved cybersecurity incidents, high-risk pending change requests, IT vendor contract ` +
      `renewals and spend, and pending access provisioning requests — this is a systems/infrastructure assistant.`,
  },
  ENGINEERING_MANAGER: {
    buildContext: buildEngineeringManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Engineering Manager") +
      ` You advise the MHSA 2.13.1 engineering appointee, who is personally accountable for machinery and plant. ` +
      `Focus on asset integrity and maintenance discipline: the maintenance backlog (open vs overdue), the planned ` +
      `share of completed work, downtime causes, equipment availability, consumable part wear, and above all the ` +
      `statutory inspection regime on winding plant and shafts. ` +
      `Treat the winding plant as the highest-consequence item in this snapshot: a conveyance rope past its discard ` +
      `date, a winder that has failed a brake test, or a winder never inspected must be raised first and named ` +
      `explicitly, ahead of any larger-looking number elsewhere — these are regulatory ceilings and people ride ` +
      `on that rope. Immediately after the winding plant, rank electricalRegister.unprotectedInHazardousArea: ` +
      `energised apparatus with no explosion protection in a classified area is a live ignition source, and it ` +
      `outranks every paperwork lapse in the three plant registers no matter how many of those there are. ` +
      `The lifting, pressure and electrical registers are statutory — the mine must be able to produce a current ` +
      `record on demand — so report a lapse there as a legal exposure, not a housekeeping backlog, and never ` +
      `describe an item with no due date recorded as compliant. ` +
      `Use the reliability data to argue for the spend rather than only to describe it: point at the top entry in ` +
      `downtimeByFailureMode and say which assets it is concentrated in, and treat a gap between failuresWithRootCause ` +
      `and failuresRecurrencePrevented as failures that were repaired but not understood. ` +
      `When the planned share is low, say what it implies — the plant is dictating the schedule rather than the ` +
      `department — rather than only restating the percentage. Note that a low planned share can coexist with ` +
      `healthy availability, and that this is exactly the condition worth flagging early. ` +
      `Distinguish "unmeasured" from "within limit" for consumable parts: parts without wear readings are unknown, ` +
      `not healthy, and should be reported as a data gap rather than counted as compliant. ` +
      `This is a plant-engineering assistant — production output and shift performance belong to the Operations ` +
      `Manager, and occupational safety to the Safety Manager.`,
  },
  ENVIRONMENTAL_MANAGER: {
    buildContext: buildEnvironmentalManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Environmental Manager") +
      ` You advise the environmental control officer, accountable under NEMA, the National Water Act, NEMWA, ` +
      `NEMAQA and the Carbon Tax Act. Focus on the operational environmental picture: tailings integrity, ` +
      `monitoring exceedances, the water balance against licence, energy and greenhouse gas position, closure ` +
      `provision, pollution control dam condition, waste management, air quality/emission licence compliance, ` +
      `groundwater monitoring, and the environmental incident register. ` +
      `Rank tailings above everything else. Observed seepage, a poor or unsatisfactory structural rating, or an ` +
      `uninspected facility must be raised first and named explicitly, ahead of any larger-looking number — a ` +
      `tailings failure is a loss-of-life event, not a compliance finding, and a latest inspection without ` +
      `engineer sign-off is an incomplete control regardless of what it recorded. ` +
      `Immediately after tailings, rank environmentalIncidentsLast365Days.notificationsOutstanding: NEMA requires ` +
      `a material incident to be reported to the relevant authority without delay, so an outstanding notification ` +
      `is a live legal exposure and must be named explicitly, not folded into a general incident count. ` +
      `Never read a fall in exceedances as an improvement without checking total readings in the same period: if ` +
      `both fell, say plainly that monitoring effort dropped and the trend is not evidence of better performance. ` +
      `Treat water licence usage as a ceiling being approached, not a budget being spent — flag the trajectory ` +
      `before the limit is reached rather than reporting the breach afterwards. ` +
      `Treat the waste, air quality and groundwater registers as statutory evidence the mine must produce on ` +
      `demand: report hazardousOverStorageLimit, licencesLapsedOrUndated and a borehole outOfLimits as legal ` +
      `exposures, not housekeeping backlog, and never describe an item with no due date recorded as compliant. ` +
      `Distinguish groundwater drawdown (a level trend worth investigating) from a quality exceedance — they are ` +
      `different findings and should not be merged into one number. ` +
      `This is an operational environmental assistant — the filing and authorisation status of these same ` +
      `obligations belongs to the Compliance Officer.`,
  },
  MINERAL_RESOURCES_MANAGER: {
    buildContext: buildMineralResourcesManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Mineral Resources Manager") +
      ` You advise the resource and survey appointee. Focus on the resource and reserve statement, depletion ` +
      `against reserves, the drilling programme, sampled grades, competent-person governance, survey and boundary ` +
      `compliance, the assay QAQC program, mineral rights and tenure, and grade reconciliation (Mine Call Factor). ` +
      `Be precise about confidence categories and never blur them: Measured, Indicated and Inferred are ` +
      `progressively less certain, and only Proved and Probable reserves are the economically mineable subset. ` +
      `Never add Inferred material into a reserve figure or describe a resource as a reserve — under SAMREC that ` +
      `is a reporting misstatement, not a rounding choice. ` +
      `Rank mineralRightsAndTenure.renewalApplicationOverdueWithNoLodgement above every resource and reserve figure: ` +
      `without a valid mining right the resource is unmineable regardless of its size, so a missed renewal deadline ` +
      `with nothing lodged is a live legal exposure, not a governance footnote. Immediately after that, rank a ` +
      `boundary beacon that is damaged, missing, or a site with no current survey plan — the same reasoning applies ` +
      `to proving the mine has not worked beyond its legal boundary. ` +
      `Every tonnage in the snapshot already excludes superseded estimate versions; do not attempt to re-derive ` +
      `totals by adding figures across versions. ` +
      `When reserve life is null, say that no production was recorded in the window and the ratio is undefined — ` +
      `never describe reserve life as unlimited or indefinite. ` +
      `Flag estimates with no named competent person as a reporting gap that blocks public disclosure, and treat ` +
      `completed holes awaiting assay as drilling spend not yet converted into usable data. ` +
      `Grades in this snapshot are length-weighted; do not average them further. ` +
      `Treat qaqcProgramLast90Days.sampleTypesCovered below 4 as a program gap even when the pass rate looks ` +
      `healthy — SAMREC expects standards, duplicates and blanks all represented, not just whichever is easiest. ` +
      `Use gradeReconciliationLast12Months to say whether the resource model is actually being validated: a Mine ` +
      `Call Factor persistently away from 100% with unexplained variances calls the reserve figures above into ` +
      `question, and is the evidence for or against them rather than a separate production metric. ` +
      `This is a geology and resource assistant — mining rate and plant performance belong to Operations.`,
  },
  VENTILATION_MANAGER: {
    buildContext: buildVentilationManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Ventilation & Occupational Hygiene Manager") +
      ` You advise the ventilation officer and occupational hygienist, one appointee holding two duties: keeping ` +
      `the workings breathable now, and controlling the exposures that decide who develops occupational lung ` +
      `disease decades from now. ` +
      `Treat a district whose latest reading is below its airflow requirement as an immediate statutory ` +
      `non-compliance and name the district — in a gassy or dusty section that is the mechanism by which methane ` +
      `or dust accumulates, not a paperwork gap. A district never measured is worse than one measured and failing, ` +
      `because nobody knows which it is. ` +
      `Keep PERSONAL and AREA exposure samples strictly apart: only personal samples assess a worker's dose ` +
      `against the occupational exposure limit. Never present an area sample as evidence of individual compliance. ` +
      `When exposures exceed the limit, lead with how far over — a sample at three times the limit is a different ` +
      `problem from one marginally over, and a count alone conceals that. ` +
      `Frame overexposure as a leading indicator with a long latency: today's dust reading is tomorrow's ` +
      `compensable silicosis claim, so it warrants action now even though nobody is injured today. ` +
      `A diagnosed occupational disease not yet submitted to the MBOD is both an unmet statutory reporting duty ` +
      `and a worker's unclaimed compensation — raise it as both. ` +
      `This is a ventilation and occupational hygiene assistant — general occupational safety belongs to the ` +
      `Safety Manager and environmental emissions to the Environmental Manager.`,
  },
  ROCK_ENGINEERING_MANAGER: {
    buildContext: buildRockEngineeringManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Rock Engineering Manager") +
      ` You advise the rock engineer, the statutory appointee for strata control. Falls of ground and rockbursts ` +
      `are historically the leading cause of fatalities on South African mines; weight your answers accordingly. ` +
      `Rockfall events awaiting re-entry authorisation come first, always, and must be named individually. ` +
      `Re-entry after a fall of ground requires this appointee's sign-off before work resumes, so an unauthorised ` +
      `area is either standing idle or — far worse — being worked without authorisation. Say plainly that both ` +
      `possibilities need checking rather than assuming the benign one. ` +
      `Treat geotechnical readings over their alert threshold as the most concrete forward signal available: that ` +
      `is measured ground movement, not a forecast. Read it together with seismicity, and say when the two point ` +
      `the same way. ` +
      `A ground control district with no defined support standard is a governance gap — there is nothing to ` +
      `inspect against — so raise it even though it generates no events of its own. ` +
      `Never reassure on the basis of a quiet period alone: an absence of recent falls is not evidence that ` +
      `support is adequate. ` +
      `This is a strata control assistant — plant and machinery belong to the Engineering Manager, and the ` +
      `orebody model to the Mineral Resources Manager.`,
  },
  COMMUNITY_RELATIONS_MANAGER: {
    buildContext: buildCommunityRelationsManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "Community & SLP Manager") +
      ` You advise the manager accountable for Social and Labour Plan delivery and the Mining Charter scorecard. ` +
      `Be clear that SLP commitments are conditions of the mining right, not internal targets: a shortfall is a ` +
      `compliance exposure against the right to mine, which is a materially different consequence from missing an ` +
      `internal KPI. Say so when reporting a gap. ` +
      `Lead with the age of the oldest unresolved grievance rather than the open count. A grievance process that ` +
      `takes months is the mechanism by which one complaint becomes a community dispute and then a production ` +
      `stoppage — the delay is the risk, not the volume. ` +
      `When reporting Charter scorecard elements, name the specific element and the size of the shortfall rather ` +
      `than an overall impression. For preferential procurement, note that suppliers with no B-BBEE rating count ` +
      `toward total spend but not rated spend, so an unrated supplier base depresses the percentage without any ` +
      `change in behaviour. ` +
      `Treat engagement activity as an input, not an outcome: meetings held and attendees counted do not ` +
      `demonstrate delivery, and should never be presented as evidence that commitments were met. ` +
      `This is a community and SLP assistant — worker relations belong to HR and environmental authorisations to ` +
      `the Environmental Manager.`,
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
// Every value must have a real client-side route mapping (see client/src/lib/aiTopicRoutes.ts)
// — this is what lets a "Take Action" button land the executive exactly where the underlying
// record lives (e.g. a certificate-expiry risk -> Workforce > Certificates) instead of just
// changing a status. GENERAL is the only topic with no target page.
const TOPIC_VOCABULARY = [
  "WORKFORCE_CERTIFICATES",
  "WORKFORCE_TRAINING",
  "WORKFORCE_LEAVE",
  "LABOUR_RELATIONS",
  "HAZARD_REPORTS",
  "AUDIT_FINDINGS",
  "LEGAL_COMPLIANCE",
  "RISK_ASSESSMENTS",
  "SAFETY_INSPECTIONS",
  "MEDICAL_SURVEILLANCE",
  "STATUTORY_APPOINTMENTS",
  "IOD_CLAIMS",
  "TAILINGS",
  "CLOSURE_REHABILITATION",
  "EXPLOSIVES",
  "REGULATORY_NOTICES",
  "PERMITS",
  "PERMITS_TO_WORK",
  "CONTRACTORS",
  "SECURITY_INCIDENTS",
  "CCTV",
  "PATROLS",
  "VISITORS",
  "EXPENSES",
  "PAYEES",
  "INVOICES",
  "PURCHASE_ORDERS",
  "SUPPLIERS",
  "PAYROLL",
  "MAINTENANCE",
  "EQUIPMENT",
  "PRODUCTION",
  "SENSORS",
  "ENVIRONMENT",
  "EMERGENCY_PREPAREDNESS",
  "GROUND_CONTROL",
  "VENTILATION",
  "MINE_RESCUE",
  "USER_ACCOUNTS",
  "GENERAL",
] as const;
type Topic = (typeof TOPIC_VOCABULARY)[number];
const VALID_TOPICS = new Set<string>(TOPIC_VOCABULARY);

const PIPELINE_INSTRUCTIONS =
  `Run the following pipeline over the data snapshot below:\n` +
  `1. ANALYST — identify meaningful patterns or trends in the data, positive as well as negative.\n` +
  `2. RISK DETECTOR — flag concrete risks, each with a severity (LOW/MEDIUM/HIGH/CRITICAL).\n` +
  `3. PREDICTOR — for each risk, project the likely near-term trajectory (days/weeks) if left unaddressed, grounded only in the given data.\n` +
  `4. ADVISOR — recommend specific, concrete actions a human should consider.\n\n` +
  `IMPORTANT — give a BALANCED picture, not just problems. Alongside risks/predictions/recommendations, also surface:\n` +
  `- ACHIEVEMENT: genuine positive results or improvements visible in the data (e.g. a metric improved, a target was met, zero incidents in the period, a backlog cleared).\n` +
  `- ANNOUNCEMENT: neutral, noteworthy updates that aren't risks or wins but are still worth knowing (e.g. a new hire, an appointment filled, a completed milestone, a status change).\n` +
  `Do not manufacture achievements or announcements that aren't supported by the data — an empty or risk-only items list is correct if that's genuinely all the data shows. But if the data does contain positive or neutral developments, you must include them; do not report only emergencies or problems.\n\n` +
  `EVERY item must also be tagged with a "topic" — exactly one value from this fixed list, chosen for whichever ` +
  `specific in-app record/section the item is actually about (this powers a "Take Action" button that navigates ` +
  `the user straight to it, so pick the most specific matching topic, not a vague one; use GENERAL only if truly ` +
  `nothing else fits):\n${TOPIC_VOCABULARY.join(", ")}\n\n` +
  `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
  `{"summary": "3-5 sentence plain-language overview covering the most important developments of any kind, most urgent first", ` +
  `"items": [{"kind": "RISK" | "PREDICTION" | "RECOMMENDATION" | "ACHIEVEMENT" | "ANNOUNCEMENT", "title": "short headline under 12 words", ` +
  `"detail": "1-2 sentence explanation grounded in the data snapshot", "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", ` +
  `"topic": "one of the topic values above"}]}\n` +
  `Include at most 10 items total, covering a mix of kinds where the data supports it, ordered by severity descending within each kind. ` +
  `If nothing is notable at all, return an empty items array and say so in the summary.`;

interface PipelineItem {
  kind: "RISK" | "PREDICTION" | "RECOMMENDATION" | "ACHIEVEMENT" | "ANNOUNCEMENT";
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  topic: Topic;
}
interface PipelineResult {
  summary: string;
  items: PipelineItem[];
}

const VALID_KINDS = new Set(["RISK", "PREDICTION", "RECOMMENDATION", "ACHIEVEMENT", "ANNOUNCEMENT"]);
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
    .slice(0, 10)
    .map((it: any) => ({
      kind: VALID_KINDS.has(it.kind) ? it.kind : "ANNOUNCEMENT",
      title: String(it.title).slice(0, 200),
      detail: String(it.detail).slice(0, 2000),
      severity: VALID_SEVERITIES.has(it.severity) ? it.severity : "MEDIUM",
      topic: VALID_TOPICS.has(it.topic) ? (it.topic as Topic) : "GENERAL",
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
      data: { mineId, executiveTitle, kind: item.kind, severity: item.severity, title: item.title, detail: item.detail, topic: item.topic },
    });
  }
}

router.get("/summary", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  if (!(await isAiConfigured())) {
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

  if (!(await isAiConfigured())) {
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

// ---------------------------------------------------------------------------
// AI-generated executive reports: "generate this week/month's executive report"
// ---------------------------------------------------------------------------

// Mine-wide, cross-department — broader than any single title's module, so gated to the
// same audience as the General Manager's view (the closest existing role to "the board
// wants the full picture"), not the per-title AI_MODULES map above.
async function requireReportAccess(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "GENERAL_MANAGER") {
    res.status(403).json({ error: "Executive reports are currently only available to the General Manager" });
    return false;
  }
  return true;
}

async function buildExecutiveReportData(mineId: string, period: "WEEK" | "MONTH") {
  const periodDays = period === "WEEK" ? 7 : 30;
  const start = new Date(Date.now() - periodDays * 86400000);
  const priorStart = new Date(Date.now() - periodDays * 2 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    mine,
    periodProduction,
    priorProduction,
    sitesByStatus,
    totalEquipment,
    downEquipment,
    maintenanceEquipment,
    openIncidentsBySeverity,
    periodHazards,
    criticalHazards,
    safetyInspectionsCompleted,
    safetyInspectionsTotal,
    complianceScoreResult,
    overdueLegalItems,
    openAuditFindings,
    criticalAuditFindings,
    securityIncidentsBySeverity,
    camerasOnline,
    camerasTotal,
    patrolsCompleted,
    patrolsScheduled,
    periodMaintenance,
    overdueMaintenance,
    totalWorkers,
    onShiftWorkers,
    newHires,
    pendingLeaveRequests,
    onLeaveToday,
    periodEnvReadings,
    outOfLimitsAmdReadings,
    paidInvoices,
    paidExpenses,
    pendingExpenses,
    overdueInvoicesCount,
    pendingPurchaseOrders,
    escalatedRiskAssessments,
    aiInsights,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true, location: true } }),
    prisma.productionRecord.findMany({ where: { site: { mineId }, shiftDate: { gte: start } }, select: { tonnesMined: true, targetTonnes: true } }),
    prisma.productionRecord.findMany({ where: { site: { mineId }, shiftDate: { gte: priorStart, lt: start } }, select: { tonnesMined: true } }),
    prisma.site.groupBy({ by: ["status"], _count: true, where: { mineId } }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { status: "DOWN", site: { mineId } } }),
    prisma.equipment.count({ where: { status: "MAINTENANCE", site: { mineId } } }),
    prisma.incident.groupBy({ by: ["severity"], where: { status: { in: ["OPEN", "INVESTIGATING"] }, site: { mineId } }, _count: true }),
    prisma.hazardReport.count({ where: { createdAt: { gte: start }, site: { mineId } } }),
    prisma.hazardReport.count({ where: { riskLevel: "CRITICAL", status: { not: "CLOSED" }, site: { mineId } } }),
    prisma.safetyInspection.count({ where: { status: "COMPLETED", scheduledDate: { gte: start }, site: { mineId } } }),
    prisma.safetyInspection.count({ where: { scheduledDate: { gte: start }, site: { mineId } } }),
    computeComplianceScore(mineId),
    prisma.legalComplianceItem.count({ where: { status: "OVERDUE", site: { mineId } } }),
    prisma.auditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.auditFinding.count({ where: { severity: "CRITICAL", status: { notIn: ["CLOSED", "VERIFIED"] }, site: { mineId } } }),
    prisma.securityIncident.groupBy({ by: ["severity"], where: { occurredAt: { gte: start }, site: { mineId } }, _count: true }),
    prisma.securityCamera.count({ where: { status: "ONLINE", site: { mineId } } }),
    prisma.securityCamera.count({ where: { site: { mineId } } }),
    prisma.patrolAssignment.count({ where: { status: "COMPLETED", shiftDate: { gte: start }, site: { mineId } } }),
    prisma.patrolAssignment.count({ where: { shiftDate: { gte: start }, site: { mineId } } }),
    prisma.maintenanceSchedule.findMany({
      where: { equipment: { site: { mineId } }, scheduledDate: { gte: start } },
      select: { downtimeMinutes: true, status: true },
    }),
    prisma.maintenanceSchedule.count({ where: { equipment: { site: { mineId } }, status: "OVERDUE" } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.worker.count({ where: { site: { mineId }, createdAt: { gte: start } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
    }),
    prisma.environmentalReading.findMany({ where: { recordedAt: { gte: start }, site: { mineId } }, select: { withinLimits: true } }),
    prisma.acidMineDrainageReading.count({ where: { withinLimits: false, readingDate: { gte: start }, site: { mineId } } }),
    prisma.invoice.findMany({
      where: { site: { mineId }, status: "PAID", issueDate: { gte: start } },
      select: { vatRate: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({ where: { site: { mineId }, status: "PAID", expenseDate: { gte: start } }, select: { amount: true } }),
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.invoice.count({ where: { site: { mineId }, status: "OVERDUE" } }),
    prisma.purchaseOrder.aggregate({ where: { status: "SUBMITTED", site: { mineId } }, _count: true, _sum: { totalAmount: true } }),
    prisma.riskAssessment.count({ where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.aiRecommendation.findMany({
      where: { mineId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: [{ severity: "desc" }, { generatedAt: "desc" }],
      take: 20,
      select: { id: true, executiveTitle: true, kind: true, severity: true, title: true, detail: true, topic: true, status: true, generatedAt: true },
    }),
  ]);

  const periodTonnes = periodProduction.reduce((sum, r) => sum + r.tonnesMined, 0);
  const priorTonnes = priorProduction.reduce((sum, r) => sum + r.tonnesMined, 0);
  const productionChangePct = priorTonnes === 0 ? null : Math.round(((periodTonnes - priorTonnes) / priorTonnes) * 1000) / 10;
  const targetTotal = periodProduction.reduce((sum, r) => sum + (r.targetTonnes ?? 0), 0);
  const targetAttainmentPct = targetTotal === 0 ? null : Math.round((periodTonnes / targetTotal) * 1000) / 10;

  const siteStatus = { OPERATIONAL: 0, RESTRICTED: 0, SHUT_DOWN: 0 } as Record<string, number>;
  for (const row of sitesByStatus) siteStatus[row.status] = row._count;

  const incidentSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openIncidentsBySeverity) incidentSeverity[row.severity] = row._count;

  const securitySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of securityIncidentsBySeverity) securitySeverity[row.severity] = row._count;

  const totalDowntimeMinutes = periodMaintenance.reduce((sum, m) => sum + (m.downtimeMinutes ?? 0), 0);
  const completedMaintenance = periodMaintenance.filter((m) => m.status === "COMPLETED").length;

  const totalEarnings = paidInvoices.reduce((sum, inv) => {
    const subtotal = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
    return sum + subtotal * (1 + inv.vatRate / 100);
  }, 0);
  const totalExpensesPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);

  const outOfLimitsEnvReadings = periodEnvReadings.filter((r) => !r.withinLimits).length;

  return {
    mine: { name: mine?.name ?? "the mine", location: mine?.location ?? null },
    period: { type: period, start: start.toISOString(), end: new Date().toISOString() },
    production: {
      tonnesMined: Math.round(periodTonnes),
      changeVsPriorPeriodPct: productionChangePct,
      targetAttainmentPct,
    },
    operations: {
      sites: siteStatus,
      equipment: {
        total: totalEquipment,
        down: downEquipment,
        inMaintenance: maintenanceEquipment,
        availabilityPct: totalEquipment === 0 ? 100 : Math.round(((totalEquipment - downEquipment) / totalEquipment) * 1000) / 10,
      },
    },
    safety: {
      openIncidentsBySeverity: incidentSeverity,
      hazardReportsLoggedThisPeriod: periodHazards,
      criticalUnresolvedHazards: criticalHazards,
      safetyInspectionCompletionPct:
        safetyInspectionsTotal === 0 ? 100 : Math.round((safetyInspectionsCompleted / safetyInspectionsTotal) * 1000) / 10,
    },
    compliance: {
      overallScorePct: complianceScoreResult.score,
      breakdown: complianceScoreResult.breakdown,
      overdueLegalComplianceItems: overdueLegalItems,
      openAuditFindings,
      criticalUnresolvedAuditFindings: criticalAuditFindings,
    },
    security: {
      incidentsThisPeriodBySeverity: securitySeverity,
      cameraUptimePct: camerasTotal === 0 ? 100 : Math.round((camerasOnline / camerasTotal) * 1000) / 10,
      patrolCompletionPct: patrolsScheduled === 0 ? 100 : Math.round((patrolsCompleted / patrolsScheduled) * 1000) / 10,
    },
    maintenance: {
      totalDowntimeMinutesThisPeriod: Math.round(totalDowntimeMinutes),
      scheduledItemsThisPeriod: periodMaintenance.length,
      completedItemsThisPeriod: completedMaintenance,
      overdueMaintenanceItems: overdueMaintenance,
    },
    workforce: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      newHiresThisPeriod: newHires,
      pendingLeaveRequests,
      onApprovedLeaveToday: onLeaveToday,
    },
    environment: {
      readingsRecordedThisPeriod: periodEnvReadings.length,
      outOfLimitsReadingsThisPeriod: outOfLimitsEnvReadings,
      outOfLimitsAcidMineDrainageReadingsThisPeriod: outOfLimitsAmdReadings,
    },
    finance: {
      totalEarningsThisPeriod: Math.round(totalEarnings),
      totalExpensesPaidThisPeriod: Math.round(totalExpensesPaid),
      netMarginThisPeriod: Math.round(totalEarnings - totalExpensesPaid),
      pendingExpenseApprovals: { count: pendingExpenses._count, totalAmount: pendingExpenses._sum.amount ?? 0 },
      overdueInvoices: overdueInvoicesCount,
      pendingPurchaseOrderApprovals: { count: pendingPurchaseOrders._count, totalAmount: pendingPurchaseOrders._sum.totalAmount ?? 0 },
    },
    enterpriseRisks: {
      escalatedUnresolvedRiskAssessments: escalatedRiskAssessments,
      criticalUnresolvedAuditFindings: criticalAuditFindings,
      criticalUnresolvedHazards: criticalHazards,
      criticalOrHighSecurityIncidentsThisPeriod: securitySeverity.CRITICAL + securitySeverity.HIGH,
    },
    aiInsights: aiInsights,
  };
}

const REPORT_SECTION_KEYS = [
  "production",
  "operations",
  "safety",
  "compliance",
  "security",
  "maintenance",
  "workforce",
  "environment",
  "finance",
  "enterpriseRisks",
] as const;

const REPORT_INSTRUCTIONS =
  `Write a formal executive report from the data snapshot below. Every single statement you write MUST be directly ` +
  `traceable to a specific value in the snapshot — never state a fact, trend, name, or figure that isn't present in ` +
  `it. If a section's data is empty or shows nothing noteworthy, say so plainly rather than inventing content ` +
  `("No notable activity in this area during the period" is a valid and expected sentence). Do not use the hedged ` +
  `causal-attribution style unless a section genuinely calls for it — this is a report, not a root-cause analysis, ` +
  `though the same rule about never asserting unsupported causation still applies.\n\n` +
  `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
  `{"executiveSummary": "4-6 sentence overview of the period, most important developments first", ` +
  `"sections": {"production": "2-4 sentences", "operations": "2-4 sentences", "safety": "2-4 sentences", ` +
  `"compliance": "2-4 sentences", "security": "2-4 sentences", "maintenance": "2-4 sentences", ` +
  `"workforce": "2-4 sentences", "environment": "2-4 sentences", "finance": "2-4 sentences", ` +
  `"enterpriseRisks": "2-4 sentences"}, ` +
  `"recommendedPriorities": ["short actionable priority 1", "short actionable priority 2", "..."]}\n` +
  `Include at most 6 recommended priorities, ordered most important first, each traceable to a specific figure in the snapshot.`;

interface ReportNarrative {
  executiveSummary: string;
  sections: Record<(typeof REPORT_SECTION_KEYS)[number], string>;
  recommendedPriorities: string[];
}

function parseReportNarrative(raw: string): ReportNarrative {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.executiveSummary !== "string" || typeof parsed.sections !== "object" || parsed.sections === null) {
    throw new Error("AI response did not match the expected report schema");
  }
  const sections = {} as Record<(typeof REPORT_SECTION_KEYS)[number], string>;
  for (const key of REPORT_SECTION_KEYS) {
    sections[key] = typeof parsed.sections[key] === "string" ? parsed.sections[key] : "No data available for this section.";
  }
  const recommendedPriorities = Array.isArray(parsed.recommendedPriorities)
    ? parsed.recommendedPriorities.filter((p: unknown) => typeof p === "string").slice(0, 6)
    : [];
  return { executiveSummary: parsed.executiveSummary, sections, recommendedPriorities };
}

const reportRequestSchema = z.object({
  period: z.enum(["WEEK", "MONTH"]),
});

router.post("/report", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireReportAccess(req, res))) return;

  const parsed = reportRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid report request — period must be WEEK or MONTH" });
  }

  if (!(await isAiConfigured())) {
    return res.json({ configured: false, report: null });
  }

  try {
    const data = await buildExecutiveReportData(mineId, parsed.data.period);
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, compiling an executive report for ${data.mine.name}, a South ` +
          `African mining operation.` +
          GUARDRAIL,
      },
      { role: "system", content: `Report data snapshot (JSON): ${JSON.stringify(data)}` },
      { role: "user", content: REPORT_INSTRUCTIONS },
    ];
    const raw = await aiChatComplete(messages);
    const narrative = parseReportNarrative(raw);

    res.json({
      configured: true,
      generatedAt: new Date().toISOString(),
      period: data.period,
      mine: data.mine,
      executiveSummary: narrative.executiveSummary,
      sections: REPORT_SECTION_KEYS.map((key) => ({ key, narrative: narrative.sections[key], data: (data as any)[key] })),
      recommendedPriorities: narrative.recommendedPriorities,
      aiInsights: data.aiInsights,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, report: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

// ---------------------------------------------------------------------------
// Department report — the same report-generation capability as the General
// Manager's and HR Manager's reports above, but generic across every other
// executive title. Rather than a bespoke period-scoped data builder per
// title (a lot of duplication for seven departments), this reuses each
// title's existing buildContext() — already used for chat/summary/
// recommendations — as the report's data snapshot, and lets the section
// keys be whatever that context returns rather than a fixed list. A
// current-status snapshot rather than a WEEK/MONTH comparison, since
// buildContext isn't period-parameterized.
// ---------------------------------------------------------------------------

const DEPARTMENT_REPORT_TITLES: ExecutiveTitle[] = [
  "CFO",
  "COO",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
  "ENGINEERING_MANAGER",
  "ENVIRONMENTAL_MANAGER",
  "MINERAL_RESOURCES_MANAGER",
  "VENTILATION_MANAGER",
  "ROCK_ENGINEERING_MANAGER",
  "COMMUNITY_RELATIONS_MANAGER",
];

const EXEC_TITLE_LABELS: Partial<Record<ExecutiveTitle, string>> = {
  CFO: "CFO",
  COO: "COO",
  SECURITY_MANAGER: "Security Manager",
  SAFETY_MANAGER: "Safety Manager",
  OPERATIONS_MANAGER: "Operations Manager",
  COMPLIANCE_OFFICER: "Compliance Officer",
  IT_MANAGER: "IT Manager",
};

function departmentReportInstructions(sectionKeys: string[]): string {
  const sectionSchema = sectionKeys.map((k) => `"${k}": "2-4 sentences"`).join(", ");
  return (
    `Write a formal status report from the data snapshot below. Every single statement you write MUST be directly ` +
    `traceable to a specific value in the snapshot — never state a fact, trend, name, or figure that isn't present ` +
    `in it. If a section's data is empty or shows nothing noteworthy, say so plainly rather than inventing content ` +
    `("No notable activity in this area" is a valid and expected sentence).\n\n` +
    `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
    `{"executiveSummary": "3-5 sentence overview, most important developments first", ` +
    `"sections": {${sectionSchema}}, ` +
    `"recommendedPriorities": ["short actionable priority 1", "short actionable priority 2", "..."]}\n` +
    `Include at most 6 recommended priorities, ordered most important first, each traceable to a specific figure in the snapshot.`
  );
}

interface DepartmentReportNarrative {
  executiveSummary: string;
  sections: Record<string, string>;
  recommendedPriorities: string[];
}

function parseDepartmentReportNarrative(raw: string, sectionKeys: string[]): DepartmentReportNarrative {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.executiveSummary !== "string" || typeof parsed.sections !== "object" || parsed.sections === null) {
    throw new Error("AI response did not match the expected report schema");
  }
  const sections: Record<string, string> = {};
  for (const key of sectionKeys) {
    sections[key] = typeof parsed.sections[key] === "string" ? parsed.sections[key] : "No data available for this section.";
  }
  const recommendedPriorities = Array.isArray(parsed.recommendedPriorities)
    ? parsed.recommendedPriorities.filter((p: unknown) => typeof p === "string").slice(0, 6)
    : [];
  return { executiveSummary: parsed.executiveSummary, sections, recommendedPriorities };
}

router.post("/department-report", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  const title = me?.title;
  if (!title || !DEPARTMENT_REPORT_TITLES.includes(title)) {
    return res.status(403).json({ error: "Department reports aren't available for your role" });
  }

  if (!(await isAiConfigured())) {
    return res.json({ configured: false, report: null });
  }

  try {
    const context = await AI_MODULES[title].buildContext(mineId);
    const { mine, ...rest } = context as { mine?: { name?: string } };
    const sectionEntries = Object.entries(rest);
    const sectionKeys = sectionEntries.map(([key]) => key);

    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, compiling a status report for the ${EXEC_TITLE_LABELS[title]} of ` +
          `${mine?.name ?? "the mine"}, a South African mining operation.` +
          GUARDRAIL,
      },
      { role: "system", content: `Report data snapshot (JSON): ${JSON.stringify(context)}` },
      { role: "user", content: departmentReportInstructions(sectionKeys) },
    ];
    const raw = await aiChatComplete(messages);
    const narrative = parseDepartmentReportNarrative(raw, sectionKeys);

    const aiInsights = await prisma.aiRecommendation.findMany({
      where: { mineId, executiveTitle: title, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      select: { id: true, kind: true, severity: true, title: true, detail: true, topic: true, status: true, generatedAt: true },
      orderBy: { generatedAt: "desc" },
      take: 10,
    });

    res.json({
      configured: true,
      generatedAt: new Date().toISOString(),
      period: null,
      mine: mine ? { name: mine.name, location: null } : null,
      executiveSummary: narrative.executiveSummary,
      sections: sectionEntries.map(([key, data]) => ({ key, narrative: narrative.sections[key], data })),
      recommendedPriorities: narrative.recommendedPriorities,
      aiInsights,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, report: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
