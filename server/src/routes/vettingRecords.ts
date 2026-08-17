import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const vettingSchema = z.object({
  subjectType: z.enum(["CONTRACTOR", "VISITOR", "WORKER", "OTHER"]),
  subjectName: z.string().min(1),
  idNumber: z.string().optional(),
  checkType: z.enum(["CRIMINAL_RECORD", "ID_VERIFICATION", "REFERENCE_CHECK", "COMPETENCY_VERIFICATION", "OTHER"]),
  status: z.enum(["PENDING", "PASSED", "FAILED", "EXPIRED"]).optional(),
  checkedDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const vettingSelect = {
  id: true,
  subjectType: true,
  subjectName: true,
  idNumber: true,
  checkType: true,
  status: true,
  checkedDate: true,
  expiryDate: true,
  notes: true,
  conductedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const records = await prisma.vettingRecord.findMany({ where: { mineId }, select: vettingSelect, orderBy: { createdAt: "desc" } });
  res.json(records);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = vettingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const record = await prisma.vettingRecord.create({
    data: { ...parsed.data, mineId, conductedById: req.auth!.userId },
    select: vettingSelect,
  });
  res.status(201).json(record);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = vettingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.vettingRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vetting record not found" });
  const record = await prisma.vettingRecord.update({ where: { id: existing.id }, data: parsed.data, select: vettingSelect });
  res.json(record);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.vettingRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vetting record not found" });
  await prisma.vettingRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
