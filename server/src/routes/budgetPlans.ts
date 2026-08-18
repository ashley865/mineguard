import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

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
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const plans = await prisma.budgetPlan.findMany({
    where: { mineId },
    select: planSelect,
    orderBy: { periodStart: "desc" },
  });

  // Actual spend per plan is computed live from Expense records rather than stored,
  // so it never drifts from the real ledger.
  const withActuals = await Promise.all(
    plans.map(async (plan) => {
      const actual = await prisma.expense.aggregate({
        where: {
          category: plan.category,
          expenseDate: { gte: plan.periodStart, lte: plan.periodEnd },
          site: { mineId, id: plan.siteId || undefined },
        },
        _sum: { amount: true },
      });
      return { ...plan, actualAmount: actual._sum.amount ?? 0 };
    })
  );

  res.json(withActuals);
});

router.post("/", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const plan = await prisma.budgetPlan.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: planSelect,
  });
  res.status(201).json(plan);
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
  const actual = await prisma.expense.aggregate({
    where: {
      category: plan.category,
      expenseDate: { gte: plan.periodStart, lte: plan.periodEnd },
      site: { mineId, id: plan.siteId || undefined },
    },
    _sum: { amount: true },
  });
  res.json({ ...plan, actualAmount: actual._sum.amount ?? 0 });
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
