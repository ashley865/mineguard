import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const contactSchema = z.object({
  siteId: z.string().optional().nullable(),
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().min(1),
  category: z
    .enum(["MINE_RESCUE", "MEDICAL", "AMBULANCE", "FIRE", "POLICE", "SECURITY", "INTERNAL_MANAGEMENT", "OTHER"])
    .optional(),
  priority: z.coerce.number().optional(),
});

const evacuationSchema = z.object({
  siteId: z.string().min(1),
  assemblyPoint: z.string().min(1),
  message: z.string().optional(),
});

const drillSchema = z.object({
  siteId: z.string().min(1),
  drillDate: z.coerce.date(),
  drillType: z.enum(["FIRE", "GAS_LEAK", "SEISMIC", "GENERAL"]),
  totalParticipants: z.coerce.number().int().optional().nullable(),
  musterTimeSeconds: z.coerce.number().int().optional().nullable(),
  issuesIdentified: z.string().optional(),
});

const contactSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  role: true,
  phone: true,
  category: true,
  priority: true,
  createdAt: true,
} as const;

const drillSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  drillDate: true,
  drillType: true,
  totalParticipants: true,
  musterTimeSeconds: true,
  issuesIdentified: true,
  conductedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const evacuationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  assemblyPoint: true,
  message: true,
  status: true,
  triggeredBy: { select: { id: true, name: true } },
  triggeredAt: true,
  cancelledBy: { select: { id: true, name: true } },
  cancelledAt: true,
} as const;

router.use(requireAuth);

router.get("/contacts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const contacts = await prisma.emergencyContact.findMany({
    where: { mineId, ...(siteId ? { OR: [{ siteId }, { siteId: null }] } : {}) },
    select: contactSelect,
    orderBy: { priority: "asc" },
  });
  res.json(contacts);
});

router.post("/contacts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const contact = await prisma.emergencyContact.create({ data: { ...parsed.data, mineId }, select: contactSelect });
  res.status(201).json(contact);
});

router.put("/contacts/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.emergencyContact.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Emergency contact not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const contact = await prisma.emergencyContact.update({ where: { id: existing.id }, data: parsed.data, select: contactSelect });
  res.json(contact);
});

router.delete("/contacts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.emergencyContact.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Emergency contact not found" });
  await prisma.emergencyContact.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/drills", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const drills = await prisma.evacuationDrill.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: drillSelect,
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
  const drill = await prisma.evacuationDrill.create({
    data: { ...parsed.data, conductedById: req.auth!.userId },
    select: drillSelect,
  });
  res.status(201).json(drill);
});

router.put("/drills/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.evacuationDrill.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Evacuation drill not found" });
  const drill = await prisma.evacuationDrill.update({ where: { id: existing.id }, data: parsed.data, select: drillSelect });
  res.json(drill);
});

router.delete("/drills/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.evacuationDrill.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Evacuation drill not found" });
  await prisma.evacuationDrill.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Anyone can raise the alarm — a genuine evacuation is not the moment to gate on role.
router.post("/evacuations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = evacuationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const evacuation = await prisma.emergencyEvacuation.create({
    data: { ...parsed.data, mineId, triggeredById: req.auth!.userId },
    select: evacuationSelect,
  });

  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("emergency:evacuation", evacuation);

  res.status(201).json(evacuation);
});

router.get("/evacuations/active", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const evacuations = await prisma.emergencyEvacuation.findMany({
    where: { mineId, status: "ACTIVE" },
    select: evacuationSelect,
    orderBy: { triggeredAt: "desc" },
  });
  res.json(evacuations);
});

router.get("/evacuations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const evacuations = await prisma.emergencyEvacuation.findMany({
    where: { mineId },
    select: evacuationSelect,
    orderBy: { triggeredAt: "desc" },
    take: 50,
  });
  res.json(evacuations);
});

router.post("/evacuations/:id/cancel", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.emergencyEvacuation.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Evacuation not found" });
  if (existing.status !== "ACTIVE") return res.status(409).json({ error: "This evacuation has already been cancelled" });

  const evacuation = await prisma.emergencyEvacuation.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", cancelledById: req.auth!.userId, cancelledAt: new Date() },
    select: evacuationSelect,
  });

  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("emergency:evacuation-cancelled", { id: evacuation.id });

  res.json(evacuation);
});

// ---------------------------------------------------------------------------
// Emergency events — the Safety Officer's emergency dashboard. Distinct from the
// EmergencyContact/EvacuationDrill registers above: this is the live incident record for
// an actual major emergency (fire, explosion, serious injury, etc.), optionally linked to
// a formal evacuation trigger.
// ---------------------------------------------------------------------------

const eventTypeEnum = z.enum([
  "FIRE",
  "GROUND_INSTABILITY",
  "EXPLOSION",
  "FLOODING",
  "GAS_EVENT",
  "SERIOUS_INJURY",
  "VEHICLE_INCIDENT",
  "EVACUATION",
  "OTHER",
]);

const eventSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  eventType: eventTypeEnum,
  location: z.string().min(1),
  description: z.string().min(1),
  peopleAffectedCount: z.coerce.number().int().nonnegative().optional().nullable(),
  peopleAffectedDetails: z.string().optional().nullable(),
  response: z.string().optional().nullable(),
  evacuationId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "RESPONDING", "CONTAINED", "RESOLVED"]).optional(),
});

const eventSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  eventType: true,
  location: true,
  description: true,
  peopleAffectedCount: true,
  peopleAffectedDetails: true,
  response: true,
  evacuationId: true,
  evacuation: { select: { id: true, status: true, assemblyPoint: true, triggeredAt: true } },
  status: true,
  reportedBy: { select: { id: true, name: true } },
  occurredAt: true,
  resolvedAt: true,
  createdAt: true,
} as const;

router.get("/events", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const events = await prisma.emergencyEvent.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: eventSelect,
    orderBy: { occurredAt: "desc" },
  });
  res.json(events);
});

// Anyone can log an emergency event, same as raising the evacuation alarm above — a fire
// or serious injury can't wait on an executive/admin being available to file the report.
router.post("/events", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: parsed.data.siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  if (parsed.data.evacuationId) {
    const evacuation = await prisma.emergencyEvacuation.findFirst({ where: { id: parsed.data.evacuationId, mineId } });
    if (!evacuation) return res.status(404).json({ error: "Evacuation not found" });
  }

  const event = await prisma.emergencyEvent.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
    select: eventSelect,
  });

  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("emergency:event", event);

  res.status(201).json(event);
});

// Follow-up (response notes, status, linking/unlinking an evacuation) is a management
// action, unlike the initial report — restricted the same way as every other register.
router.put("/events/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.emergencyEvent.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Emergency event not found" });
  if (parsed.data.evacuationId) {
    const evacuation = await prisma.emergencyEvacuation.findFirst({ where: { id: parsed.data.evacuationId, mineId } });
    if (!evacuation) return res.status(404).json({ error: "Evacuation not found" });
  }

  const resolvedAt = parsed.data.status === "RESOLVED" && existing.status !== "RESOLVED" ? new Date() : undefined;
  const event = await prisma.emergencyEvent.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(resolvedAt ? { resolvedAt } : {}) },
    select: eventSelect,
  });
  res.json(event);
});

router.delete("/events/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.emergencyEvent.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Emergency event not found" });
  await prisma.emergencyEvent.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
