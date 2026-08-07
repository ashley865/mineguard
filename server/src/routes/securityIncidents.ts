import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const categoryEnum = z.enum([
  "THEFT",
  "UNAUTHORISED_ACCESS",
  "TRESPASSING",
  "VANDALISM",
  "ASSAULT",
  "PROPERTY_DAMAGE",
  "SUSPICIOUS_ACTIVITY",
  "MISSING_EQUIPMENT",
  "VEHICLE_INCIDENT",
  "PERIMETER_BREACH",
  "FRAUD_MISCONDUCT",
  "EMERGENCY",
  "OTHER",
]);

const securityIncidentSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  category: categoryEnum,
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(1),
  location: z.string().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(),
  actionsTaken: z.string().optional().nullable(),
});

const securityIncidentSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  category: true,
  severity: true,
  description: true,
  location: true,
  occurredAt: true,
  reportedBy: { select: { id: true, name: true } },
  status: true,
  actionsTaken: true,
  resolvedAt: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const items = await prisma.securityIncident.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      status: (status as any) || undefined,
      category: (category as any) || undefined,
    },
    select: securityIncidentSelect,
    orderBy: { occurredAt: "desc" },
  });
  res.json(items);
});

// Logged immediately by whoever is on scene — same creation access as the general
// Incident and SafetyObservation registers, not gated further just because it's Security.
router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = securityIncidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: parsed.data.siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  const item = await prisma.securityIncident.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
    select: securityIncidentSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = securityIncidentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Security incident not found" });
  const siteId = parsed.data.siteId ?? existing.siteId;
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  const resolvedAt =
    parsed.data.status === "RESOLVED" && existing.status !== "RESOLVED" ? new Date() : undefined;
  const item = await prisma.securityIncident.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(resolvedAt ? { resolvedAt } : {}) },
    select: securityIncidentSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityIncident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Security incident not found" });
  await prisma.securityIncident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
