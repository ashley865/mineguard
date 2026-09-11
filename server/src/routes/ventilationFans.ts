import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const fanSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  identifier: z.string().min(1),
  fanType: z.enum(["MAIN_SURFACE", "MAIN_UNDERGROUND", "BOOSTER", "AUXILIARY", "FORCE", "EXHAUST", "OTHER"]),
  location: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  dutyQuantityM3s: z.number().nonnegative().optional().nullable(),
  dutyPressurePa: z.number().optional().nullable(),
  motorKw: z.number().nonnegative().optional().nullable(),
  installedDate: z.coerce.date().optional().nullable(),
  lastSurveyDate: z.coerce.date().optional().nullable(),
  nextSurveyDue: z.coerce.date().optional().nullable(),
  primaryVentilation: z.boolean().optional(),
  status: z.enum(["RUNNING", "STOPPED", "STANDBY", "UNDER_REPAIR", "DECOMMISSIONED"]).optional(),
  notes: z.string().optional(),
});

const surveySchema = z.object({
  surveyDate: z.coerce.date(),
  measuredQuantityM3s: z.number().nonnegative().optional().nullable(),
  measuredPressurePa: z.number().optional().nullable(),
  motorAmps: z.number().nonnegative().optional().nullable(),
  surveyedByName: z.string().min(1),
  findings: z.string().optional(),
  nextSurveyDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const stoppageSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional().nullable(),
  reason: z.enum(["PLANNED_MAINTENANCE", "BREAKDOWN", "POWER_FAILURE", "EMERGENCY", "OTHER"]),
  personsWithdrawn: z.boolean().optional(),
  withdrawalNote: z.string().optional(),
  reportedToRegulator: z.boolean().optional(),
  notes: z.string().optional(),
});

const fanSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  identifier: true,
  fanType: true,
  location: true,
  manufacturer: true,
  serialNumber: true,
  dutyQuantityM3s: true,
  dutyPressurePa: true,
  motorKw: true,
  installedDate: true,
  lastSurveyDate: true,
  nextSurveyDue: true,
  primaryVentilation: true,
  status: true,
  notes: true,
  surveys: {
    select: {
      id: true,
      surveyDate: true,
      measuredQuantityM3s: true,
      measuredPressurePa: true,
      motorAmps: true,
      surveyedByName: true,
      meetsDuty: true,
      findings: true,
      nextSurveyDue: true,
      notes: true,
    },
    orderBy: { surveyDate: "desc" as const },
    take: 10,
  },
  stoppages: {
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      reason: true,
      personsWithdrawn: true,
      withdrawalNote: true,
      reportedToRegulator: true,
      notes: true,
    },
    orderBy: { startedAt: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const fans = await prisma.ventilationFan.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: fanSelect,
    orderBy: [{ primaryVentilation: "desc" }, { identifier: "asc" }],
  });
  res.json(fans);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = fanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: site.id } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const fan = await prisma.ventilationFan.create({ data: parsed.data, select: fanSelect });
  res.status(201).json(fan);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = fanSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.ventilationFan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Fan not found" });
  const siteId = parsed.data.siteId ?? existing.siteId;
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const fan = await prisma.ventilationFan.update({ where: { id: existing.id }, data: parsed.data, select: fanSelect });
  res.json(fan);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.ventilationFan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Fan not found" });
  await prisma.ventilationFan.delete({ where: { id: existing.id } });
  res.status(204).send();
});

/**
 * A survey is judged against the fan's own duty point rather than trusting a
 * submitted flag — storing the design duty alongside the measurement is only
 * worth doing if the two are actually compared. With no duty on record the
 * survey is recorded but cannot be assessed, which is itself worth seeing.
 */
router.post("/:id/surveys", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = surveySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fan = await prisma.ventilationFan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!fan) return res.status(404).json({ error: "Fan not found" });

  const d = parsed.data;
  const meetsDuty =
    fan.dutyQuantityM3s != null && d.measuredQuantityM3s != null ? d.measuredQuantityM3s >= fan.dutyQuantityM3s : true;
  const survey = await prisma.fanSurvey.create({ data: { ...d, meetsDuty, fanId: fan.id } });
  await prisma.ventilationFan.update({
    where: { id: fan.id },
    data: { lastSurveyDate: d.surveyDate, nextSurveyDue: d.nextSurveyDue ?? fan.nextSurveyDue },
  });
  res.status(201).json(survey);
});

router.get("/:id/surveys", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const fan = await prisma.ventilationFan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!fan) return res.status(404).json({ error: "Fan not found" });
  const surveys = await prisma.fanSurvey.findMany({ where: { fanId: fan.id }, orderBy: { surveyDate: "desc" } });
  res.json(surveys);
});

/**
 * Logging an open-ended stoppage puts the fan into STOPPED; closing it out
 * returns it to RUNNING. On a primary ventilating fan the withdrawal question
 * is asked explicitly rather than inferred, because "were persons withdrawn"
 * is the first thing an inquiry asks and the answer must be a record, not a
 * reconstruction.
 */
router.post("/:id/stoppages", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = stoppageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fan = await prisma.ventilationFan.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!fan) return res.status(404).json({ error: "Fan not found" });
  if (parsed.data.endedAt && parsed.data.endedAt < parsed.data.startedAt) {
    return res.status(400).json({ error: "endedAt must not be before startedAt" });
  }

  const stoppage = await prisma.fanStoppage.create({ data: { ...parsed.data, fanId: fan.id } });
  if (fan.status !== "DECOMMISSIONED") {
    await prisma.ventilationFan.update({
      where: { id: fan.id },
      data: { status: parsed.data.endedAt ? "RUNNING" : "STOPPED" },
    });
  }
  res.status(201).json(stoppage);
});

router.put("/stoppages/:stoppageId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = stoppageSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.fanStoppage.findFirst({
    where: { id: req.params.stoppageId, fan: { site: { mineId } } },
    include: { fan: { select: { id: true, status: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Stoppage not found" });

  const stoppage = await prisma.fanStoppage.update({ where: { id: existing.id }, data: parsed.data });
  if (parsed.data.endedAt && existing.fan.status === "STOPPED") {
    await prisma.ventilationFan.update({ where: { id: existing.fan.id }, data: { status: "RUNNING" } });
  }
  res.json(stoppage);
});

router.delete("/stoppages/:stoppageId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.fanStoppage.findFirst({
    where: { id: req.params.stoppageId, fan: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Stoppage not found" });
  await prisma.fanStoppage.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
