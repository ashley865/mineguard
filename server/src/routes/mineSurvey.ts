import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const surveyPlanSchema = z.object({
  siteId: z.string().min(1),
  planReferenceNumber: z.string().optional(),
  surveyDate: z.coerce.date(),
  surveyorName: z.string().min(1),
  surveyorRegistrationNumber: z.string().optional(),
  workingsExtentDescription: z.string().optional(),
  submittedToRegulator: z.boolean().optional(),
  submittedDate: z.coerce.date().optional().nullable(),
  nextSurveyDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const beaconSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  beaconType: z.enum(["PRIMARY_SG_BEACON", "SECONDARY_MINE_BEACON", "UNDERGROUND_STATION", "OTHER"]).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  lastVerifiedDate: z.coerce.date().optional().nullable(),
  nextVerificationDue: z.coerce.date().optional().nullable(),
  condition: z.enum(["INTACT", "DAMAGED", "MISSING", "REPLACED"]).optional(),
  notes: z.string().optional(),
});

const surveyPlanSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  planReferenceNumber: true,
  surveyDate: true,
  surveyorName: true,
  surveyorRegistrationNumber: true,
  workingsExtentDescription: true,
  submittedToRegulator: true,
  submittedDate: true,
  nextSurveyDue: true,
  notes: true,
  createdAt: true,
} as const;

const beaconSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  identifier: true,
  beaconType: true,
  latitude: true,
  longitude: true,
  lastVerifiedDate: true,
  nextVerificationDue: true,
  condition: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

// --- Survey plans ------------------------------------------------------------

router.get("/plans", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const plans = await prisma.surveyPlan.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: surveyPlanSelect,
    orderBy: { surveyDate: "desc" },
  });
  res.json(plans);
});

router.post("/plans", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = surveyPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const plan = await prisma.surveyPlan.create({ data: parsed.data, select: surveyPlanSelect });
  res.status(201).json(plan);
});

router.put("/plans/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = surveyPlanSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.surveyPlan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Survey plan not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const plan = await prisma.surveyPlan.update({ where: { id: existing.id }, data: parsed.data, select: surveyPlanSelect });
  res.json(plan);
});

router.delete("/plans/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.surveyPlan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Survey plan not found" });
  await prisma.surveyPlan.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Boundary beacons ---------------------------------------------------------

router.get("/beacons", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const beacons = await prisma.boundaryBeacon.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: beaconSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(beacons);
});

router.post("/beacons", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = beaconSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const beacon = await prisma.boundaryBeacon.create({ data: parsed.data, select: beaconSelect });
  res.status(201).json(beacon);
});

router.put("/beacons/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = beaconSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.boundaryBeacon.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Boundary beacon not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const beacon = await prisma.boundaryBeacon.update({ where: { id: existing.id }, data: parsed.data, select: beaconSelect });
  res.json(beacon);
});

router.delete("/beacons/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.boundaryBeacon.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Boundary beacon not found" });
  await prisma.boundaryBeacon.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
