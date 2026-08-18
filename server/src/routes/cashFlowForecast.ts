import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

const FINANCE_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];

async function requireFinanceAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
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

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;

  const clampMonths = (raw: unknown, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 && n <= 24 ? Math.round(n) : fallback;
  };
  const historyMonths = clampMonths(req.query.historyMonths, 6);
  const forecastMonths = clampMonths(req.query.forecastMonths, 3);
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (historyMonths - 1));

  const [paidInvoices, paidExpenses, payslips, unpaidInvoices, unpaidExpenses, openOrders, inventoryItems] = await Promise.all([
    prisma.invoice.findMany({
      where: { site: { mineId }, status: "PAID", issueDate: { gte: since } },
      select: { vatRate: true, lines: { select: { lineTotal: true } }, issueDate: true },
    }),
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PAID", expenseDate: { gte: since } },
      select: { amount: true, expenseDate: true },
    }),
    prisma.payslip.findMany({
      where: { OR: [{ worker: { site: { mineId } } }, { payee: { mineId } }], payPeriodEnd: { gte: since } },
      select: { grossPay: true, payPeriodEnd: true },
    }),
    // Current-ratio inputs, mirroring the Balance Sheet's simplified statement.
    prisma.invoice.findMany({ where: { site: { mineId }, status: { in: ["SENT", "OVERDUE"] } }, select: { vatRate: true, lines: { select: { lineTotal: true } } } }),
    prisma.expense.findMany({ where: { site: { mineId }, status: "PENDING" }, select: { amount: true } }),
    prisma.purchaseOrder.findMany({ where: { site: { mineId }, status: { in: ["SUBMITTED", "APPROVED", "ORDERED"] } }, select: { totalAmount: true } }),
    prisma.inventoryItem.findMany({ where: { site: { mineId } }, select: { quantityOnHand: true, unitCost: true } }),
  ]);

  const byMonth = new Map<string, { income: number; outgoings: number }>();
  for (const inv of paidInvoices) {
    const key = monthKey(inv.issueDate);
    const bucket = byMonth.get(key) ?? { income: 0, outgoings: 0 };
    bucket.income += invoiceTotal(inv);
    byMonth.set(key, bucket);
  }
  for (const exp of paidExpenses) {
    const key = monthKey(exp.expenseDate);
    const bucket = byMonth.get(key) ?? { income: 0, outgoings: 0 };
    bucket.outgoings += exp.amount;
    byMonth.set(key, bucket);
  }
  for (const p of payslips) {
    const key = monthKey(p.payPeriodEnd);
    const bucket = byMonth.get(key) ?? { income: 0, outgoings: 0 };
    bucket.outgoings += p.grossPay;
    byMonth.set(key, bucket);
  }

  const months: { month: string; income: number; outgoings: number; netCashFlow: number }[] = [];
  for (let i = 0; i < historyMonths; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    const key = monthKey(d);
    const bucket = byMonth.get(key) ?? { income: 0, outgoings: 0 };
    months.push({ month: key, income: Math.round(bucket.income), outgoings: Math.round(bucket.outgoings), netCashFlow: Math.round(bucket.income - bucket.outgoings) });
  }

  // Simple trailing-average projection: the average net cash flow of the last 3
  // recorded months, carried forward — not a regression/trend model, deliberately
  // conservative and easy to explain rather than fitted to noisy monthly swings.
  const trailing = months.slice(-3);
  const avgNetCashFlow = trailing.length > 0 ? trailing.reduce((sum, m) => sum + m.netCashFlow, 0) / trailing.length : 0;
  const lastMonthDate = new Date(since);
  lastMonthDate.setMonth(lastMonthDate.getMonth() + historyMonths - 1);

  const forecast: { month: string; projectedNetCashFlow: number; projectedCumulative: number }[] = [];
  let cumulative = 0;
  for (let i = 1; i <= forecastMonths; i++) {
    const d = new Date(lastMonthDate);
    d.setMonth(d.getMonth() + i);
    cumulative += avgNetCashFlow;
    forecast.push({ month: monthKey(d), projectedNetCashFlow: Math.round(avgNetCashFlow), projectedCumulative: Math.round(cumulative) });
  }

  const accountsReceivable = unpaidInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const accountsPayable = unpaidExpenses.reduce((sum, e) => sum + e.amount, 0) + openOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const inventoryValue = inventoryItems.reduce((sum, i) => sum + i.quantityOnHand * (i.unitCost ?? 0), 0);
  const cashAndEquivalents = months.reduce((sum, m) => sum + m.netCashFlow, 0);
  const currentAssets = Math.max(cashAndEquivalents, 0) + accountsReceivable + inventoryValue;
  const currentLiabilities = accountsPayable;
  const equity = currentAssets - currentLiabilities;

  const ratios = {
    currentRatio: currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : null,
    quickRatio: currentLiabilities > 0 ? Math.round(((currentAssets - inventoryValue) / currentLiabilities) * 100) / 100 : null,
    debtToEquity: equity !== 0 ? Math.round((currentLiabilities / equity) * 100) / 100 : null,
  };

  res.json({
    history: months,
    forecast,
    ratios,
    balanceSnapshot: {
      cashAndEquivalents: Math.round(cashAndEquivalents),
      accountsReceivable: Math.round(accountsReceivable),
      inventory: Math.round(inventoryValue),
      accountsPayable: Math.round(accountsPayable),
    },
  });
});

export default router;
