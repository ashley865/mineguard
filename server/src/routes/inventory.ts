import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const itemSchema = z.object({
  siteId: z.string().min(1),
  partNumber: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  quantityOnHand: z.coerce.number().optional(),
  reorderPoint: z.coerce.number().optional().nullable(),
  unit: z.string().min(1),
  unitCost: z.coerce.number().optional().nullable(),
  supplier: z.string().optional(),
  location: z.string().optional(),
});

const movementSchema = z.object({
  itemId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive(),
  reason: z.string().optional(),
});

const itemSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  partNumber: true,
  name: true,
  category: true,
  quantityOnHand: true,
  reorderPoint: true,
  unit: true,
  unitCost: true,
  supplier: true,
  location: true,
  createdAt: true,
} as const;

const movementSelect = {
  id: true,
  itemId: true,
  item: { select: { id: true, name: true, unit: true } },
  direction: true,
  quantity: true,
  reason: true,
  performedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/items", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const lowStock = req.query.lowStock === "true";
  const items = await prisma.inventoryItem.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: itemSelect,
    orderBy: { name: "asc" },
  });
  const filtered = lowStock ? items.filter((i) => i.reorderPoint != null && i.quantityOnHand <= i.reorderPoint) : items;
  res.json(filtered);
});

router.post("/items", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.inventoryItem.create({ data: parsed.data, select: itemSelect });
  res.status(201).json(item);
});

router.put("/items/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.inventoryItem.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Inventory item not found" });
  const item = await prisma.inventoryItem.update({ where: { id: existing.id }, data: parsed.data, select: itemSelect });
  res.json(item);
});

router.delete("/items/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.inventoryItem.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Inventory item not found" });
  await prisma.inventoryItem.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/movements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const itemId = req.query.itemId as string | undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: { item: { site: { mineId } }, itemId: itemId || undefined },
    select: movementSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(movements);
});

router.post("/movements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.inventoryItem.findFirst({ where: { id: parsed.data.itemId, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Inventory item not found" });
  if (parsed.data.direction === "OUT" && item.quantityOnHand < parsed.data.quantity) {
    return res.status(409).json({ error: "Not enough stock on hand for this movement" });
  }

  const delta = parsed.data.direction === "IN" ? parsed.data.quantity : -parsed.data.quantity;
  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: { ...parsed.data, performedById: req.auth!.userId },
      select: movementSelect,
    }),
    prisma.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { increment: delta } } }),
  ]);
  res.status(201).json(movement);
});

export default router;
