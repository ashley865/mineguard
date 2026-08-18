import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";

const router = Router();

const networkAssetSchema = z.object({
  assetType: z.enum(["FIREWALL", "VPN_GATEWAY", "ROUTER_SWITCH", "IDS_IPS", "ROGUE_DEVICE", "OPEN_PORT", "SUSPICIOUS_CONNECTION"]),
  name: z.string().min(1),
  ipAddress: z.string().optional(),
  status: z.enum(["SECURE", "WARNING", "COMPROMISED", "UNKNOWN"]).optional(),
  description: z.string().optional(),
  detectedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const networkAssetSelect = {
  id: true,
  assetType: true,
  name: true,
  ipAddress: true,
  status: true,
  description: true,
  detectedAt: true,
  resolvedAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const assets = await prisma.cyberNetworkAsset.findMany({
    where: { mineId },
    select: networkAssetSelect,
    orderBy: { detectedAt: "desc" },
  });
  res.json(assets);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = networkAssetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.cyberNetworkAsset.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: networkAssetSelect,
  });
  res.status(201).json(asset);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = networkAssetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberNetworkAsset.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Network asset not found" });
  const asset = await prisma.cyberNetworkAsset.update({ where: { id: existing.id }, data: parsed.data, select: networkAssetSelect });
  res.json(asset);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberNetworkAsset.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Network asset not found" });
  await prisma.cyberNetworkAsset.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
