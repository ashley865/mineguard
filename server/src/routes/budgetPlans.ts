import { Router } from "express";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { notifyExecutives } from "../lib/notify";

const router = Router();

// Owner + the executive titles with a finance mandate — same audience reports.ts's
// balance sheet/journal views and expenses.ts's approval sign-off use.
const FINANCE_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];

const expenseCategoryEnum = z.enum([
  "OPERATIONS",
  "MAINTENANCE",
  "SALARIES_WAGES",
  "TRANSPORT_LOGISTICS",
  "UTILITIES",
  "PROFESSIONAL_SERVICES",
  "EQUIPMENT_SUPPLIES",
  "RENT_LEASE",
  "INSURANCE",
  "TAXES_LEVIES",
  "OTHER",
]);

const planSchema = z.object({
  siteId: z.string().optional().nullable(),
  category: expenseCategoryEnum,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  budgetedAmount: z.coerce.number().positive(),
  notes: z.string().optional(),
});

const planSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  category: true,
  periodStart: true,
  periodEnd: true,
  budgetedAmount: true,
  notes: true,
  status: true,
  submittedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  approvedAt: true,
  reviewNote: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

type PlanRow = {
  id: string;
  siteId: string | null;
  category: string;
  periodStart: Date;
  periodEnd: Date;
  budgetedAmount: number;
};

// Actual spend is computed live from Expense records rather than stored, so it never
// drifts from the real ledger. Batched into 2 queries total regardless of plan count
// (fetch every candidate expense once, then sum in memory per plan) instead of the
// previous one-aggregate-query-per-plan approach, which scaled linearly with plan count.
async function attachActuals<T extends PlanRow>(mineId: string, plans: T[]): Promise<(T & { actualAmount: number })[]> {
  if (plans.length === 0) return [];
  const categories = [...new Set(plans.map((p) => p.category))];
  const minStart = new Date(Math.min(...plans.map((p) => p.periodStart.getTime())));
  const maxEnd = new Date(Math.max(...plans.map((p) => p.periodEnd.getTime())));
  const expenses = await prisma.expense.findMany({
    // A CANCELLED expense was proposed but never actually paid — counting it toward
    // "actual" spend would overstate real budget usage. PENDING counts (money already
    // committed/incurred, just not yet paid out); only CANCELLED is excluded.
    where: { category: { in: categories as any }, expenseDate: { gte: minStart, lte: maxEnd }, site: { mineId }, status: { not: "CANCELLED" } },
    select: { category: true, amount: true, expenseDate: true, siteId: true },
  });
  return plans.map((plan) => {
    const actualAmount = expenses
      .filter(
        (e) =>
          e.category === plan.category &&
          e.expenseDate >= plan.periodStart &&
          e.expenseDate <= plan.periodEnd &&
          (!plan.siteId || e.siteId === plan.siteId)
      )
      .reduce((sum, e) => sum + e.amount, 0);
    return { ...plan, actualAmount };
  });
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const plans = await prisma.budgetPlan.findMany({
    where: { mineId },
    select: planSelect,
    orderBy: { periodStart: "desc" },
  });
  res.json(await attachActuals(mineId, plans));
});

// Feature 1: a real KPI/summary endpoint (totals, category and site rollups, status
// counts, over-budget count) instead of forcing the client to derive all of this from the
// flat list — backs the summary cards and both charts on the redesigned page.
// Itemized breakdown behind a plan's actualAmount — the same category/period/site
// match attachActuals() sums, returned as real rows instead of a lump number, so
// "actual spend" is verifiable rather than a figure the viewer has to take on faith.
router.get("/:id/expenses", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const plan = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!plan) return res.status(404).json({ error: "Budget plan not found" });
  const expenses = await prisma.expense.findMany({
    where: {
      category: plan.category,
      expenseDate: { gte: plan.periodStart, lte: plan.periodEnd },
      site: plan.siteId ? { id: plan.siteId } : { mineId },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      expenseNumber: true,
      description: true,
      amount: true,
      currency: true,
      expenseDate: true,
      status: true,
      site: { select: { id: true, name: true } },
      payee: { select: { id: true, name: true } },
    },
    orderBy: { expenseDate: "desc" },
  });
  res.json(expenses);
});

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const plans = await prisma.budgetPlan.findMany({
    where: { mineId },
    select: { id: true, siteId: true, site: { select: { name: true } }, category: true, periodStart: true, periodEnd: true, budgetedAmount: true, status: true },
  });
  const withActuals = await attachActuals(mineId, plans);

  const totalBudgeted = withActuals.reduce((sum, p) => sum + p.budgetedAmount, 0);
  const totalActual = withActuals.reduce((sum, p) => sum + p.actualAmount, 0);
  const overBudgetCount = withActuals.filter((p) => p.actualAmount > p.budgetedAmount).length;

  const statusCounts = { PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 };
  for (const p of withActuals) statusCounts[p.status as keyof typeof statusCounts]++;

  const byCategoryMap = new Map<string, { category: string; budgeted: number; actual: number }>();
  const bySiteMap = new Map<string, { site: string; budgeted: number; actual: number }>();
  for (const p of withActuals) {
    const cat = byCategoryMap.get(p.category) ?? { category: p.category, budgeted: 0, actual: 0 };
    cat.budgeted += p.budgetedAmount;
    cat.actual += p.actualAmount;
    byCategoryMap.set(p.category, cat);

    const siteName = p.site?.name ?? "Mine-wide";
    const site = bySiteMap.get(siteName) ?? { site: siteName, budgeted: 0, actual: 0 };
    site.budgeted += p.budgetedAmount;
    site.actual += p.actualAmount;
    bySiteMap.set(siteName, site);
  }

  res.json({
    totalBudgeted,
    totalActual,
    totalVariance: totalBudgeted - totalActual,
    utilizationPct: totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 1000) / 10 : 0,
    overBudgetCount,
    planCount: withActuals.length,
    statusCounts,
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.budgeted - a.budgeted),
    bySite: [...bySiteMap.values()].sort((a, b) => b.budgeted - a.budgeted),
  });
});

