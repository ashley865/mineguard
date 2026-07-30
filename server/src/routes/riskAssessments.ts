import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const riskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const raSchema = z.object({
  title: z.string().min(1),
  hazard: z.string().min(1),
  initialRiskLevel: riskLevel,
  residualRiskLevel: riskLevel,
  controlMeasures: z.string().min(1),
  assessor: z.string().min(1),
  status: z.enum(["DRAFT", "APPROVED", "UNDER_REVIEW", "EXPIRED"]).optional(),
  assessmentDate: z.coerce.date(),
  reviewDate: z.coerce.date(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.riskAssessment.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { reviewDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = raSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.riskAssessment.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = raSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.riskAssessment.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Risk assessment not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.riskAssessment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Risk assessment not found" });
  }
});

export default router;
