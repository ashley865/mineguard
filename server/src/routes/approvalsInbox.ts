import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Same finance mandate as the balance sheet / journal / expense review gates elsewhere —
// this inbox surfaces the exact same pending-approval money that those screens report on.
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

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireFinanceAccess(req, res))) return;

  const [expenses, orders] = await Promise.all([
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PENDING" },
      select: {
        id: true,
        expenseNumber: true,
        description: true,
        amount: true,
        currency: true,
        category: true,
        createdAt: true,
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { site: { mineId }, status: "SUBMITTED" },
      select: {
        id: true,
        orderNumber: true,
        description: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        site: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const items = [
    ...expenses.map((e) => ({
      id: e.id,
      type: "EXPENSE" as const,
      reference: e.expenseNumber,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      site: e.site,
      requestedBy: e.createdBy,
      category: e.category as string | null,
      supplier: null as string | null,
      createdAt: e.createdAt,
    })),
    ...orders.map((o) => ({
      id: o.id,
      type: "PURCHASE_ORDER" as const,
      reference: o.orderNumber,
      description: o.description,
      amount: o.totalAmount,
      currency: o.currency,
      site: o.site,
      requestedBy: o.requestedBy,
      category: null as string | null,
      supplier: o.supplier?.name ?? null,
      createdAt: o.createdAt,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  res.json({
    items,
    totals: {
      expenseCount: expenses.length,
      expenseTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
      purchaseOrderCount: orders.length,
      purchaseOrderTotal: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    },
  });
});

export default router;
