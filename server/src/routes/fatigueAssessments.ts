import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const testResultEnum = z.enum(["PASS", "BORDERLINE", "FAIL"]);
const outcomeEnum = z.enum(["CLEARED", "RESTRICTED_DUTY", "STOOD_DOWN"]);

const assessmentSchema = z.object({
  workerId: z.string().min(1),
  assessedAt: z.coerce.date().optional(),
  hoursWorkedLast24h: z.coerce.number().min(0).optional().nullable(),
  hoursRestLast24h: z.coerce.number().min(0).optional().nullable(),
  consecutiveShifts: z.coerce.number().int().min(0).optional().nullable(),
  testResult: testResultEnum,
  outcome: outcomeEnum.optional(),
  assessedByName: z.string().optional(),
  notes: z.string().optional(),
});

const assessmentSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  assessedAt: true,
  hoursWorkedLast24h: true,
  hoursRestLast24h: true,
  consecutiveShifts: true,
  testResult: true,
  outcome: true,
  assessedByName: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const assessments = await prisma.fatigueAssessment.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    select: assessmentSelect,
    orderBy: { assessedAt: "desc" },
  });
  res.json(assessments);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assessmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const assessment = await prisma.fatigueAssessment.create({ data: parsed.data, select: assessmentSelect });
  res.status(201).json(assessment);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assessmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.fatigueAssessment.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Assessment not found" });
  const assessment = await prisma.fatigueAssessment.update({ where: { id: existing.id }, data: parsed.data, select: assessmentSelect });
  res.json(assessment);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.fatigueAssessment.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Assessment not found" });
  await prisma.fatigueAssessment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
