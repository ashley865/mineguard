import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const magazineSchema = z.object({
  siteId: z.string().min(1),
  magazineNumber: z.string().min(1),
  licenseNumber: z.string().min(1),
  licenseExpiry: z.coerce.date(),
  capacity: z.coerce.number().positive(),
  unit: z.string().min(1),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED"]).optional(),
});

const transactionSchema = z.object({
  magazineId: z.string().min(1),
  transactionType: z.enum(["RECEIPT", "ISSUE", "RETURN", "DESTRUCTION"]),
  explosiveType: z.string().min(1),
  quantity: z.coerce.number().positive(),
  issuedTo: z.string().optional(),
  transactionDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const magazineSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  magazineNumber: true,
  licenseNumber: true,
  licenseExpiry: true,
  capacity: true,
  unit: true,
  currentStock: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  status: true,
  createdAt: true,
} as const;

const transactionSelect = {
  id: true,
  magazineId: true,
  magazine: { select: { id: true, magazineNumber: true, unit: true } },
  transactionType: true,
  explosiveType: true,
  quantity: true,
  issuedTo: true,
  authorizedBy: { select: { id: true, name: true } },
  transactionDate: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/magazines", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const magazines = await prisma.explosivesMagazine.findMany({
    where: { siteId: siteId || undefined },
    select: magazineSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(magazines);
});

router.post("/magazines", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = magazineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const magazine = await prisma.explosivesMagazine.create({ data: parsed.data, select: magazineSelect });
  res.status(201).json(magazine);
});

router.put("/magazines/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = magazineSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const magazine = await prisma.explosivesMagazine.update({ where: { id: req.params.id }, data: parsed.data, select: magazineSelect });
    res.json(magazine);
  } catch {
    res.status(404).json({ error: "Magazine not found" });
  }
});

router.delete("/magazines/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.explosivesMagazine.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Magazine not found" });
  }
});

router.get("/transactions", async (req, res) => {
  const magazineId = req.query.magazineId as string | undefined;
  const transactions = await prisma.explosivesTransaction.findMany({
    where: { magazineId: magazineId || undefined },
    select: transactionSelect,
    orderBy: { transactionDate: "desc" },
  });
  res.json(transactions);
});

router.post("/transactions", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const magazine = await prisma.explosivesMagazine.findUnique({ where: { id: parsed.data.magazineId } });
  if (!magazine) return res.status(404).json({ error: "Magazine not found" });

  const increases = parsed.data.transactionType === "RECEIPT" || parsed.data.transactionType === "RETURN";
  const delta = increases ? parsed.data.quantity : -parsed.data.quantity;
  if (!increases && magazine.currentStock < parsed.data.quantity) {
    return res.status(409).json({ error: "Not enough stock in this magazine for this transaction" });
  }
  if (increases && magazine.currentStock + parsed.data.quantity > magazine.capacity) {
    return res.status(409).json({ error: "This transaction would exceed the magazine's licensed capacity" });
  }

  const [transaction] = await prisma.$transaction([
    prisma.explosivesTransaction.create({
      data: { ...parsed.data, authorizedById: req.auth!.userId },
      select: transactionSelect,
    }),
    prisma.explosivesMagazine.update({ where: { id: magazine.id }, data: { currentStock: { increment: delta } } }),
  ]);
  res.status(201).json(transaction);
});

export default router;
