import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { documentFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const expenseSchema = z.object({
  siteId: z.string().min(1),
  payeeId: z.string().min(1),
  expenseNumber: z.string().min(1),
  category: z
    .enum([
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
    ])
    .optional(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().optional(),
  expenseDate: z.coerce.date().optional(),
  paymentMethod: z.enum(["EFT", "CASH", "CHEQUE", "CARD", "OTHER"]).optional(),
  status: z.enum(["PENDING", "PAID", "CANCELLED"]).optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const expenseSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  payeeId: true,
  payee: { select: { id: true, name: true, payeeType: true } },
  expenseNumber: true,
  category: true,
  description: true,
  amount: true,
  currency: true,
  expenseDate: true,
  paymentMethod: true,
  status: true,
  referenceNumber: true,
  notes: true,
  documentId: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/cost-summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [expenses, maintenance, payslips] = await Promise.all([
    prisma.expense.findMany({
      where: { site: { mineId }, status: "PAID", expenseDate: { gte: start } },
      select: { amount: true, category: true, expenseDate: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { status: "COMPLETED", cost: { not: null }, equipment: { site: { mineId } } },
      select: { cost: true, completedDate: true, scheduledDate: true },
    }),
    prisma.payslip.findMany({
      where: { worker: { site: { mineId } }, payPeriodEnd: { gte: start } },
      select: { grossPay: true, payPeriodEnd: true },
    }),
  ]);

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  const byMonth: Record<string, { expenses: number; maintenance: number; payroll: number }> = {};
  for (const key of monthKeys) byMonth[key] = { expenses: 0, maintenance: 0, payroll: 0 };

  for (const e of expenses) {
    const key = e.expenseDate.toISOString().slice(0, 7);
    if (byMonth[key]) byMonth[key].expenses += e.amount;
  }
  for (const m of maintenance) {
    const date = m.completedDate ?? m.scheduledDate;
    const key = date.toISOString().slice(0, 7);
    if (byMonth[key]) byMonth[key].maintenance += m.cost ?? 0;
  }
  for (const p of payslips) {
    const key = p.payPeriodEnd.toISOString().slice(0, 7);
    if (byMonth[key]) byMonth[key].payroll += p.grossPay;
  }

  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMaintenance = maintenance.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const totalPayroll = payslips.reduce((sum, p) => sum + p.grossPay, 0);

  res.json({
    months: monthKeys.map((key) => ({ month: key, ...byMonth[key] })),
    byCategory: Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount })),
    totals: {
      expenses: totalExpenses,
      maintenance: totalMaintenance,
      payroll: totalPayroll,
      grandTotal: totalExpenses + totalMaintenance + totalPayroll,
    },
  });
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const expenses = await prisma.expense.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      status: (status as any) || undefined,
      category: (category as any) || undefined,
    },
    select: expenseSelect,
    orderBy: { expenseDate: "desc" },
  });
  res.json(expenses);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("receipt"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const payee = await prisma.payee.findFirst({ where: { id: parsed.data.payeeId, mineId } });
  if (!payee) return res.status(404).json({ error: "Payee not found" });

  let documentId: string | undefined;
  if (req.file) {
    const document = await prisma.document.create({
      data: {
        title: `Expense Receipt ${parsed.data.expenseNumber}`,
        type: "EXPENSE_RECEIPT",
        version: "1.0",
        status: "ACTIVE",
        description: parsed.data.description,
        mineId,
        siteId: parsed.data.siteId,
        fileName: req.file.originalname,
        fileMimeType: req.file.mimetype,
        fileSize: req.file.size,
        fileData: Uint8Array.from(req.file.buffer),
        uploadedById: req.auth!.userId,
      },
    });
    documentId = document.id;
  }

  const expense = await prisma.expense.create({
    data: { ...parsed.data, documentId, createdById: req.auth!.userId },
    select: expenseSelect,
  });
  res.status(201).json(expense);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("receipt"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.payeeId) {
    const payee = await prisma.payee.findFirst({ where: { id: parsed.data.payeeId, mineId } });
    if (!payee) return res.status(404).json({ error: "Payee not found" });
  }

  let documentId = existing.documentId ?? undefined;
  if (req.file) {
    const document = await prisma.document.create({
      data: {
        title: `Expense Receipt ${parsed.data.expenseNumber ?? existing.expenseNumber}`,
        type: "EXPENSE_RECEIPT",
        version: "1.0",
        status: "ACTIVE",
        description: parsed.data.description ?? existing.description,
        mineId,
        siteId: parsed.data.siteId ?? existing.siteId,
        fileName: req.file.originalname,
        fileMimeType: req.file.mimetype,
        fileSize: req.file.size,
        fileData: Uint8Array.from(req.file.buffer),
        uploadedById: req.auth!.userId,
      },
    });
    documentId = document.id;
  }

  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...parsed.data, documentId },
    select: expenseSelect,
  });
  res.json(expense);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
