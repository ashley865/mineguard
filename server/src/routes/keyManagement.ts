import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();
router.use(requireAuth);

const keySchema = z.object({
  siteId: z.string().min(1),
  keyCode: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional().nullable(),
});

const keySelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  keyCode: true,
  description: true,
  location: true,
  status: true,
  currentHolderName: true,
  currentWorker: { select: { id: true, name: true, employeeId: true } },
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const keys = await prisma.securityKey.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: keySelect,
    orderBy: { keyCode: "asc" },
  });
  res.json(keys);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const clash = await prisma.securityKey.findUnique({
    where: { siteId_keyCode: { siteId: parsed.data.siteId, keyCode: parsed.data.keyCode } },
  });
  if (clash) return res.status(409).json({ error: "A key with this code already exists at this site" });
  const key = await prisma.securityKey.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: keySelect,
  });
  res.status(201).json(key);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = keySchema.partial().extend({ status: z.enum(["AVAILABLE", "ISSUED", "LOST", "RETIRED"]).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Key not found" });
  const key = await prisma.securityKey.update({
    where: { id: existing.id },
    data: parsed.data,
    select: keySelect,
  });
  res.json(key);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Key not found" });
  await prisma.securityKey.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const issueSchema = z.object({
  holderName: z.string().optional().nullable(),
  workerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const returnSchema = z.object({
  notes: z.string().optional().nullable(),
});

const lostSchema = z.object({
  notes: z.string().optional().nullable(),
});

const logSelect = {
  id: true,
  keyId: true,
  eventType: true,
  holderName: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  notes: true,
  eventAt: true,
  loggedBy: { select: { id: true, name: true } },
} as const;

router.get("/:id/logs", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const key = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!key) return res.status(404).json({ error: "Key not found" });
  const logs = await prisma.keyIssueLog.findMany({
    where: { keyId: key.id },
    select: logSelect,
    orderBy: { eventAt: "desc" },
  });
  res.json(logs);
});

router.post("/:id/issue", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!parsed.data.holderName && !parsed.data.workerId) {
    return res.status(400).json({ error: "Either holderName or workerId is required" });
  }
  const key = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!key) return res.status(404).json({ error: "Key not found" });
  if (key.status === "ISSUED") return res.status(409).json({ error: "This key is already issued" });
  if (parsed.data.workerId) {
    const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
    if (!worker) return res.status(404).json({ error: "Worker not found" });
  }

  const [, log] = await prisma.$transaction([
    prisma.securityKey.update({
      where: { id: key.id },
      data: { status: "ISSUED", currentHolderName: parsed.data.holderName ?? null, currentWorkerId: parsed.data.workerId ?? null },
    }),
    prisma.keyIssueLog.create({
      data: {
        keyId: key.id,
        eventType: "ISSUED",
        holderName: parsed.data.holderName,
        workerId: parsed.data.workerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityKey.findUnique({ where: { id: key.id }, select: keySelect });
  res.status(201).json({ key: updated, log });
});

router.post("/:id/return", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const key = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!key) return res.status(404).json({ error: "Key not found" });
  if (key.status !== "ISSUED") return res.status(409).json({ error: "This key is not currently issued" });

  const [, log] = await prisma.$transaction([
    prisma.securityKey.update({
      where: { id: key.id },
      data: { status: "AVAILABLE", currentHolderName: null, currentWorkerId: null },
    }),
    prisma.keyIssueLog.create({
      data: {
        keyId: key.id,
        eventType: "RETURNED",
        holderName: key.currentHolderName,
        workerId: key.currentWorkerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityKey.findUnique({ where: { id: key.id }, select: keySelect });
  res.status(201).json({ key: updated, log });
});

router.post("/:id/report-lost", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = lostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const key = await prisma.securityKey.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!key) return res.status(404).json({ error: "Key not found" });

  const [, log] = await prisma.$transaction([
    prisma.securityKey.update({
      where: { id: key.id },
      data: { status: "LOST" },
    }),
    prisma.keyIssueLog.create({
      data: {
        keyId: key.id,
        eventType: "REPORTED_LOST",
        holderName: key.currentHolderName,
        workerId: key.currentWorkerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityKey.findUnique({ where: { id: key.id }, select: keySelect });
  res.status(201).json({ key: updated, log });
});

export default router;
