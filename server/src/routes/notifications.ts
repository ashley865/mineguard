import { Router } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

const EXPIRY_WARNING_DAYS = 30;
const ORDER_STUCK_DAYS = 14;

// Executive titles whose department owns worker certification/training compliance.
// Compliance shares this because certificate/training lapses are themselves a
// compliance risk, not just an HR administration matter.
export const CERTIFICATION_AUDIENCE: ExecutiveTitle[] = ["HR_MANAGER", "COMPLIANCE_OFFICER"];
// Executive titles whose department owns contractor/vendor contract terms.
export const CONTRACT_AUDIENCE: ExecutiveTitle[] = ["GENERAL_MANAGER", "COO", "OPERATIONS_MANAGER", "COMPLIANCE_OFFICER"];
// Executive titles who need visibility into outstanding client invoice deadlines.
export const INVOICE_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER"];
// Executive titles who own procurement / purchase order approvals.
export const ORDER_AUDIENCE: ExecutiveTitle[] = ["GENERAL_MANAGER", "COO", "OPERATIONS_MANAGER", "CFO"];
// Executive titles who own sign-off on logged expenses before they're paid.
export const EXPENSE_APPROVAL_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];
const EXPENSE_PENDING_NOTICE_DAYS = 3;
// Same finance-mandate audience budgetPlans.ts notifies on submission — visibility here
// even though only ADMIN can actually action the approve/reject buttons.
export const BUDGET_APPROVAL_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];

