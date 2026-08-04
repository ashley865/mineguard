import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const reportSchema = z.object({
  type: z.enum(["NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_OBSERVATION"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  description: z.string().min(1),
  location: z.string().optional(),
  reporterName: z.string().optional(),
  zoneId: z.string().optional().nullable(),
});

const staffCreateSchema = reportSchema.extend({
  siteId: z.string().min(1),
});

const updateSchema = z.object({
  status: z.enum(["OPEN", "ACTION_REQUIRED", "CLOSED"]).optional(),
  actionTaken: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

const observationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  type: true,
  severity: true,
  description: true,
  location: true,
  actionTaken: true,
  status: true,
  reporterName: true,
  reportedBy: { select: { id: true, name: true } },
  closedAt: true,
  createdAt: true,
} as const;

// Public: lets a QR-code kiosk confirm which site an observation is being logged for.
router.get("/site/:siteId/info", async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId }, select: { id: true, name: true } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

// Public: near-miss and unsafe-act/condition reporting works best when it can be anonymous,
// so this endpoint requires no authentication — only a valid site QR link.
router.post("/report/:siteId", async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const observation = await prisma.safetyObservation.create({
    data: { ...parsed.data, siteId: site.id },
    select: observationSelect,
  });
  res.status(201).json(observation);
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const observations = await prisma.safetyObservation.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      status: (status as any) || undefined,
      type: (type as any) || undefined,
    },
    select: observationSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(observations);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = staffCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const observation = await prisma.safetyObservation.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
    select: observationSelect,
  });
  res.status(201).json(observation);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.safetyObservation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Observation not found" });
  const observation = await prisma.safetyObservation.update({
    where: { id: existing.id },
    data: { ...parsed.data, closedAt: parsed.data.status === "CLOSED" ? new Date() : undefined },
    select: observationSelect,
  });
  res.json(observation);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.safetyObservation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Observation not found" });
  await prisma.safetyObservation.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
