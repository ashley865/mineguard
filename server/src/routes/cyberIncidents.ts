import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberApprovalAccess } from "../lib/cyberAccess";

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

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const incidents = await prisma.cyberIncident.findMany({
    where: { mineId },
    select: incidentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const incident = await prisma.cyberIncident.create({
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
  const existing = await prisma.cyberIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });

  // Closing out a CRITICAL incident is the highest-stakes action in the module — it
  // declares the mine no longer under active threat from it — so it needs the same
  // sign-off as accepting risk on a critical vulnerability.
  if (parsed.data.status === "RESOLVED" && existing.severity === "CRITICAL") {
    if (!(await requireCyberApprovalAccess(req, res))) return;
  }

  const data = {
    ...parsed.data,
    containedAt: parsed.data.status === "CONTAINED" && !existing.containedAt ? new Date() : undefined,
    resolvedAt: parsed.data.status === "RESOLVED" && !existing.resolvedAt ? new Date() : undefined,
  };
  const incident = await prisma.cyberIncident.update({ where: { id: existing.id }, data, select: incidentSelect });
  res.json(incident);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.cyberIncident.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  await prisma.cyberIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