function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const role = req.auth!.role;
  let title: ExecutiveTitle | null = null;
  if (role === "EXECUTIVE") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    title = me?.title ?? null;
  }

  const seesCertifications = role === "ADMIN" || (role === "EXECUTIVE" && !!title && CERTIFICATION_AUDIENCE.includes(title));
  const seesContracts = role === "ADMIN" || (role === "EXECUTIVE" && !!title && CONTRACT_AUDIENCE.includes(title));
  const seesInvoices = role === "ADMIN" || (role === "EXECUTIVE" && !!title && INVOICE_AUDIENCE.includes(title));
  const seesOrders = role === "ADMIN" || (role === "EXECUTIVE" && !!title && ORDER_AUDIENCE.includes(title));
  const seesExpenseApprovals = role === "ADMIN" || (role === "EXECUTIVE" && !!title && EXPENSE_APPROVAL_AUDIENCE.includes(title));
  const seesBudgetApprovals = role === "ADMIN" || (role === "EXECUTIVE" && !!title && BUDGET_APPROVAL_AUDIENCE.includes(title));

  const [reviewedAlerts, reviewedIncidents, certificates, trainingRecords, contractors, invoices, orders, pendingExpenses, pendingBudgets] = await Promise.all([
    prisma.alert.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] }, site: { mineId } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    prisma.incident.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] }, site: { mineId } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    seesCertifications
      ? prisma.certificate.findMany({
          where: { status: "ACTIVE", expiryDate: { not: null }, worker: { site: { mineId } } },
          include: { worker: { select: { id: true, name: true, phone: true, site: { select: { id: true, name: true } } } } },
        })
      : Promise.resolve([]),
    seesCertifications
      ? prisma.trainingRecord.findMany({
          where: { expiryDate: { not: null }, worker: { site: { mineId } } },
          include: { worker: { select: { id: true, name: true, phone: true, site: { select: { id: true, name: true } } } } },
        })
      : Promise.resolve([]),
    seesContracts
      ? prisma.contractor.findMany({
          where: { status: "ACTIVE", site: { mineId } },
          include: { site: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    seesInvoices
      ? prisma.invoice.findMany({
          where: { status: { in: ["SENT", "OVERDUE"] }, site: { mineId } },
          include: { site: { select: { id: true, name: true } }, lines: { select: { lineTotal: true } } },
        })
      : Promise.resolve([]),
    seesOrders
      ? prisma.purchaseOrder.findMany({
          where: { status: { in: ["SUBMITTED", "APPROVED"] }, site: { mineId } },
          include: { supplier: { select: { name: true } }, site: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    seesExpenseApprovals
      ? prisma.expense.findMany({
          where: { status: "PENDING", site: { mineId } },
          include: { site: { select: { id: true, name: true } }, payee: { select: { name: true } } },
        })
      : Promise.resolve([]),
    seesBudgetApprovals
      ? prisma.budgetPlan.findMany({
          where: { status: "PENDING_APPROVAL", mineId },
          include: { site: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const certificationItems = [
    ...certificates
      .filter((c) => c.expiryDate && daysFromNow(c.expiryDate) <= EXPIRY_WARNING_DAYS)
      .map((c) => {
        const days = daysFromNow(c.expiryDate!);
        return {
          id: `certificate-${c.id}`,
          kind: "certification" as const,
          entityId: c.worker.id,
          title: `${c.type.replace(/_/g, " ")} Certificate of Competency — ${c.worker.name}`,
          severity: (days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: c.expiryDate!,
          site: c.worker.site,
        };
      }),
    ...trainingRecords
      .filter((tr) => tr.expiryDate && daysFromNow(tr.expiryDate) <= EXPIRY_WARNING_DAYS)
      .map((tr) => {
        const days = daysFromNow(tr.expiryDate!);
        return {
          id: `training-${tr.id}`,
          kind: "certification" as const,
          entityId: tr.worker.id,
          title: `${tr.courseName} training — ${tr.worker.name}`,
          severity: (days < 0 ? "MEDIUM" : "LOW") as "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: tr.expiryDate!,
          site: tr.worker.site,
        };
      }),
  ];

  const contractItems = contractors.flatMap((contractor) => {
    const checks: { date: Date; label: string }[] = [{ date: contractor.contractEndDate, label: "Contract" }];
    if (contractor.goodStandingExpiry) checks.push({ date: contractor.goodStandingExpiry, label: "Letter of Good Standing" });
    if (contractor.insuranceExpiry) checks.push({ date: contractor.insuranceExpiry, label: "Public liability insurance" });
    return checks
      .filter((check) => daysFromNow(check.date) <= EXPIRY_WARNING_DAYS)
      .map((check) => {
        const days = daysFromNow(check.date);
        return {
          id: `contract-${contractor.id}-${check.label}`,
          kind: "contract" as const,
          entityId: contractor.id,
          title: `${check.label} — ${contractor.companyName}`,
          severity: (days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: check.date,
          site: contractor.site,
        };
      });
  });

  const invoiceItems = invoices
    .map((inv) => {
      const days = daysFromNow(inv.dueDate);
      const subtotal = inv.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const total = subtotal * (1 + inv.vatRate / 100);
      return { inv, days, total };
    })
    .filter(({ days }) => days <= EXPIRY_WARNING_DAYS)
    .map(({ inv, days, total }) => ({
      id: `invoice-${inv.id}`,
      kind: "invoice" as const,
      entityId: inv.id,
      title: `Invoice ${inv.invoiceNumber} — ${inv.clientName} (${inv.currency} ${Math.round(total).toLocaleString()})`,
      severity: (days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
      reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
      reviewedAt: inv.dueDate,
      site: inv.site,
    }));

  const orderItems = orders
    .map((o) => ({ o, ageDays: Math.floor((Date.now() - o.createdAt.getTime()) / 86400000) }))
    .filter(({ ageDays }) => ageDays >= ORDER_STUCK_DAYS)
    .map(({ o, ageDays }) => ({
      id: `order-${o.id}`,
      kind: "order" as const,
      entityId: o.id,
      title: `Purchase Order ${o.orderNumber} — ${o.supplier.name} (${o.status.replace(/_/g, " ")}, ${ageDays}d old)`,
      severity: (ageDays >= 30 ? "HIGH" : ageDays >= 21 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
      reviewStatus: "OVERDUE" as const,
      reviewedAt: new Date(o.createdAt.getTime() + ORDER_STUCK_DAYS * 86400000),
      site: o.site,
    }));

  const expenseApprovalItems = pendingExpenses
    .map((e) => ({ e, ageDays: Math.floor((Date.now() - e.createdAt.getTime()) / 86400000) }))
    .filter(({ ageDays }) => ageDays >= EXPENSE_PENDING_NOTICE_DAYS)
    .map(({ e, ageDays }) => ({
      id: `expense-${e.id}`,
      kind: "expense" as const,
      entityId: e.id,
      title: `Expense ${e.expenseNumber} — ${e.payee.name} (${e.currency} ${Math.round(e.amount).toLocaleString()}, ${ageDays}d awaiting approval)`,
      severity: (ageDays >= 14 ? "HIGH" : ageDays >= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
      reviewStatus: "OVERDUE" as const,
      reviewedAt: new Date(e.createdAt.getTime() + EXPENSE_PENDING_NOTICE_DAYS * 86400000),
      site: e.site,
    }));

  const budgetItems = pendingBudgets
    .map((p) => ({ p, ageDays: Math.floor((Date.now() - p.createdAt.getTime()) / 86400000) }))
    .map(({ p, ageDays }) => ({
      id: `budget-${p.id}`,
      kind: "budget" as const,
      entityId: p.id,
      title: `Budget ${p.category.replace(/_/g, " ")} — R${Math.round(p.budgetedAmount).toLocaleString()} awaiting approval`,
      severity: (ageDays >= 7 ? "HIGH" : ageDays >= 3 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
      reviewStatus: "OVERDUE" as const,
      reviewedAt: p.createdAt,
      site: p.site,
    }));

  const items = [
    ...reviewedAlerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: "alert" as const,
      title: a.message,
      severity: a.severity,
      reviewStatus: a.reviewStatus,
      reviewNote: a.reviewNote,
      reviewedAt: a.reviewedAt,
      reviewedBy: a.reviewedBy,
      site: a.site,
    })),
    ...reviewedIncidents.map((i) => ({
      id: `incident-${i.id}`,
      kind: "incident" as const,
      title: i.title,
      severity: i.severity,
      reviewStatus: i.reviewStatus,
      reviewNote: i.reviewNote,
      reviewedAt: i.reviewedAt,
      reviewedBy: i.reviewedBy,
      site: i.site,
    })),
    ...certificationItems,
    ...contractItems,
    ...invoiceItems,
    ...orderItems,
    ...expenseApprovalItems,
    ...budgetItems,
  ]
    .filter((item) => item.reviewedAt)
    .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
    .slice(0, 30);

  res.json(items);
});

export default router;
