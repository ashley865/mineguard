import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const changeSchema = z.object({
  title: z.string().min(1),
  changeType: z.enum(["STANDARD", "NORMAL", "EMERGENCY"]).optional(),
  systemAffected: z.string().optional(),
  description: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["PLANNED", "APPROVED", "IN_PROGRESS", "COMPLETED", "ROLLED_BACK", "CANCELLED"]).optional(),
  scheduledDate: z.coerce.date().optional().nullable(),
  implementedDate: z.coerce.date().optional().nullable(),
  rollbackPlan: z.string().optional(),
  outcome: z.string().optional(),
});

const changeSelect = {
  id: true,
  title: true,
  changeType: true,
  systemAffected: true,
  description: true,
  riskLevel: true,
  status: true,
  scheduledDate: true,
  implementedDate: true,
  rollbackPlan: true,
  outcome: true,
  approvedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const changes = await prisma.iTChangeRequest.findMany({
    where: { mineId },
    select: changeSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(changes);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = changeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const change = await prisma.iTChangeRequest.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: changeSelect,
  });
  res.status(201).json(change);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = changeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTChangeRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Change request not found" });
  const change = await prisma.iTChangeRequest.update({ where: { id: existing.id }, data: parsed.data, select: changeSelect });
  res.json(change);
});

// Approving a change is kept separate from the general edit form, mirroring the
// approve endpoints elsewhere in the app — it's a deliberate sign-off action, not
// just another field update.
router.post("/:id/approve", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTChangeRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Change request not found" });
  const change = await prisma.iTChangeRequest.update({
    where: { id: existing.id },
    data: { status: "APPROVED", approvedById: req.auth!.userId },
    select: changeSelect,
  });
  res.json(change);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTChangeRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Change request not found" });
  await prisma.iTChangeRequest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
