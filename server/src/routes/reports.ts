import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeComplianceScore } from "../services/complianceScore";
import { requireMineId } from "../lib/mineScope";
import { renderBalanceSheetHtml, renderJournalHtml } from "../lib/financialReportHtml";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

// Balance sheet / journal are financial statements — only admins and the
// executive titles with a finance mandate should see them, not every
// supervisor/executive who otherwise has /reporting access.
const FINANCE_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];

async function requireFinanceAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !FINANCE_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

function invoiceTotal(inv: { vatRate: number; lines: { lineTotal: number }[] }): number {
  const subtotal = inv.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return subtotal * (1 + inv.vatRate / 100);
}

async function computeBalanceSheet(mineId: string) {
  const [paidInvoices, unpaidInvoices, paidExpenses, unpaidExpenses, payslips, openOrders, inventoryItems] = await Promise.all([
    prisma.invoice.findMany({ where: { site: { mineId }, status: "PAID" }, select: { vatRate: true, lines: { select: { lineTotal: true } } } }),
    prisma.invoice.findMany({
      where: { site: { mineId }, status: { in: ["SENT", "OVERDUE"] } },
      select: { vatRate: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({ where: { site: { mineId }, status: "PAID" }, select: { amount: true } }),
    prisma.expense.findMany({ where: { site: { mineId }, status: "PENDING" }, select: { amount: true } }),
    prisma.payslip.findMany({ where: { worker: { site: { mineId } } }, select: { grossPay: true } }),
    prisma.purchaseOrder.findMany({
      where: { site: { mineId }, status: { in: ["SUBMITTED", "APPROVED", "ORDERED"] } },
      select: { totalAmount: true },
    }),
    prisma.inventoryItem.findMany({ where: { site: { mineId } }, select: { quantityOnHand: true, unitCost: true } }),
  ]);

  const totalPaidInvoices = paidInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const accountsReceivable = unpaidInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const totalPaidExpenses = paidExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayroll = payslips.reduce((sum, p) => sum + p.grossPay, 0);
  const cashAndEquivalents = totalPaidInvoices - totalPaidExpenses - totalPayroll;
  const inventoryValue = inventoryItems.reduce((sum, i) => sum + i.quantityOnHand * (i.unitCost ?? 0), 0);
  const accountsPayable =
    unpaidExpenses.reduce((sum, e) => sum + e.amount, 0) + openOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const totalAssets = cashAndEquivalents + accountsReceivable + inventoryValue;
  const totalLiabilities = accountsPayable;
  const retainedEarnings = totalAssets - totalLiabilities;

  return {
    asOf: new Date().toISOString(),
    assets: {
      cashAndEquivalents: Math.round(cashAndEquivalents),
      accountsReceivable: Math.round(accountsReceivable),
      inventory: Math.round(inventoryValue),
      total: Math.round(totalAssets),
    },
    liabilities: {
      accountsPayable: Math.round(accountsPayable),
      total: Math.round(totalLiabilities),
    },
    equity: {
      retainedEarnings: Math.round(retainedEarnings),
      total: Math.round(retainedEarnings),
    },
  };
}

router.get("/balance-sheet", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;
  res.json(await computeBalanceSheet(mineId));
});

router.get("/balance-sheet/pdf", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;

  const [sheet, mine] = await Promise.all([
    computeBalanceSheet(mineId),
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true, logoData: true, logoMimeType: true } }),
  ]);
  const generatedAt = new Date();
  const html = renderBalanceSheetHtml(
    sheet,
    {
      name: mine?.name ?? "Mine Guard",
      logoDataUri: mine?.logoData && mine.logoMimeType ? `data:${mine.logoMimeType};base64,${Buffer.from(mine.logoData).toString("base64")}` : null,
    },
    generatedAt
  );
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", `attachment; filename="Balance-Sheet-${generatedAt.toISOString().slice(0, 10)}.html"`);
  res.send(html);
});

