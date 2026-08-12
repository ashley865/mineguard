import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const planSchema = z.object({
  siteId: z.string().min(1),
  planReferenceNumber: z.string().optional(),
  financialProvisionAmount: z.coerce.number().optional().nullable(),
  currency: z.string().optional(),
  guaranteeInstrument: z.string().optional(),
  lastAssessmentDate: z.coerce.date().optional().nullable(),
  nextAssessmentDue: z.coerce.date().optional().nullable(),
  targetClosureDate: z.coerce.date().optional().nullable(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "VERIFIED"]).optional(),
  notes: z.string().optional(),
});

const progressSchema = z.object({
  planId: z.string().min(1),
  updateDate: z.coerce.date().optional(),
  hectaresRehabilitated: z.coerce.number().optional().nullable(),
  percentComplete: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().min(1),
});

const planSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  planReferenceNumber: true,
  financialProvisionAmount: true,
  currency: true,
  guaranteeInstrument: true,
  lastAssessmentDate: true,
  nextAssessmentDue: true,
  targetClosureDate: true,
  status: true,
  notes: true,
  progressUpdates: {
    select: { id: true, updateDate: true, hectaresRehabilitated: true, percentComplete: true, description: true, recordedBy: { select: { id: true, name: true } } },
    orderBy: { updateDate: "desc" as const },
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const plans = await prisma.closureRehabilitationPlan.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: planSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(plans);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const plan = await prisma.closureRehabilitationPlan.create({ data: parsed.data, select: planSelect });
  res.status(201).json(plan);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.closureRehabilitationPlan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Plan not found" });
  const plan = await prisma.closureRehabilitationPlan.update({ where: { id: existing.id }, data: parsed.data, select: planSelect });
  res.json(plan);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.closureRehabilitationPlan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Plan not found" });
  await prisma.closureRehabilitationPlan.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/progress", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = progressSchema.omit({ planId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plan = await prisma.closureRehabilitationPlan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  await prisma.closureRehabilitationProgress.create({
    data: { ...parsed.data, planId: plan.id, recordedById: req.auth!.userId },
  });
  const updated = await prisma.closureRehabilitationPlan.findUnique({ where: { id: plan.id }, select: planSelect });
  res.status(201).json(updated);
});

export default router;
