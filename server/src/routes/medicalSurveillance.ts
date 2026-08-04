import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const medicalSchema = z.object({
  workerId: z.string().min(1),
  examType: z.enum(["PRE_EMPLOYMENT", "PERIODICAL", "EXIT", "RETURN_TO_WORK"]),
  examDate: z.coerce.date(),
  result: z.enum(["FIT", "FIT_WITH_RESTRICTION", "TEMPORARILY_UNFIT", "UNFIT"]),
  restrictions: z.string().optional(),
  nextExamDue: z.coerce.date(),
  practitioner: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.medicalSurveillance.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    include: {
      worker: { select: { id: true, name: true, employeeId: true, siteId: true } },
    },
    orderBy: { nextExamDue: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = medicalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const item = await prisma.medicalSurveillance.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = medicalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.medicalSurveillance.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Medical record not found" });
  const item = await prisma.medicalSurveillance.update({ where: { id: existing.id }, data: parsed.data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.medicalSurveillance.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Medical record not found" });
  await prisma.medicalSurveillance.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
