import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const teamMemberSchema = z.object({
  siteId: z.string().min(1),
  workerId: z.string().min(1),
  role: z.enum(["TEAM_LEADER", "MEMBER"]).optional(),
  certificationNumber: z.string().optional(),
  certificationExpiry: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const baSetSchema = z.object({
  siteId: z.string().min(1),
  setNumber: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  lastServiceDate: z.coerce.date().optional().nullable(),
  nextServiceDue: z.coerce.date().optional().nullable(),
  lastPressureTestDate: z.coerce.date().optional().nullable(),
  nextPressureTestDue: z.coerce.date().optional().nullable(),
  status: z.enum(["SERVICEABLE", "OUT_OF_SERVICE", "DUE_FOR_SERVICE"]).optional(),
});

const drillSchema = z.object({
  siteId: z.string().min(1),
  drillDate: z.coerce.date(),
  scenario: z.string().min(1),
  result: z.enum(["PASS", "FAIL", "PARTIAL"]).optional(),
  durationMinutes: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional(),
});

const mutualAidSchema = z.object({
  siteId: z.string().min(1),
  partnerOrganization: z.string().min(1),
  agreementType: z.string().optional(),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional().nullable(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const calloutSchema = z.object({
  siteId: z.string().min(1),
  emergencyEventId: z.string().optional().nullable(),
  calloutTime: z.coerce.date(),
  teamDispatched: z.string().optional(),
  responseTimeMinutes: z.coerce.number().int().optional().nullable(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
});

const teamMemberSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  role: true,
  certificationNumber: true,
  certificationExpiry: true,
  status: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/team-members", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const members = await prisma.rescueTeamMember.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: teamMemberSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(members);
});

router.post("/team-members", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = teamMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const member = await prisma.rescueTeamMember.create({ data: parsed.data, select: teamMemberSelect });
  res.status(201).json(member);
});

router.put("/team-members/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = teamMemberSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.rescueTeamMember.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Team member not found" });
  const member = await prisma.rescueTeamMember.update({ where: { id: existing.id }, data: parsed.data, select: teamMemberSelect });
  res.json(member);
});

router.delete("/team-members/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rescueTeamMember.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Team member not found" });
  await prisma.rescueTeamMember.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/ba-sets", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const sets = await prisma.breathingApparatusSet.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    orderBy: { createdAt: "desc" },
  });
  res.json(sets);
});

router.post("/ba-sets", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = baSetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const set = await prisma.breathingApparatusSet.create({ data: parsed.data });
  res.status(201).json(set);
});

router.put("/ba-sets/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = baSetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.breathingApparatusSet.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "BA set not found" });
  const set = await prisma.breathingApparatusSet.update({ where: { id: existing.id }, data: parsed.data });
  res.json(set);
});

router.delete("/ba-sets/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.breathingApparatusSet.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "BA set not found" });
  await prisma.breathingApparatusSet.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/drills", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const drills = await prisma.rescueDrill.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { conductedBy: { select: { id: true, name: true } } },
    orderBy: { drillDate: "desc" },
  });
  res.json(drills);
});

router.post("/drills", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const drill = await prisma.rescueDrill.create({ data: { ...parsed.data, conductedById: req.auth!.userId } });
  res.status(201).json(drill);
});

router.delete("/drills/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rescueDrill.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Drill not found" });
  await prisma.rescueDrill.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/mutual-aid", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const agreements = await prisma.mutualAidAgreement.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    orderBy: { createdAt: "desc" },
  });
  res.json(agreements);
});

router.post("/mutual-aid", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = mutualAidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const agreement = await prisma.mutualAidAgreement.create({ data: parsed.data });
  res.status(201).json(agreement);
});

router.delete("/mutual-aid/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.mutualAidAgreement.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Agreement not found" });
  await prisma.mutualAidAgreement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/callouts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const callouts = await prisma.rescueCallout.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { emergencyEvent: { select: { id: true, eventType: true, location: true } } },
    orderBy: { calloutTime: "desc" },
  });
  res.json(callouts);
});

router.post("/callouts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = calloutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.emergencyEventId) {
    const event = await prisma.emergencyEvent.findFirst({ where: { id: parsed.data.emergencyEventId, site: { mineId } } });
    if (!event) return res.status(404).json({ error: "Emergency event not found" });
  }
  const callout = await prisma.rescueCallout.create({ data: parsed.data });
  res.status(201).json(callout);
});

router.delete("/callouts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rescueCallout.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Callout not found" });
  await prisma.rescueCallout.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
