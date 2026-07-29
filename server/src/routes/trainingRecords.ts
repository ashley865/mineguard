import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.trainingRecord.findMany({
    where: workerId ? { workerId } : undefined,
    include: { worker: { select: { id: true, name: true, employeeId: true, siteId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = trainingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.trainingRecord.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = trainingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.trainingRecord.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Training record not found" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.trainingRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Training record not found" });
  }
});

export default router;
