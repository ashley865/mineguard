import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const wspSchema = z.object({
  planYear: z.coerce.number().int(),
  setaName: z.string().optional(),
  submittedDate: z.coerce.date().optional().nullable(),
  levyPayable: z.coerce.number().optional().nullable(),
  levyGrantClaimed: z.coerce.number().optional().nullable(),
  atrSubmittedDate: z.coerce.date().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "GRANT_PAID"]).optional(),
  notes: z.string().optional(),
});

const learnershipSchema = z.object({
  workerId: z.string().optional().nullable(),
  learnerName: z.string().min(1),
  programme: z.string().min(1),
  provider: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.enum(["APPLIED", "ENROLLED", "IN_PROGRESS", "COMPLETED", "WITHDRAWN"]).optional(),
  fundingSource: z.string().optional(),
  notes: z.string().optional(),
});

const learnershipSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  learnerName: true,
  programme: true,
  provider: true,
  startDate: true,
  endDate: true,
  status: true,
  fundingSource: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/wsp", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const plans = await prisma.workplaceSkillsPlan.findMany({ where: { mineId }, orderBy: { planYear: "desc" } });
  res.json(plans);
});

router.post("/wsp", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = wspSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plan = await prisma.workplaceSkillsPlan.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(plan);
});

router.put("/wsp/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = wspSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.workplaceSkillsPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Plan not found" });
  const plan = await prisma.workplaceSkillsPlan.update({ where: { id: existing.id }, data: parsed.data });
  res.json(plan);
});

router.delete("/wsp/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.workplaceSkillsPlan.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Plan not found" });
  await prisma.workplaceSkillsPlan.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/learnerships", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const learnerships = await prisma.learnership.findMany({
    where: { mineId },
    select: learnershipSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(learnerships);
});

router.post("/learnerships", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = learnershipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.workerId) {
    const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
    if (!worker) return res.status(404).json({ error: "Worker not found" });
  }
  const learnership = await prisma.learnership.create({
    data: { ...parsed.data, mineId, recordedById: req.auth!.userId },
    select: learnershipSelect,
  });
  res.status(201).json(learnership);
});

router.put("/learnerships/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = learnershipSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.learnership.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Learnership not found" });
  const learnership = await prisma.learnership.update({ where: { id: existing.id }, data: parsed.data, select: learnershipSelect });
  res.json(learnership);
});

router.delete("/learnerships/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.learnership.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Learnership not found" });
  await prisma.learnership.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
