import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";
import { notifySecurityWebhook } from "../lib/securityWebhook";

const router = Router();

const incidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"]).optional(),
  affectedAssets: z.string().optional(),
  riskScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

const incidentSelect = {
  id: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  affectedAssets: true,
  riskScore: true,
  aiSummary: true,
  assignedTo: { select: { id: true, name: true } },
  containedAt: true,
  resolvedAt: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
  alerts: {
    select: { id: true, title: true, severity: true, status: true, domain: true, detectedAt: true },
    orderBy: { detectedAt: "desc" as const },
  },
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const incidents = await prisma.cyberIncident.findMany({
    where: { mineId },
    select: incidentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const incident = await prisma.cyberIncident.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: incidentSelect,
  });
  if (incident.severity === "CRITICAL") {
    void notifySecurityWebhook({ severity: "CRITICAL", title: `New critical incident: ${incident.title}`, detail: incident.description });
  }
  res.status(201).json(incident);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = incidentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const data = {
    ...parsed.data,
    containedAt: parsed.data.status === "CONTAINED" && !existing.containedAt ? new Date() : undefined,
    resolvedAt: parsed.data.status === "RESOLVED" && !existing.resolvedAt ? new Date() : undefined,
  };
  const incident = await prisma.cyberIncident.update({ where: { id: existing.id }, data, select: incidentSelect });
  res.json(incident);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  await prisma.cyberIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
