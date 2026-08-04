import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const recordSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  shiftDate: z.coerce.date(),
  shift: z.enum(["DAY", "AFTERNOON", "NIGHT"]),
  mineralType: z.string().min(1),
  tonnesMined: z.coerce.number().nonnegative(),
  oreGrade: z.coerce.number().optional().nullable(),
  wasteRemoved: z.coerce.number().optional().nullable(),
  targetTonnes: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const recordSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  shiftDate: true,
  shift: true,
  mineralType: true,
  tonnesMined: true,
  oreGrade: true,
  wasteRemoved: true,
  targetTonnes: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const records = await prisma.productionRecord.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      shiftDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    select: recordSelect,
    orderBy: { shiftDate: "desc" },
  });
  res.json(records);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const record = await prisma.productionRecord.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: recordSelect,
  });
  res.status(201).json(record);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = recordSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.productionRecord.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Production record not found" });
  const record = await prisma.productionRecord.update({ where: { id: existing.id }, data: parsed.data, select: recordSelect });
  res.json(record);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.productionRecord.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Production record not found" });
  await prisma.productionRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/financial-summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [records, invoices, expenses] = await Promise.all([
    prisma.productionRecord.findMany({
      where: { site: { mineId }, siteId: siteId || undefined, shiftDate: { gte: start } },
      select: { shiftDate: true, tonnesMined: true, mineralType: true },
    }),
    prisma.invoice.findMany({
      where: { site: { mineId }, siteId: siteId || undefined, status: "PAID", issueDate: { gte: start } },
      select: { issueDate: true, vatRate: true, lines: { select: { lineTotal: true } } },
    }),
    prisma.expense.findMany({
      where: { site: { mineId }, siteId: siteId || undefined, status: "PAID", expenseDate: { gte: start } },
      select: { expenseDate: true, amount: true, category: true },
    }),
  ]);

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  const byMonth: Record<string, { earnings: number; expenses: number; tonnesByMineral: Record<string, number> }> = {};
  for (const key of monthKeys) byMonth[key] = { earnings: 0, expenses: 0, tonnesByMineral: {} };

  const mineralTotals: Record<string, number> = {};
  for (const r of records) {
    const key = r.shiftDate.toISOString().slice(0, 7);
    mineralTotals[r.mineralType] = (mineralTotals[r.mineralType] ?? 0) + r.tonnesMined;
    if (byMonth[key]) {
      byMonth[key].tonnesByMineral[r.mineralType] = (byMonth[key].tonnesByMineral[r.mineralType] ?? 0) + r.tonnesMined;
    }
  }
  const minerals = Object.entries(mineralTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([mineralType]) => mineralType);

  for (const inv of invoices) {
    const key = inv.issueDate.toISOString().slice(0, 7);
    if (!byMonth[key]) continue;
    const subtotal = inv.lines.reduce((sum, l) => sum + l.lineTotal, 0);
    byMonth[key].earnings += subtotal * (1 + inv.vatRate / 100);
  }
  for (const exp of expenses) {
    const key = exp.expenseDate.toISOString().slice(0, 7);
    if (byMonth[key]) byMonth[key].expenses += exp.amount;
  }

  const categoryTotals: Record<string, number> = {};
  for (const exp of expenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + exp.amount;
  }

  const totalTonnes = records.reduce((sum, r) => sum + r.tonnesMined, 0);
  const totalEarnings = Object.values(byMonth).reduce((sum, m) => sum + m.earnings, 0);
  const totalExpenses = Object.values(byMonth).reduce((sum, m) => sum + m.expenses, 0);

  res.json({
    months: monthKeys.map((key) => ({ month: key, earnings: byMonth[key].earnings, expenses: byMonth[key].expenses, tonnesByMineral: byMonth[key].tonnesByMineral })),
    minerals,
    totals: {
      totalTonnes,
      totalEarnings,
      totalExpenses,
      netMargin: totalEarnings - totalExpenses,
    },
    expensesByCategory: Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount })),
  });
});

export default router;
