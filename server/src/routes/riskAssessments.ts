import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

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
  likelihood: z.coerce.number().int().min(1).max(5).optional(),
  severity: z.coerce.number().int().min(1).max(5).optional(),
  owner: z.string().optional().nullable(),
  mitigationStatus: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]).optional(),
  mitigationDueDate: z.coerce.date().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.riskAssessment.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { reviewDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = raSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.riskAssessment.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = raSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.riskAssessment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Risk assessment not found" });
  const item = await prisma.riskAssessment.update({ where: { id: existing.id }, data: parsed.data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.riskAssessment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Risk assessment not found" });
  await prisma.riskAssessment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
