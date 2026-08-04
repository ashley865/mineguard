import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const payeeSchema = z.object({
  payeeType: z.enum(["COMPANY", "INDIVIDUAL", "BUYER", "CONTRACTOR"]).optional(),
  name: z.string().min(1),
  registrationNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranchCode: z.string().optional(),
  notes: z.string().optional(),
});

const payeeSelect = {
  id: true,
  payeeType: true,
  name: true,
  registrationNumber: true,
  taxNumber: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  bankName: true,
  bankAccountHolder: true,
  bankAccountNumber: true,
  bankBranchCode: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
  _count: { select: { expenses: true } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const payees = await prisma.payee.findMany({ where: { mineId }, select: payeeSelect, orderBy: { name: "asc" } });
  res.json(payees);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = payeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { contactEmail, ...data } = parsed.data;
  const payee = await prisma.payee.create({
    data: { ...data, mineId, contactEmail: contactEmail || undefined, createdById: req.auth!.userId },
    select: payeeSelect,
  });
  res.status(201).json(payee);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = payeeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.payee.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Payee not found" });
  const { contactEmail, ...data } = parsed.data;
  const payee = await prisma.payee.update({
    where: { id: existing.id },
    data: { ...data, contactEmail: contactEmail || undefined },
    select: payeeSelect,
  });
  res.json(payee);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.payee.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Payee not found" });
  try {
    await prisma.payee.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: "This payee has expenses on record and cannot be deleted" });
  }
});

export default router;
