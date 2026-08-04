import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { documentFileFilter } from "../lib/uploadFilters";

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

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const expenses = await prisma.expense.findMany({
    where: {
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
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let documentId: string | undefined;
  if (req.file) {
    const document = await prisma.document.create({
      data: {
        title: `Expense Receipt ${parsed.data.expenseNumber}`,
        type: "EXPENSE_RECEIPT",
        version: "1.0",
        status: "ACTIVE",
        description: parsed.data.description,
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
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  let documentId = existing.documentId ?? undefined;
  if (req.file) {
    const document = await prisma.document.create({
      data: {
        title: `Expense Receipt ${parsed.data.expenseNumber ?? existing.expenseNumber}`,
        type: "EXPENSE_RECEIPT",
        version: "1.0",
        status: "ACTIVE",
        description: parsed.data.description ?? existing.description,
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

  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { ...parsed.data, documentId },
      select: expenseSelect,
    });
    res.json(expense);
  } catch {
    res.status(404).json({ error: "Expense not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Expense not found" });
  }
});

export default router;
