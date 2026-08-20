import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";
import { notifySecurityWebhook } from "../lib/securityWebhook";

const router = Router();

const alertSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  domain: z.enum(["ENDPOINT", "IDENTITY", "NETWORK", "VULNERABILITY", "EMAIL", "BACKUP", "OT_IOT", "COMPLIANCE", "OTHER"]).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]).optional(),
  status: z.enum(["NEW", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"]).optional(),
  source: z.string().optional(),
  affectedAssetName: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
  incidentId: z.string().optional().nullable(),
  detectedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const alertSelect = {
  id: true,
  title: true,
  description: true,
  domain: true,
  severity: true,
  status: true,
  source: true,
  affectedAssetName: true,
  assignedTo: { select: { id: true, name: true } },
  incidentId: true,
  incident: { select: { id: true, title: true } },
  detectedAt: true,
  resolvedAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const alerts = await prisma.cyberAlert.findMany({
    where: { mineId },
    select: alertSelect,
    orderBy: { detectedAt: "desc" },
  });
  res.json(alerts);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = alertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const alert = await prisma.cyberAlert.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: alertSelect,
  });
  if (alert.severity === "CRITICAL") {
    void notifySecurityWebhook({ severity: "CRITICAL", title: `New critical alert: ${alert.title}`, detail: alert.description });
  }
  res.status(201).json(alert);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = alertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberAlert.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  if (parsed.data.incidentId) {
    const incident = await prisma.cyberIncident.findFirst({ where: { id: parsed.data.incidentId, mineId } });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
  }
  const data = {
    ...parsed.data,
    resolvedAt:
      (parsed.data.status === "RESOLVED" || parsed.data.status === "FALSE_POSITIVE") && !existing.resolvedAt
        ? new Date()
        : undefined,
  };
  const alert = await prisma.cyberAlert.update({ where: { id: existing.id }, data, select: alertSelect });
  res.json(alert);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberAlert.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  await prisma.cyberAlert.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
