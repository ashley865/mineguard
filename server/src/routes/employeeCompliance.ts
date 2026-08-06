import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const complianceCheckSchema = z.object({
  workerId: z.string().min(1),
  isProperlyTrained: z.coerce.boolean().optional(),
  isCompetent: z.coerce.boolean().optional(),
  isCertified: z.coerce.boolean().optional(),
  isAuthorised: z.coerce.boolean().optional(),
  medicalFitness: z.enum(["FIT", "FIT_WITH_RESTRICTION", "TEMPORARILY_UNFIT", "UNFIT"]).optional().nullable(),
  isAssignedPermittedTasks: z.coerce.boolean().optional(),
  isTrainingUpToDate: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

const complianceCheckSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true, siteId: true } },
  isProperlyTrained: true,
  isCompetent: true,
  isCertified: true,
  isAuthorised: true,
  medicalFitness: true,
  isAssignedPermittedTasks: true,
  isTrainingUpToDate: true,
  notes: true,
  assessmentDate: true,
  assessedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.employeeComplianceCheck.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    select: complianceCheckSelect,
    orderBy: { assessmentDate: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = complianceCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const item = await prisma.employeeComplianceCheck.create({
    data: { ...parsed.data, assessedById: req.auth!.userId },
    select: complianceCheckSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = complianceCheckSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.employeeComplianceCheck.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Compliance check not found" });
  const item = await prisma.employeeComplianceCheck.update({
    where: { id: existing.id },
    data: parsed.data,
    select: complianceCheckSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.employeeComplianceCheck.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Compliance check not found" });
  await prisma.employeeComplianceCheck.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
