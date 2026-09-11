import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const wasteStreamSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  wasteType: z.enum(["HAZARDOUS", "GENERAL", "RECYCLABLE"]),
  classificationCode: z.string().optional(),
  sourceActivity: z.string().optional(),
  storageLocation: z.string().optional(),
  storageCapacity: z.number().nonnegative().optional().nullable(),
  storageCapacityUnit: z.string().optional(),
  storageStartDate: z.coerce.date().optional().nullable(),
  storageLimitMonths: z.number().int().min(0).max(600).optional().nullable(),
  status: z.enum(["ACTIVE", "DECOMMISSIONED"]).optional(),
  notes: z.string().optional(),
});

const manifestSchema = z.object({
  manifestNumber: z.string().min(1),
  dispatchDate: z.coerce.date(),
  quantity: z.number().nonnegative(),
  quantityUnit: z.string().min(1),
  transporterName: z.string().optional(),
  transporterRegistrationNumber: z.string().optional(),
  disposalFacilityName: z.string().min(1),
  disposalFacilityLicenceNumber: z.string().optional(),
  disposalMethod: z.enum(["LANDFILL", "INCINERATION", "RECYCLING", "TREATMENT", "RECOVERY", "OTHER"]),
  receivedConfirmationDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const streamSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  wasteType: true,
  classificationCode: true,
  sourceActivity: true,
  storageLocation: true,
  storageCapacity: true,
  storageCapacityUnit: true,
  storageStartDate: true,
  storageLimitMonths: true,
  status: true,
  notes: true,
  manifests: {
    select: {
      id: true,
      manifestNumber: true,
      dispatchDate: true,
      quantity: true,
      quantityUnit: true,
      transporterName: true,
      transporterRegistrationNumber: true,
      disposalFacilityName: true,
      disposalFacilityLicenceNumber: true,
      disposalMethod: true,
      receivedConfirmationDate: true,
      notes: true,
    },
    orderBy: { dispatchDate: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/streams", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const streams = await prisma.wasteStream.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: streamSelect,
    orderBy: { name: "asc" },
  });
  res.json(streams);
});

router.post("/streams", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = wasteStreamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const stream = await prisma.wasteStream.create({ data: parsed.data, select: streamSelect });
  res.status(201).json(stream);
});

router.put("/streams/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = wasteStreamSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.wasteStream.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Waste stream not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const stream = await prisma.wasteStream.update({ where: { id: existing.id }, data: parsed.data, select: streamSelect });
  res.json(stream);
});

router.delete("/streams/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.wasteStream.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Waste stream not found" });
  await prisma.wasteStream.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/streams/:id/manifests", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const stream = await prisma.wasteStream.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!stream) return res.status(404).json({ error: "Waste stream not found" });
  const manifests = await prisma.wasteManifest.findMany({ where: { wasteStreamId: stream.id }, orderBy: { dispatchDate: "desc" } });
  res.json(manifests);
});

/**
 * Dispatching a manifest resets the stream's storageStartDate to the dispatch
 * date — the 23-month hazardous-waste accumulation ceiling is measured from the
 * last time the stockpile was actually cleared, not from when the record was
 * created, so recording a dispatch has to roll that date forward automatically.
 */
router.post("/streams/:id/manifests", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = manifestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const stream = await prisma.wasteStream.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!stream) return res.status(404).json({ error: "Waste stream not found" });

  const d = parsed.data;
  const manifest = await prisma.wasteManifest.create({ data: { ...d, wasteStreamId: stream.id } });
  if (!stream.storageStartDate || d.dispatchDate > stream.storageStartDate) {
    await prisma.wasteStream.update({ where: { id: stream.id }, data: { storageStartDate: d.dispatchDate } });
  }
  res.status(201).json(manifest);
});

router.delete("/manifests/:manifestId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.wasteManifest.findFirst({
    where: { id: req.params.manifestId, wasteStream: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Manifest not found" });
  await prisma.wasteManifest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
