import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.medicalSurveillance.findMany({
    where: workerId ? { workerId } : undefined,
    include: {
      worker: { select: { id: true, name: true, employeeId: true, siteId: true } },
    },
    orderBy: { nextExamDue: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = medicalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.medicalSurveillance.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = medicalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.medicalSurveillance.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Medical record not found" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.medicalSurveillance.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Medical record not found" });
  }
});

export default router;
