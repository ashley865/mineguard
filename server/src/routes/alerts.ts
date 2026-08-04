import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const status = req.query.status as string | undefined;
  const siteId = req.query.siteId as string | undefined;
  const alerts = await prisma.alert.findMany({
    where: {
      site: { mineId },
      ...(status ? { status: status as any } : {}),
      ...(siteId ? { siteId } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      sensor: { select: { id: true, name: true, type: true } },
      acknowledgedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(alerts);
});

router.post("/:id/acknowledge", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.alert.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  const alert = await prisma.alert.update({
    where: { id: existing.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedById: req.auth!.userId,
    },
  });
  const io = req.app.get("io");
  io?.emit("alert:updated", alert);
  res.json(alert);
});

router.post("/:id/resolve", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.alert.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  const alert = await prisma.alert.update({
    where: { id: existing.id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  const io = req.app.get("io");
  io?.emit("alert:updated", alert);
  res.json(alert);
});

router.post("/:id/review", requireRole("EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.alert.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  const alert = await prisma.alert.update({
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
  io?.emit("alert:updated", alert);
  res.json(alert);
});

export default router;
