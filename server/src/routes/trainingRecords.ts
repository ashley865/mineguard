import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const trainingSchema = z.object({
  workerId: z.string().min(1),
  courseName: z.string().min(1),
  trainingType: z.enum([
    "INDUCTION",
    "REFRESHER",
    "FIRST_AID",
    "FIRE_FIGHTING",
    "SELF_RESCUE",
    "HAZARD_SPECIFIC",
    "SKILLS_DEVELOPMENT",
    "OTHER",
  ]),
  completionDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional().nullable(),
  provider: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.trainingRecord.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    include: { worker: { select: { id: true, name: true, employeeId: true, siteId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = trainingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const item = await prisma.trainingRecord.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = trainingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.trainingRecord.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Training record not found" });
  const item = await prisma.trainingRecord.update({ where: { id: existing.id }, data: parsed.data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.trainingRecord.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Training record not found" });
  await prisma.trainingRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
