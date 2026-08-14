import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();
router.use(requireAuth);

const gatePassTypeEnum = z.enum([
  "VISITOR",
  "CONTRACTOR",
  "EMPLOYEE_VEHICLE",
  "DELIVERY_VEHICLE",
  "EQUIPMENT_REMOVAL",
  "OTHER",
]);

const gatePassSchema = z.object({
  siteId: z.string().min(1),
  type: gatePassTypeEnum,
  holderName: z.string().min(1),
  company: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
  vehicleReg: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional().nullable(),
});

const gatePassSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  type: true,
  holderName: true,
  company: true,
  idNumber: true,
  vehicleReg: true,
  purpose: true,
  validFrom: true,
  validTo: true,
  status: true,
  revokedReason: true,
  issuedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/passes", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const passes = await prisma.gatePass.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: gatePassSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(passes);
});

router.post("/passes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = gatePassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const pass = await prisma.gatePass.create({
    data: { ...parsed.data, issuedById: req.auth!.userId },
    select: gatePassSelect,
  });
  res.status(201).json(pass);
});

const gatePassUpdateSchema = gatePassSchema.partial().extend({
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]).optional(),
  revokedReason: z.string().optional().nullable(),
});

router.put("/passes/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = gatePassUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.gatePass.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Gate pass not found" });
  const pass = await prisma.gatePass.update({
    where: { id: existing.id },
    data: parsed.data,
    select: gatePassSelect,
  });
  res.json(pass);
});

router.delete("/passes/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.gatePass.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Gate pass not found" });
  await prisma.gatePass.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const blacklistSchema = z.object({
  siteId: z.string().optional().nullable(),
  name: z.string().min(1),
  idNumber: z.string().optional().nullable(),
  vehicleReg: z.string().optional().nullable(),
  reason: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
});

const blacklistSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  idNumber: true,
  vehicleReg: true,
  reason: true,
  isActive: true,
  addedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/blacklist", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const entries = await prisma.securityBlacklistEntry.findMany({
    where: { OR: [{ site: { mineId } }, { siteId: null }] },
    select: blacklistSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(entries);
});

router.post("/blacklist", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = blacklistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const entry = await prisma.securityBlacklistEntry.create({
    data: { ...parsed.data, addedById: req.auth!.userId },
    select: blacklistSelect,
  });
  res.status(201).json(entry);
});

router.put("/blacklist/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = blacklistSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityBlacklistEntry.findFirst({
    where: { id: req.params.id, OR: [{ site: { mineId } }, { siteId: null }] },
  });
  if (!existing) return res.status(404).json({ error: "Blacklist entry not found" });
  const entry = await prisma.securityBlacklistEntry.update({
    where: { id: existing.id },
    data: parsed.data,
    select: blacklistSelect,
  });
  res.json(entry);
});

router.delete("/blacklist/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityBlacklistEntry.findFirst({
    where: { id: req.params.id, OR: [{ site: { mineId } }, { siteId: null }] },
  });
  if (!existing) return res.status(404).json({ error: "Blacklist entry not found" });
  await prisma.securityBlacklistEntry.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const gateLogSchema = z.object({
  siteId: z.string().min(1),
  gatePassId: z.string().optional().nullable(),
  direction: z.enum(["IN", "OUT"]),
  personName: z.string().min(1),
  company: z.string().optional().nullable(),
  vehicleReg: z.string().optional().nullable(),
  itemsCarried: z.string().optional().nullable(),
  gateName: z.string().optional().nullable(),
});

const gateLogSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  gatePassId: true,
  gatePass: { select: { id: true, holderName: true, type: true } },
  direction: true,
  personName: true,
  company: true,
  vehicleReg: true,
  itemsCarried: true,
  gateName: true,
  loggedAt: true,
  loggedBy: { select: { id: true, name: true } },
} as const;

router.get("/logs", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const logs = await prisma.gateLog.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: gateLogSelect,
    orderBy: { loggedAt: "desc" },
    take: 300,
  });
  res.json(logs);
});

// Checked against the blacklist at creation time (name/ID/vehicle reg, case-insensitive)
// so the guard is warned immediately — the log entry is still created either way, since
// blocking entirely at the API layer would take the actual gate decision out of the
// guard's hands based on a name match alone.
router.post("/logs", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = gateLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.gatePassId) {
    const pass = await prisma.gatePass.findFirst({ where: { id: parsed.data.gatePassId, siteId: parsed.data.siteId } });
    if (!pass) return res.status(404).json({ error: "Gate pass not found for this site" });
  }

  const blacklistMatch = await prisma.securityBlacklistEntry.findFirst({
    where: {
      isActive: true,
      OR: [{ site: { mineId } }, { siteId: null }],
      AND: {
        OR: [
          { name: { equals: parsed.data.personName, mode: "insensitive" } },
          ...(parsed.data.vehicleReg ? [{ vehicleReg: { equals: parsed.data.vehicleReg, mode: "insensitive" as const } }] : []),
        ],
      },
    },
    select: { id: true, name: true, reason: true },
  });

  const log = await prisma.gateLog.create({
    data: { ...parsed.data, loggedById: req.auth!.userId },
    select: gateLogSelect,
  });
  res.status(201).json({ ...log, blacklistWarning: blacklistMatch });
});

router.delete("/logs/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.gateLog.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Gate log entry not found" });
  await prisma.gateLog.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
