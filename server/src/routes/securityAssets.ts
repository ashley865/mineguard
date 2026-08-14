import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();
router.use(requireAuth);

const assetTypeEnum = z.enum([
  "RADIO",
  "BATON",
  "FIREARM",
  "ALARM_PANEL",
  "BARRIER",
  "METAL_DETECTOR",
  "BODY_CAMERA",
  "TORCH",
  "HANDCUFFS",
  "VEHICLE",
  "OTHER",
]);

const assetSchema = z.object({
  siteId: z.string().min(1),
  assetTag: z.string().min(1),
  type: assetTypeEnum,
  description: z.string().min(1),
  serialNumber: z.string().optional().nullable(),
  nextMaintenanceDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const assetSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  assetTag: true,
  type: true,
  description: true,
  serialNumber: true,
  condition: true,
  status: true,
  assignedWorker: { select: { id: true, name: true, employeeId: true } },
  lastMaintenanceAt: true,
  nextMaintenanceDue: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const assets = await prisma.securityAsset.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      status: (status as any) || undefined,
      type: (type as any) || undefined,
    },
    select: assetSelect,
    orderBy: { assetTag: "asc" },
  });
  res.json(assets);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const clash = await prisma.securityAsset.findUnique({
    where: { siteId_assetTag: { siteId: parsed.data.siteId, assetTag: parsed.data.assetTag } },
  });
  if (clash) return res.status(409).json({ error: "An asset with this tag already exists at this site" });
  const asset = await prisma.securityAsset.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: assetSelect,
  });
  res.status(201).json(asset);
});

const assetUpdateSchema = assetSchema.partial().extend({
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "OUT_OF_SERVICE"]).optional(),
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assetUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Asset not found" });
  const asset = await prisma.securityAsset.update({
    where: { id: existing.id },
    data: parsed.data,
    select: assetSelect,
  });
  res.json(asset);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Asset not found" });
  await prisma.securityAsset.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const assignSchema = z.object({
  workerId: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const maintenanceSchema = z.object({
  notes: z.string().optional().nullable(),
});

const logSelect = {
  id: true,
  assetId: true,
  eventType: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  notes: true,
  eventAt: true,
  loggedBy: { select: { id: true, name: true } },
} as const;

router.get("/:id/logs", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  const logs = await prisma.securityAssetAssignmentLog.findMany({
    where: { assetId: asset.id },
    select: logSelect,
    orderBy: { eventAt: "desc" },
  });
  res.json(logs);
});

router.post("/:id/assign", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.status !== "IN_STORE") return res.status(409).json({ error: "This asset is not available to assign" });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const [, log] = await prisma.$transaction([
    prisma.securityAsset.update({
      where: { id: asset.id },
      data: { status: "ASSIGNED", assignedWorkerId: worker.id },
    }),
    prisma.securityAssetAssignmentLog.create({
      data: {
        assetId: asset.id,
        eventType: "ASSIGNED",
        workerId: worker.id,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityAsset.findUnique({ where: { id: asset.id }, select: assetSelect });
  res.status(201).json({ asset: updated, log });
});

router.post("/:id/return", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = maintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.status !== "ASSIGNED") return res.status(409).json({ error: "This asset is not currently assigned" });

  const [, log] = await prisma.$transaction([
    prisma.securityAsset.update({
      where: { id: asset.id },
      data: { status: "IN_STORE", assignedWorkerId: null },
    }),
    prisma.securityAssetAssignmentLog.create({
      data: {
        assetId: asset.id,
        eventType: "RETURNED",
        workerId: asset.assignedWorkerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityAsset.findUnique({ where: { id: asset.id }, select: assetSelect });
  res.status(201).json({ asset: updated, log });
});

router.post("/:id/send-for-maintenance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = maintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.status === "DECOMMISSIONED") return res.status(409).json({ error: "This asset is decommissioned" });

  const [, log] = await prisma.$transaction([
    prisma.securityAsset.update({
      where: { id: asset.id },
      data: { status: "IN_MAINTENANCE" },
    }),
    prisma.securityAssetAssignmentLog.create({
      data: {
        assetId: asset.id,
        eventType: "SENT_FOR_MAINTENANCE",
        workerId: asset.assignedWorkerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityAsset.findUnique({ where: { id: asset.id }, select: assetSelect });
  res.status(201).json({ asset: updated, log });
});

const returnFromMaintenanceSchema = z.object({
  notes: z.string().optional().nullable(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "OUT_OF_SERVICE"]).optional(),
});

router.post("/:id/return-from-maintenance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = returnFromMaintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.status !== "IN_MAINTENANCE") return res.status(409).json({ error: "This asset is not in maintenance" });

  const [, log] = await prisma.$transaction([
    prisma.securityAsset.update({
      where: { id: asset.id },
      data: {
        status: "IN_STORE",
        lastMaintenanceAt: new Date(),
        condition: parsed.data.condition ?? undefined,
      },
    }),
    prisma.securityAssetAssignmentLog.create({
      data: {
        assetId: asset.id,
        eventType: "RETURNED_FROM_MAINTENANCE",
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityAsset.findUnique({ where: { id: asset.id }, select: assetSelect });
  res.status(201).json({ asset: updated, log });
});

router.post("/:id/decommission", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = maintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.securityAsset.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const [, log] = await prisma.$transaction([
    prisma.securityAsset.update({
      where: { id: asset.id },
      data: { status: "DECOMMISSIONED", assignedWorkerId: null },
    }),
    prisma.securityAssetAssignmentLog.create({
      data: {
        assetId: asset.id,
        eventType: "DECOMMISSIONED",
        workerId: asset.assignedWorkerId,
        notes: parsed.data.notes,
        loggedById: req.auth!.userId,
      },
      select: logSelect,
    }),
  ]);
  const updated = await prisma.securityAsset.findUnique({ where: { id: asset.id }, select: assetSelect });
  res.status(201).json({ asset: updated, log });
});

export default router;
