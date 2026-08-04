import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const incidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const incidents = await prisma.incident.findMany({
    where: {
      site: { mineId },
      ...(siteId ? { siteId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const incident = await prisma.incident.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
  });
  res.status(201).json(incident);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const data: any = { ...parsed.data };
  if (parsed.data.status === "RESOLVED") data.resolvedAt = new Date();
  const incident = await prisma.incident.update({ where: { id: existing.id }, data });
  res.json(incident);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  await prisma.incident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/review", requireRole("EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const incident = await prisma.incident.update({
    where: { id: existing.id },
    data: {
      reviewStatus: parsed.data.decision,
      reviewNote: parsed.data.note,
      reviewedAt: new Date(),
      reviewedById: req.auth!.userId,
    },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });
  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("incident:updated", incident);
  res.json(incident);
});

export default router;
