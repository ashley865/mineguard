import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const categories = [
  "SPILL",
  "WATER_POLLUTION",
  "AIR_POLLUTION",
  "DUST_EXCEEDANCE",
  "WASTE_MISMANAGEMENT",
  "NOISE",
  "ECOLOGICAL_DAMAGE",
  "OTHER",
] as const;

const incidentSchema = z.object({
  siteId: z.string().min(1),
  incidentDate: z.coerce.date(),
  category: z.enum(categories),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"]).optional(),
  description: z.string().min(1),
  receivingEnvironment: z.string().optional(),
  estimatedVolume: z.number().nonnegative().optional().nullable(),
  volumeUnit: z.string().optional(),
  immediateActionTaken: z.string().optional(),
  regulatorNotificationRequired: z.boolean().optional(),
  regulatorNotifiedAt: z.coerce.date().optional().nullable(),
  regulatorNotifiedTo: z.string().optional(),
  remediationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "VERIFIED"]).optional(),
  remediationCompletedAt: z.coerce.date().optional().nullable(),
  rootCause: z.string().optional(),
  recurrencePrevented: z.boolean().optional(),
  notes: z.string().optional(),
});

const verifySchema = z.object({
  remediationStatus: z.literal("VERIFIED"),
});

const incidentSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  incidentDate: true,
  category: true,
  severity: true,
  description: true,
  receivingEnvironment: true,
  estimatedVolume: true,
  volumeUnit: true,
  immediateActionTaken: true,
  regulatorNotificationRequired: true,
  regulatorNotifiedAt: true,
  regulatorNotifiedTo: true,
  remediationStatus: true,
  remediationCompletedAt: true,
  rootCause: true,
  recurrencePrevented: true,
  reportedBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const incidents = await prisma.environmentalIncident.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: incidentSelect,
    orderBy: { incidentDate: "desc" },
    take: 500,
  });
  res.json(incidents);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const incident = await prisma.environmentalIncident.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
    select: incidentSelect,
  });
  res.status(201).json(incident);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.environmentalIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  // Editing away from VERIFIED clears the sign-off — a changed remediation record
  // needs re-verifying, not to keep wearing a stamp that no longer describes it.
  const clearsVerification = parsed.data.remediationStatus && parsed.data.remediationStatus !== "VERIFIED" && existing.verifiedById;
  const incident = await prisma.environmentalIncident.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(clearsVerification ? { verifiedById: null } : {}) },
    select: incidentSelect,
  });
  res.json(incident);
});

/**
 * Verification is a distinct, audited action rather than a field anyone can set
 * via the general update route — the same reasoning as the tailings engineer
 * sign-off: it should always name who confirmed the remediation actually
 * happened, not just that someone changed a dropdown.
 */
router.post("/:id/verify", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.environmentalIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const incident = await prisma.environmentalIncident.update({
    where: { id: existing.id },
    data: { remediationStatus: "VERIFIED", verifiedById: req.auth!.userId },
    select: incidentSelect,
  });
  res.json(incident);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.environmentalIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  await prisma.environmentalIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const WINDOW_DAYS = 365;

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const incidents = await prisma.environmentalIncident.findMany({
    where: { site: { mineId }, incidentDate: { gte: since } },
    select: {
      category: true,
      severity: true,
      incidentDate: true,
      regulatorNotificationRequired: true,
      regulatorNotifiedAt: true,
      remediationStatus: true,
      recurrencePrevented: true,
      rootCause: true,
    },
  });

  const byCategory: Record<string, number> = {};
  for (const i of incidents) byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;

  const notificationsRequired = incidents.filter((i) => i.regulatorNotificationRequired);
  const notified = notificationsRequired.filter((i) => i.regulatorNotifiedAt);
  // Response time in hours from the incident to the regulator being told — the NEMA
  // s30 duty is to notify "without delay", so the distribution of this number is
  // the evidence, not just whether notification eventually happened.
  const notificationHours = notified.map((i) => (i.regulatorNotifiedAt!.getTime() - i.incidentDate.getTime()) / 3_600_000);
  const avgNotificationHours = notificationHours.length > 0 ? notificationHours.reduce((a, b) => a + b, 0) / notificationHours.length : null;
  const notificationsOutstanding = notificationsRequired.length - notified.length;

  const unremediated = incidents.filter((i) => i.remediationStatus === "NOT_STARTED" || i.remediationStatus === "IN_PROGRESS").length;
  const completeButUnverified = incidents.filter((i) => i.remediationStatus === "COMPLETE").length;

  const withRootCause = incidents.filter((i) => i.rootCause);
  const recurrencePrevented = incidents.filter((i) => i.recurrencePrevented).length;

  res.json({
    windowDays: WINDOW_DAYS,
    total: incidents.length,
    byCategory,
    majorOrWorse: incidents.filter((i) => i.severity === "MAJOR" || i.severity === "CATASTROPHIC").length,
    notificationsRequired: notificationsRequired.length,
    notificationsOutstanding,
    avgNotificationHours: avgNotificationHours != null ? Math.round(avgNotificationHours * 10) / 10 : null,
    unremediated,
    completeButUnverified,
    // Null when nothing happened in the window — 0% would read as a broken RCA
    // process rather than an uneventful year.
    rcaCompletionPct: incidents.length > 0 ? Math.round((withRootCause.length / incidents.length) * 100) : null,
    recurrencePreventedPct: withRootCause.length > 0 ? Math.round((recurrencePrevented / withRootCause.length) * 100) : null,
  });
});

export default router;
