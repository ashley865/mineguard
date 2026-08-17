import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const assetSchema = z.object({
  assetTag: z.string().min(1),
  name: z.string().min(1),
  assetType: z.enum(["COMPUTER", "SERVER", "NETWORK_DEVICE", "MOBILE_DEVICE", "SOFTWARE_LICENSE", "PERIPHERAL", "OTHER"]).optional(),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]).optional(),
  assignedToName: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const assetSelect = {
  id: true,
  assetTag: true,
  name: true,
  assetType: true,
  status: true,
  assignedToName: true,
  location: true,
  purchaseDate: true,
  warrantyExpiry: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const assets = await prisma.iTAsset.findMany({
    where: { mineId },
    select: assetSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(assets);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.iTAsset.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: assetSelect,
  });
  res.status(201).json(asset);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTAsset.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "IT asset not found" });
  const asset = await prisma.iTAsset.update({ where: { id: existing.id }, data: parsed.data, select: assetSelect });
  res.json(asset);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTAsset.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "IT asset not found" });
  await prisma.iTAsset.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
