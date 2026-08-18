import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const incidentSchema = z.object({
  title: z.string().min(1),
  incidentType: z.enum(["PHISHING", "MALWARE", "UNAUTHORIZED_ACCESS", "DATA_BREACH", "DENIAL_OF_SERVICE", "VULNERABILITY", "OTHER"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"]).optional(),
  description: z.string().min(1),
  affectedSystems: z.string().optional(),
  detectedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  remediation: z.string().optional(),
  reportedByName: z.string().optional(),
});

const incidentSelect = {
  id: true,
  title: true,
  incidentType: true,
  severity: true,
  status: true,
  description: true,
  affectedSystems: true,
  detectedAt: true,
  resolvedAt: true,
  remediation: true,
  reportedByName: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const incidents = await prisma.iTSecurityIncident.findMany({
    where: { mineId },
    select: incidentSelect,
    orderBy: { detectedAt: "desc" },
  });
  res.json(incidents);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const incident = await prisma.iTSecurityIncident.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: incidentSelect,
  });
  res.status(201).json(incident);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTSecurityIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Security incident not found" });
  const data = {
    ...parsed.data,
    resolvedAt: parsed.data.status === "RESOLVED" && !existing.resolvedAt ? new Date() : parsed.data.resolvedAt,
  };
  const incident = await prisma.iTSecurityIncident.update({ where: { id: existing.id }, data, select: incidentSelect });
  res.json(incident);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTSecurityIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Security incident not found" });
  await prisma.iTSecurityIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