// Feature 4 (approval workflow) + Feature 5 (notifications): the Owner's own budgets are
// auto-approved (they're the final authority — routing their own budget through their own
// approval is just ceremony); an EXECUTIVE-created one starts PENDING_APPROVAL and the
// finance-mandate audience is notified, mirroring how Expense/PurchaseOrder approvals work.
router.post("/", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }

  const isOwner = req.auth!.role === "ADMIN";
  const plan = await prisma.budgetPlan.create({
    data: {
      ...parsed.data,
      mineId,
      createdById: req.auth!.userId,
      status: isOwner ? "APPROVED" : "PENDING_APPROVAL",
      submittedById: isOwner ? undefined : req.auth!.userId,
      approvedById: isOwner ? req.auth!.userId : undefined,
      approvedAt: isOwner ? new Date() : undefined,
    },
    select: planSelect,
  });

  if (!isOwner) {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      includeAdmin: true,
      titles: FINANCE_AUDIENCE,
      type: "BUDGET_APPROVAL",
      title: `Budget needs approval — ${plan.category.replace(/_/g, " ")}`,
      body: `R${plan.budgetedAmount.toLocaleString()} · ${new Date(plan.periodStart).toLocaleDateString()} – ${new Date(plan.periodEnd).toLocaleDateString()}`,
      // The planId query param lets approve/reject find and clear exactly this
      // notification for every approver once the decision is made — see below.
      link: `/budget-planning?planId=${plan.id}`,
    });
  }

  res.status(201).json({ ...plan, actualAmount: 0 });
});

router.put("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Budget plan not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const plan = await prisma.budgetPlan.update({
    where: { id: existing.id },
    data: parsed.data,
    select: planSelect,
  });
  const [withActual] = await attachActuals(mineId, [
    { id: plan.id, siteId: plan.siteId, category: plan.category, periodStart: plan.periodStart, periodEnd: plan.periodEnd, budgetedAmount: plan.budgetedAmount },
  ]);
  res.json({ ...plan, actualAmount: withActual.actualAmount });
});

const reviewSchema = z.object({ reviewNote: z.string().optional() });

router.post("/:id/approve", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Budget plan not found" });
  if (existing.status !== "PENDING_APPROVAL") return res.status(409).json({ error: "This budget is not awaiting approval" });
  const plan = await prisma.budgetPlan.update({
    where: { id: existing.id },
    data: { status: "APPROVED", approvedById: req.auth!.userId, approvedAt: new Date(), reviewNote: parsed.data.reviewNote },
    select: planSelect,
  });
  // The decision is made — clear the "needs approval" notification for every approver
  // it was sent to, not just the one who acted, so it doesn't linger as if still open.
  await prisma.notification.updateMany({
    where: { mineId, type: "BUDGET_APPROVAL", link: `/budget-planning?planId=${existing.id}`, readAt: null },
    data: { readAt: new Date() },
  });
  if (existing.submittedById) {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      includeAdmin: false,
      userIds: [existing.submittedById],
      type: "BUDGET_APPROVAL",
      title: `Budget approved — ${plan.category.replace(/_/g, " ")}`,
      link: "/budget-planning",
    });
  }
  res.json(plan);
});

router.post("/:id/reject", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Budget plan not found" });
  if (existing.status !== "PENDING_APPROVAL") return res.status(409).json({ error: "This budget is not awaiting approval" });
  const plan = await prisma.budgetPlan.update({
    where: { id: existing.id },
    data: { status: "REJECTED", approvedById: req.auth!.userId, approvedAt: new Date(), reviewNote: parsed.data.reviewNote },
    select: planSelect,
  });
  // Same as approve — the decision is made, clear the pending notification for every
  // approver it went to.
  await prisma.notification.updateMany({
    where: { mineId, type: "BUDGET_APPROVAL", link: `/budget-planning?planId=${existing.id}`, readAt: null },
    data: { readAt: new Date() },
  });
  if (existing.submittedById) {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      includeAdmin: false,
      userIds: [existing.submittedById],
      type: "BUDGET_APPROVAL",
      title: `Budget rejected — ${plan.category.replace(/_/g, " ")}`,
      body: parsed.data.reviewNote,
      link: "/budget-planning",
    });
  }
  res.json(plan);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Budget plan not found" });
  await prisma.budgetPlan.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
