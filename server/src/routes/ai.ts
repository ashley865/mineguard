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
  const [
    mine,
    sensorsByInstallationStatus,
    sensorsByStatus,
    totalSensors,
    camerasByIntegrationStatus,
    totalUsers,
    inactiveUsers,
    pendingExecutiveInvites,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.sensor.groupBy({ by: ["installationStatus"], where: { zone: { site: { mineId } } }, _count: true }),
    prisma.sensor.groupBy({ by: ["status"], where: { zone: { site: { mineId } } }, _count: true }),
    prisma.sensor.count({ where: { zone: { site: { mineId } } } }),
    prisma.securityCamera.groupBy({ by: ["integrationStatus"], where: { site: { mineId } }, _count: true }),
    prisma.user.count({ where: { mineId } }),
    prisma.user.count({ where: { mineId, isActive: false } }),
    prisma.executiveInvite.count({ where: { mineId, status: "PENDING" } }),
  ]);

  const installStatus = { REQUESTED: 0, SCHEDULED: 0, INSTALLED: 0, COMMISSIONED: 0 } as Record<string, number>;
  for (const row of sensorsByInstallationStatus) installStatus[row.installationStatus] = row._count;

  const sensorStatus = { ACTIVE: 0, INACTIVE: 0, FAULT: 0 } as Record<string, number>;
  for (const row of sensorsByStatus) sensorStatus[row.status] = row._count;

  const integrationStatus = { CONNECTED: 0, DISCONNECTED: 0, PENDING: 0, NOT_APPLICABLE: 0 } as Record<string, number>;
  for (const row of camerasByIntegrationStatus) integrationStatus[row.integrationStatus] = row._count;

  return {
    mine: { name: mine?.name ?? "the mine" },
    sensors: { total: totalSensors, byInstallationStatus: installStatus, byOperationalStatus: sensorStatus },
    cctvVmsIntegration: { byStatus: integrationStatus },
    userAccounts: { total: totalUsers, deactivated: inactiveUsers, pendingExecutiveInvites },
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
      `active/inactive/faulty sensors), CCTV/VMS integration status, and user account security (total accounts, ` +
      `deactivated accounts, pending executive invites) — this is a systems/infrastructure assistant.`,
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
  `1. ANALYST — identify meaningful patterns or trends in the data, positive as well as negative.\n` +
  `2. RISK DETECTOR — flag concrete risks, each with a severity (LOW/MEDIUM/HIGH/CRITICAL).\n` +
  `3. PREDICTOR — for each risk, project the likely near-term trajectory (days/weeks) if left unaddressed, grounded only in the given data.\n` +
  `4. ADVISOR — recommend specific, concrete actions a human should consider.\n\n` +
  `IMPORTANT — give a BALANCED picture, not just problems. Alongside risks/predictions/recommendations, also surface:\n` +
  `- ACHIEVEMENT: genuine positive results or improvements visible in the data (e.g. a metric improved, a target was met, zero incidents in the period, a backlog cleared).\n` +
  `- ANNOUNCEMENT: neutral, noteworthy updates that aren't risks or wins but are still worth knowing (e.g. a new hire, an appointment filled, a completed milestone, a status change).\n` +
  `Do not manufacture achievements or announcements that aren't supported by the data — an empty or risk-only items list is correct if that's genuinely all the data shows. But if the data does contain positive or neutral developments, you must include them; do not report only emergencies or problems.\n\n` +
  `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
  `{"summary": "3-5 sentence plain-language overview covering the most important developments of any kind, most urgent first", ` +
  `"items": [{"kind": "RISK" | "PREDICTION" | "RECOMMENDATION" | "ACHIEVEMENT" | "ANNOUNCEMENT", "title": "short headline under 12 words", ` +
  `"detail": "1-2 sentence explanation grounded in the data snapshot", "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}]}\n` +
  `Include at most 10 items total, covering a mix of kinds where the data supports it, ordered by severity descending within each kind. ` +
  `If nothing is notable at all, return an empty items array and say so in the summary.`;

interface PipelineItem {
  kind: "RISK" | "PREDICTION" | "RECOMMENDATION" | "ACHIEVEMENT" | "ANNOUNCEMENT";
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
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
      select: { id: true, executiveTitle: true, kind: true, severity: true, title: true, detail: true, status: true, generatedAt: true },
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

  if (!isAiConfigured()) {
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

export default router;
