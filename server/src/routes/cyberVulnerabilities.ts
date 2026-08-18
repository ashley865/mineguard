import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";

const router = Router();

const vulnerabilitySchema = z.object({
  cveId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  cvssScore: z.coerce.number().min(0).max(10).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]).optional(),
  affectedAssetName: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "PATCHED", "ACCEPTED_RISK", "FALSE_POSITIVE"]).optional(),
  discoveredAt: z.coerce.date().optional(),
  remediationDeadline: z.coerce.date().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

const vulnerabilitySelect = {
  id: true,
  cveId: true,
  title: true,
  description: true,
  cvssScore: true,
  severity: true,
  affectedAssetName: true,
  status: true,
  discoveredAt: true,
  remediationDeadline: true,
  assignedTo: { select: { id: true, name: true } },
  remediatedAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const vulnerabilities = await prisma.cyberVulnerability.findMany({
    where: { mineId },
    select: vulnerabilitySelect,
    orderBy: { discoveredAt: "desc" },
  });
  res.json(vulnerabilities);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = vulnerabilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vulnerability = await prisma.cyberVulnerability.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: vulnerabilitySelect,
  });
  res.status(201).json(vulnerability);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = vulnerabilitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberVulnerability.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vulnerability not found" });
  const data = {
    ...parsed.data,
    remediatedAt: parsed.data.status === "PATCHED" && !existing.remediatedAt ? new Date() : undefined,
  };
  const vulnerability = await prisma.cyberVulnerability.update({ where: { id: existing.id }, data, select: vulnerabilitySelect });
  res.json(vulnerability);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberVulnerability.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vulnerability not found" });
  await prisma.cyberVulnerability.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