async function computeJournal(mineId: string, months: number) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [invoices, expenses, payslips, orders] = await Promise.all([
    prisma.invoice.findMany({
      where: { site: { mineId }, issueDate: { gte: since } },
      select: { id: true, invoiceNumber: true, clientName: true, issueDate: true, vatRate: true, currency: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PAID", expenseDate: { gte: since } },
      select: { id: true, expenseNumber: true, description: true, amount: true, currency: true, expenseDate: true, payee: { select: { name: true } } },
    }),
    prisma.payslip.findMany({
      where: { worker: { site: { mineId } }, payPeriodEnd: { gte: since } },
      select: { id: true, grossPay: true, payPeriodEnd: true, worker: { select: { name: true } } },
    }),
    prisma.purchaseOrder.findMany({
      where: { site: { mineId }, status: { in: ["ORDERED", "RECEIVED"] }, orderDate: { gte: since } },
      select: { id: true, orderNumber: true, totalAmount: true, currency: true, orderDate: true, supplier: { select: { name: true } } },
    }),
  ]);

  const entries = [
    ...invoices.map((inv) => ({
      id: `invoice-${inv.id}`,
      date: inv.issueDate,
      type: "INCOME" as const,
      description: `Invoice ${inv.invoiceNumber} — ${inv.clientName}`,
      amount: Math.round(invoiceTotal(inv)),
      currency: inv.currency,
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      date: e.expenseDate,
      type: "EXPENSE" as const,
      description: `${e.expenseNumber} — ${e.payee?.name ?? e.description}`,
      amount: Math.round(e.amount),
      currency: e.currency,
    })),
    ...payslips.map((p) => ({
      id: `payroll-${p.id}`,
      date: p.payPeriodEnd,
      type: "EXPENSE" as const,
      description: `Payroll — ${p.worker.name}`,
      amount: Math.round(p.grossPay),
      currency: "ZAR",
    })),
    ...orders.map((o) => ({
      id: `order-${o.id}`,
      date: o.orderDate,
      type: "EXPENSE" as const,
      description: `PO ${o.orderNumber} — ${o.supplier.name}`,
      amount: Math.round(o.totalAmount),
      currency: o.currency,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const chronological = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const balanceById = new Map<string, number>();
  let runningBalance = 0;
  for (const e of chronological) {
    runningBalance += e.type === "INCOME" ? e.amount : -e.amount;
    balanceById.set(e.id, Math.round(runningBalance));
  }

  return entries.map((e) => ({ ...e, runningBalance: balanceById.get(e.id)! }));
}

router.get("/journal", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;
  const months = Math.min(Math.max(Number(req.query.months) || 3, 1), 12);
  res.json(await computeJournal(mineId, months));
});

router.get("/journal/pdf", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;
  const months = Math.min(Math.max(Number(req.query.months) || 3, 1), 12);

  const [entries, mine] = await Promise.all([
    computeJournal(mineId, months),
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true, logoData: true, logoMimeType: true } }),
  ]);
  const generatedAt = new Date();
  const html = renderJournalHtml(
    entries.map((e) => ({ ...e, date: new Date(e.date) })),
    {
      name: mine?.name ?? "Mine Guard",
      logoDataUri: mine?.logoData && mine.logoMimeType ? `data:${mine.logoMimeType};base64,${Buffer.from(mine.logoData).toString("base64")}` : null,
    },
    generatedAt
  );
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", `attachment; filename="Journal-${generatedAt.toISOString().slice(0, 10)}.html"`);
  res.send(html);
});

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const escape = (value: any) => {
    if (value === null || value === undefined) return "";
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

router.get("/trends", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const days = Math.min(Number(req.query.days) || 90, 365);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const siteFilter = siteId ? { siteId, site: { mineId } } : { site: { mineId } };
  const workerSiteFilter = siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } };

  const [incidents, alerts, alertsBySeverity, permits, certificates, cops, medicalRecords, { score: complianceScore, breakdown }] =
    await Promise.all([
      prisma.incident.findMany({ where: { ...siteFilter, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.alert.findMany({ where: { ...siteFilter, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.alert.groupBy({ by: ["severity"], where: { ...siteFilter, createdAt: { gte: since } }, _count: true }),
      prisma.permit.findMany({ where: siteFilter, select: { expiryDate: true, status: true } }),
      prisma.certificate.findMany({ where: workerSiteFilter, select: { expiryDate: true, status: true } }),
      prisma.codeOfPractice.findMany({ where: { ...siteFilter, status: "ACTIVE" }, select: { reviewDate: true } }),
      prisma.medicalSurveillance.findMany({ where: workerSiteFilter, select: { nextExamDue: true } }),
      computeComplianceScore(mineId, siteId),
    ]);

  const dayBuckets = new Map<string, { incidents: number; alerts: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dayBuckets.set(d.toISOString().slice(0, 10), { incidents: 0, alerts: 0 });
  }
  for (const i of incidents) {
    const key = i.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) bucket.incidents += 1;
  }
  for (const a of alerts) {
    const key = a.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) bucket.alerts += 1;
  }

  const severity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of alertsBySeverity) severity[row.severity] = row._count;

  const ninetyDaysFromNow = Date.now() + 90 * 86400000;
  const expiringSoon = (rows: { expiryDate?: Date | null; status?: string }[], activeStatus = "ACTIVE") =>
    rows.filter(
      (r) => r.expiryDate && r.expiryDate.getTime() <= ninetyDaysFromNow && (!r.status || r.status === activeStatus)
    ).length;

  res.json({
    days,
    trend: Array.from(dayBuckets.entries()).map(([date, v]) => ({ date, ...v })),
    alertsBySeverity: severity,
    complianceScore,
    compliance: breakdown,
    expiryForecast: [
      { category: "permits", count: expiringSoon(permits) },
      { category: "certificates", count: expiringSoon(certificates) },
      { category: "codesOfPractice", count: cops.filter((c) => c.reviewDate.getTime() <= ninetyDaysFromNow).length },
      { category: "medicalSurveillance", count: medicalRecords.filter((m) => m.nextExamDue.getTime() <= ninetyDaysFromNow).length },
    ],
  });
});

const exportConfigs: Record<
  string,
  { columns: { key: string; label: string }[]; query: (mineId: string, siteId?: string) => Promise<any[]> }
> = {
  incidents: {
    columns: [
      { key: "title", label: "Title" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "zone", label: "Zone" },
      { key: "createdAt", label: "Created At" },
      { key: "resolvedAt", label: "Resolved At" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.incident.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } }, zone: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name, zone: r.zone?.name }));
    },
  },
  alerts: {
    columns: [
      { key: "message", label: "Message" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "zone", label: "Zone" },
      { key: "createdAt", label: "Created At" },
      { key: "resolvedAt", label: "Resolved At" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.alert.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } }, zone: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name, zone: r.zone?.name }));
    },
  },
  permits: {
    columns: [
      { key: "permitNumber", label: "Permit Number" },
      { key: "type", label: "Type" },
      { key: "issuingAuthority", label: "Issuing Authority" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "issueDate", label: "Issue Date" },
      { key: "expiryDate", label: "Expiry Date" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.permit.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { expiryDate: "asc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  certificates: {
    columns: [
      { key: "worker", label: "Worker" },
      { key: "type", label: "Type" },
      { key: "certificateNumber", label: "Certificate Number" },
      { key: "issuingBody", label: "Issuing Body" },
      { key: "status", label: "Status" },
      { key: "issueDate", label: "Issue Date" },
      { key: "expiryDate", label: "Expiry Date" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.certificate.findMany({
        where: siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } },
        include: { worker: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
      });
      return rows.map((r) => ({ ...r, worker: r.worker?.name }));
    },
  },
  trainingRecords: {
    columns: [
      { key: "worker", label: "Worker" },
      { key: "courseName", label: "Course" },
      { key: "trainingType", label: "Type" },
      { key: "provider", label: "Provider" },
      { key: "completionDate", label: "Completion Date" },
      { key: "expiryDate", label: "Refresher Due" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.trainingRecord.findMany({
        where: siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } },
        include: { worker: { select: { name: true } } },
        orderBy: { completionDate: "desc" },
      });
      return rows.map((r) => ({ ...r, worker: r.worker?.name }));
    },
  },
  safetyInspections: {
    columns: [
      { key: "title", label: "Title" },
      { key: "inspectionType", label: "Type" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "scheduledDate", label: "Scheduled Date" },
      { key: "completedDate", label: "Completed Date" },
      { key: "inspector", label: "Inspector" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.safetyInspection.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { scheduledDate: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  regulatoryNotices: {
    columns: [
      { key: "noticeNumber", label: "Notice Number" },
      { key: "section", label: "Section" },
      { key: "issuedBy", label: "Issued By" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "issuedDate", label: "Issued Date" },
      { key: "complianceDeadline", label: "Compliance Deadline" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.regulatoryNotice.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { issuedDate: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  contractors: {
    columns: [
      { key: "companyName", label: "Company Name" },
      { key: "scopeOfWork", label: "Scope of Work" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "contractStartDate", label: "Contract Start" },
      { key: "contractEndDate", label: "Contract End" },
      { key: "goodStandingExpiry", label: "Good Standing Expiry" },
      { key: "insuranceExpiry", label: "Insurance Expiry" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.contractor.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { contractEndDate: "asc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
};

router.get("/export/:entity", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const config = exportConfigs[req.params.entity];
  if (!config) return res.status(404).json({ error: "Unknown export entity" });
  const siteId = req.query.siteId as string | undefined;
  const rows = await config.query(mineId, siteId);
  const csv = toCsv(rows, config.columns);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.entity}.csv"`);
  res.send(csv);
});

export default router;
