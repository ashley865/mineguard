import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const inventoryCategoryEnum = z.enum([
  "SPARE_PARTS",
  "PPE",
  "FUEL",
  "LUBRICANTS",
  "CRITICAL_COMPONENT",
  "WAREHOUSE_STOCK",
  "OTHER",
]);

const itemSchema = z.object({
  siteId: z.string().min(1),
  partNumber: z.string().optional(),
  name: z.string().min(1),
  category: inventoryCategoryEnum.optional().nullable(),
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

// Cross-cutting overview for the Operations Manager dashboard: inventory levels by
// category, explosives magazine stock, purchase order pipeline, and supplier standing.
// Queries beyond InventoryItem are included here rather than split across procurement.ts
// / explosives.ts because this is a single read-only rollup, not a CRUD resource.
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const [items, magazines, orders, suppliers] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { site: { mineId } },
      select: {
        category: true,
        quantityOnHand: true,
        reorderPoint: true,
        unitCost: true,
        name: true,
        unit: true,
        site: { select: { name: true } },
      },
    }),
    prisma.explosivesMagazine.findMany({
      where: { site: { mineId } },
      select: { status: true, currentStock: true, capacity: true, licenseExpiry: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { site: { mineId } },
      select: { status: true, totalAmount: true },
    }),
    prisma.supplier.findMany({ where: { mineId }, select: { status: true } }),
  ]);

  const categoryTotals: Record<string, { itemCount: number; lowStockCount: number; totalValue: number }> = {};
  for (const cat of inventoryCategoryEnum.options) categoryTotals[cat] = { itemCount: 0, lowStockCount: 0, totalValue: 0 };
  let uncategorizedCount = 0;
  for (const item of items) {
    const bucket = item.category ? categoryTotals[item.category] : undefined;
    if (!bucket) {
      uncategorizedCount++;
      continue;
    }
    bucket.itemCount++;
    bucket.totalValue += (item.unitCost ?? 0) * item.quantityOnHand;
    if (item.reorderPoint != null && item.quantityOnHand <= item.reorderPoint) bucket.lowStockCount++;
  }

  const lowStockItems = items
    .filter((i) => i.reorderPoint != null && i.quantityOnHand <= i.reorderPoint)
    .map((i) => ({
      name: i.name,
      category: i.category,
      quantityOnHand: i.quantityOnHand,
      reorderPoint: i.reorderPoint,
      unit: i.unit,
      site: i.site?.name ?? null,
    }))
    .slice(0, 10);

  const explosivesByStatus: Record<string, number> = { ACTIVE: 0, SUSPENDED: 0, EXPIRED: 0 };
  let totalCurrentStock = 0;
  let totalCapacity = 0;
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  let expiringLicenses = 0;
  for (const m of magazines) {
    explosivesByStatus[m.status] = (explosivesByStatus[m.status] ?? 0) + 1;
    totalCurrentStock += m.currentStock;
    totalCapacity += m.capacity;
    if (m.licenseExpiry <= soon) expiringLicenses++;
  }

  const poStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"] as const;
  const poByStatus: Record<string, number> = {};
  for (const s of poStatuses) poByStatus[s] = 0;
  let openValue = 0;
  for (const o of orders) {
    poByStatus[o.status] = (poByStatus[o.status] ?? 0) + 1;
    if (o.status !== "RECEIVED" && o.status !== "CANCELLED") openValue += o.totalAmount;
  }

  const supplierStatuses = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;
  const supplierByStatus: Record<string, number> = {};
  for (const s of supplierStatuses) supplierByStatus[s] = 0;
  for (const s of suppliers) supplierByStatus[s.status] = (supplierByStatus[s.status] ?? 0) + 1;

  res.json({
    categories: inventoryCategoryEnum.options.map((cat) => ({ category: cat, ...categoryTotals[cat] })),
    uncategorizedCount,
    lowStockItems,
    explosives: {
      magazineCount: magazines.length,
      totalCurrentStock: round2(totalCurrentStock),
      totalCapacity: round2(totalCapacity),
      byStatus: explosivesByStatus,
      expiringLicenses,
    },
    purchaseOrders: {
      byStatus: poByStatus,
      openValue: round2(openValue),
      pendingApproval: poByStatus.SUBMITTED ?? 0,
    },
    suppliers: {
      total: suppliers.length,
      byStatus: supplierByStatus,
    },
  });
});

export default router;
