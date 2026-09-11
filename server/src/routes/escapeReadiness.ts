import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const rescuerSchema = z.object({
  siteId: z.string().min(1),
  serialNumber: z.string().min(1),
  rescuerType: z.enum(["FILTER_SELF_RESCUER", "SELF_CONTAINED_SELF_RESCUER", "CACHE_UNIT", "OTHER"]),
  manufacturer: z.string().optional(),
  expiryDate: z.coerce.date().optional().nullable(),
  issuedDate: z.coerce.date().optional().nullable(),
  issuedToName: z.string().optional(),
  storageLocation: z.string().optional(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  status: z.enum(["ISSUED", "IN_STORE", "EXPIRED", "WITHDRAWN", "DEPLOYED"]).optional(),
  notes: z.string().optional(),
});

const routeSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
  routeLengthM: z.number().nonnegative().optional().nullable(),
  isSecondOutlet: z.boolean().optional(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  lastWalkedDate: z.coerce.date().optional().nullable(),
  condition: z.enum(["CLEAR", "OBSTRUCTED", "IMPASSABLE", "UNDER_REPAIR"]).optional(),
  findings: z.string().optional(),
  notes: z.string().optional(),
});

const rescuerSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  serialNumber: true,
  rescuerType: true,
  manufacturer: true,
  expiryDate: true,
  issuedDate: true,
  issuedToName: true,
  storageLocation: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

const routeSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  identifier: true,
  fromLocation: true,
  toLocation: true,
  routeLengthM: true,
  isSecondOutlet: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  lastWalkedDate: true,
  condition: true,
  findings: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

// --- Self-rescuer units -----------------------------------------------------

router.get("/self-rescuers", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const units = await prisma.selfRescuerUnit.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: rescuerSelect,
    orderBy: { serialNumber: "asc" },
    take: 1000,
  });
  res.json(units);
});

/**
 * A unit past its expiry date is marked EXPIRED on write regardless of what was
 * submitted. An expired self-rescuer is not equipment with a stale field — it is
 * a unit that must not be carried underground, and the register should say so
 * without waiting for someone to notice.
 */
function statusForExpiry(expiryDate: Date | null | undefined, submitted: string | undefined, current?: string) {
  const fallback = submitted ?? current ?? "IN_STORE";
  if (fallback === "WITHDRAWN" || fallback === "DEPLOYED") return fallback;
  if (expiryDate && expiryDate < new Date()) return "EXPIRED";
  return fallback === "EXPIRED" ? "IN_STORE" : fallback;
}

router.post("/self-rescuers", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = rescuerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const status = statusForExpiry(parsed.data.expiryDate, parsed.data.status) as any;
  const unit = await prisma.selfRescuerUnit.create({ data: { ...parsed.data, status }, select: rescuerSelect });
  res.status(201).json(unit);
});

router.put("/self-rescuers/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = rescuerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.selfRescuerUnit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Self-rescuer not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const expiry = parsed.data.expiryDate !== undefined ? parsed.data.expiryDate : existing.expiryDate;
  const status = statusForExpiry(expiry, parsed.data.status, existing.status) as any;
  const unit = await prisma.selfRescuerUnit.update({
    where: { id: existing.id },
    data: { ...parsed.data, status },
    select: rescuerSelect,
  });
  res.json(unit);
});

router.delete("/self-rescuers/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.selfRescuerUnit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Self-rescuer not found" });
  await prisma.selfRescuerUnit.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Escape routes ------------------------------------------------------------

router.get("/routes", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const routes = await prisma.escapeRoute.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: routeSelect,
    orderBy: [{ isSecondOutlet: "desc" }, { identifier: "asc" }],
  });
  res.json(routes);
});

router.post("/routes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const route = await prisma.escapeRoute.create({ data: parsed.data, select: routeSelect });
  res.status(201).json(route);
});

router.put("/routes/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = routeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.escapeRoute.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Escape route not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const route = await prisma.escapeRoute.update({ where: { id: existing.id }, data: parsed.data, select: routeSelect });
  res.json(route);
});

router.delete("/routes/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.escapeRoute.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Escape route not found" });
  await prisma.escapeRoute.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Readiness summary ---------------------------------------------------------

/**
 * Refuge bays, self-rescuers and escape routes are three registers but one
 * question: if the workings have to be evacuated tonight, does the chain hold.
 * The summary reads all three together because the chain is only as strong as
 * its weakest link, and each register on its own looks healthier than the whole.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const now = new Date();

  const [rescuers, routes, refugeBays] = await Promise.all([
    prisma.selfRescuerUnit.findMany({
      where: { site: { mineId } },
      select: { status: true, expiryDate: true, nextInspectionDue: true },
    }),
    prisma.escapeRoute.findMany({
      where: { site: { mineId } },
      select: { condition: true, isSecondOutlet: true, nextInspectionDue: true },
    }),
    prisma.refugeBay.findMany({
      where: { site: { mineId } },
      select: { status: true, nextInspectionDue: true, capacityPersons: true },
    }),
  ]);

  const inService = rescuers.filter((r) => r.status === "ISSUED" || r.status === "IN_STORE");
  const expired = rescuers.filter((r) => r.status === "EXPIRED" || (r.expiryDate != null && r.expiryDate < now)).length;
  // A unit inside 90 days of expiry still works, but it is procurement lead time
  // that decides whether it gets replaced in time.
  const expiringSoon = inService.filter(
    (r) => r.expiryDate != null && r.expiryDate >= now && r.expiryDate.getTime() - now.getTime() <= 90 * 86400000
  ).length;
  const rescuerInspectionOverdue = inService.filter((r) => !r.nextInspectionDue || r.nextInspectionDue < now).length;

  const routesBlocked = routes.filter((r) => r.condition === "OBSTRUCTED" || r.condition === "IMPASSABLE").length;
  const routeInspectionOverdue = routes.filter((r) => !r.nextInspectionDue || r.nextInspectionDue < now).length;
  const secondOutlets = routes.filter((r) => r.isSecondOutlet).length;

  const bayInspectionOverdue = refugeBays.filter((b) => !b.nextInspectionDue || b.nextInspectionDue < now).length;
  const baysNotOperational = refugeBays.filter((b) => b.status !== "OPERATIONAL").length;
  const shelterCapacity = refugeBays
    .filter((b) => b.status === "OPERATIONAL")
    .reduce((sum, b) => sum + b.capacityPersons, 0);

  res.json({
    selfRescuers: {
      total: rescuers.length,
      inService: inService.length,
      expired,
      expiringWithin90Days: expiringSoon,
      inspectionOverdue: rescuerInspectionOverdue,
    },
    escapeRoutes: {
      total: routes.length,
      secondOutlets,
      blocked: routesBlocked,
      inspectionOverdue: routeInspectionOverdue,
    },
    refugeBays: {
      total: refugeBays.length,
      notOperational: baysNotOperational,
      inspectionOverdue: bayInspectionOverdue,
      operationalShelterCapacity: shelterCapacity,
    },
    // The single number the ventilation officer is answerable for: anything in the
    // survivability chain that would fail tonight.
    readinessGaps: expired + routesBlocked + baysNotOperational,
  });
});

export default router;
