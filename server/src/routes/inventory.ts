import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const lowStock = req.query.lowStock === "true";
  const items = await prisma.inventoryItem.findMany({
    where: { siteId: siteId || undefined },
    select: itemSelect,
    orderBy: { name: "asc" },
  });
  const filtered = lowStock ? items.filter((i) => i.reorderPoint != null && i.quantityOnHand <= i.reorderPoint) : items;
  res.json(filtered);
});

router.post("/items", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.inventoryItem.create({ data: parsed.data, select: itemSelect });
  res.status(201).json(item);
});

router.put("/items/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: parsed.data, select: itemSelect });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Inventory item not found" });
  }
});

router.delete("/items/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Inventory item not found" });
  }
});

router.get("/movements", async (req, res) => {
  const itemId = req.query.itemId as string | undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: { itemId: itemId || undefined },
    select: movementSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(movements);
});

router.post("/movements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.inventoryItem.findUnique({ where: { id: parsed.data.itemId } });
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
