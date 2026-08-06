import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const cameraSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  name: z.string().min(1),
  location: z.string().min(1),
  cameraType: z.enum(["FIXED", "PTZ", "DOME", "THERMAL", "BODY_WORN", "DRONE", "OTHER"]).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"]).optional(),
  coverageDescription: z.string().optional().nullable(),
  vmsProvider: z.string().optional().nullable(),
  integrationMethod: z.enum(["ONVIF", "RTSP_STREAM", "VENDOR_API", "NVR_EXPORT", "NOT_INTEGRATED"]).optional(),
  integrationStatus: z.enum(["CONNECTED", "DISCONNECTED", "PENDING", "NOT_APPLICABLE"]).optional(),
  streamUrl: z.string().optional().nullable(),
  retentionDays: z.coerce.number().int().positive().optional().nullable(),
  installedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const cameraSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  name: true,
  location: true,
  cameraType: true,
  status: true,
  coverageDescription: true,
  vmsProvider: true,
  integrationMethod: true,
  integrationStatus: true,
  streamUrl: true,
  retentionDays: true,
  installedDate: true,
  lastSyncAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await prisma.securityCamera.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: cameraSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = cameraSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: parsed.data.siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  const item = await prisma.securityCamera.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: cameraSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = cameraSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityCamera.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Camera not found" });
  const siteId = parsed.data.siteId ?? existing.siteId;
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  const item = await prisma.securityCamera.update({
    where: { id: existing.id },
    data: parsed.data,
    select: cameraSelect,
  });
  res.json(item);
});

// Manual heartbeat: records that MineGuard successfully reached the camera's VMS just
// now, for VMS-integrated cameras. There's no live external system to poll from this
// sandbox, so this stands in for what an automated integration poller would otherwise
// stamp on every successful sync.
router.post("/:id/sync", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityCamera.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Camera not found" });
  if (existing.integrationMethod === "NOT_INTEGRATED") {
    return res.status(409).json({ error: "This camera has no VMS integration configured" });
  }
  const item = await prisma.securityCamera.update({
    where: { id: existing.id },
    data: { integrationStatus: "CONNECTED", lastSyncAt: new Date() },
    select: cameraSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityCamera.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Camera not found" });
  await prisma.securityCamera.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
