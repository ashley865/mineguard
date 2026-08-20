import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { notifyExecutives } from "../lib/notify";
import { ORDER_AUDIENCE } from "./notifications";

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1),
  registrationNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  category: z.string().optional(),
  bbbeeLevel: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).optional(),
});

const lineSchema = z.object({
  itemDescription: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const orderSchema = z.object({
  siteId: z.string().min(1),
  supplierId: z.string().min(1),
  orderNumber: z.string().min(1),
  description: z.string().min(1),
  currency: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"]).optional(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

const supplierSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  category: true,
  bbbeeLevel: true,
  status: true,
  createdAt: true,
} as const;

const orderSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  supplierId: true,
  supplier: { select: { id: true, name: true } },
  orderNumber: true,
  description: true,
  totalAmount: true,
  currency: true,
  status: true,
  requestedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  approvedAt: true,
  orderDate: true,
  expectedDeliveryDate: true,
  lines: { select: { id: true, itemDescription: true, quantity: true, unitPrice: true, lineTotal: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/suppliers", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const status = req.query.status as string | undefined;
  const [suppliers, orderStats] = await Promise.all([
    prisma.supplier.findMany({
      where: { mineId, status: (status as any) || undefined },
      select: supplierSelect,
      orderBy: { name: "asc" },
    }),
    // Spend rollup per supplier — only orders that represent a real commitment (approved
    // onward), mirroring the same status set the balance sheet treats as a liability.
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: { site: { mineId }, status: { in: ["APPROVED", "ORDERED", "RECEIVED"] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);
  const statsBySupplier = new Map(orderStats.map((s) => [s.supplierId, s]));
  res.json(
    suppliers.map((s) => ({
      ...s,
      totalSpend: statsBySupplier.get(s.id)?._sum.totalAmount ?? 0,
      orderCount: statsBySupplier.get(s.id)?._count ?? 0,
    }))
  );
});

router.post("/suppliers", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const supplier = await prisma.supplier.create({
    data: { ...parsed.data, mineId, contactEmail: parsed.data.contactEmail || undefined },
    select: supplierSelect,
  });
  res.status(201).json(supplier);
});

router.put("/suppliers/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = supplierSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });
  const supplier = await prisma.supplier.update({
    where: { id: existing.id },
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined },
    select: supplierSelect,
  });
  res.json(supplier);
});

router.delete("/suppliers/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });
  await prisma.supplier.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/orders", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const orders = await prisma.purchaseOrder.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: orderSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

router.post("/orders", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, mineId } });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  const { lines, ...orderData } = parsed.data;
  const totalAmount = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const order = await prisma.purchaseOrder.create({
    data: {
      ...orderData,
      totalAmount,
      requestedById: req.auth!.userId,
      lines: { create: lines.map((l) => ({ ...l, lineTotal: l.quantity * l.unitPrice })) },
    },
    select: orderSelect,
  });

  if (order.status === "SUBMITTED") {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      titles: ORDER_AUDIENCE,
      type: "PURCHASE_ORDER_APPROVAL",
      title: `Purchase order needs approval — ${order.orderNumber}`,
      body: `${order.description} · R${order.totalAmount.toLocaleString()}`,
      link: "/approvals-inbox",
    });
  }

  res.status(201).json(order);
});

router.put("/orders/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = orderSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Purchase order not found" });
  const { lines, ...orderData } = parsed.data;
  const order = await prisma.purchaseOrder.update({
    where: { id: existing.id },
    data: {
      ...orderData,
      // Line items are a nested relation, not a scalar field — replacing the whole set
      // (and recomputing the total from it) is simpler and safer than diffing individual rows.
      ...(lines
        ? {
            totalAmount: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
            lines: { deleteMany: {}, create: lines.map((l) => ({ ...l, lineTotal: l.quantity * l.unitPrice })) },
          }
        : {}),
    },
    select: orderSelect,
  });

  if (existing.status !== "SUBMITTED" && order.status === "SUBMITTED") {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      titles: ORDER_AUDIENCE,
      type: "PURCHASE_ORDER_APPROVAL",
      title: `Purchase order needs approval — ${order.orderNumber}`,
      body: `${order.description} · R${order.totalAmount.toLocaleString()}`,
      link: "/approvals-inbox",
    });
  }

  res.json(order);
});

router.post("/orders/:id/approve", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Purchase order not found" });
  const order = await prisma.purchaseOrder.update({
    where: { id: existing.id },
    data: { status: "APPROVED", approvedById: req.auth!.userId, approvedAt: new Date() },
    select: orderSelect,
  });

  // Approving the order commits the mine to a real payment obligation to the supplier,
  // so — like every other cost source — it's routed through the same CFO-gated expense
  // review before it's considered paid. Guarded so re-approving never double-creates it.
  if (existing.status !== "APPROVED") {
    let payee = await prisma.payee.findFirst({ where: { supplierId: existing.supplierId, payeeType: "SUPPLIER" } });
    if (!payee) {
      payee = await prisma.payee.create({
        data: { mineId, payeeType: "SUPPLIER", name: order.supplier.name, supplierId: existing.supplierId },
      });
    }
    await prisma.expense.create({
      data: {
        siteId: existing.siteId,
        payeeId: payee.id,
        expenseNumber: `PO-${order.orderNumber}`,
        category: "EQUIPMENT_SUPPLIES",
        description: `Purchase Order ${order.orderNumber} — ${order.description}`,
        amount: existing.totalAmount,
        currency: existing.currency,
        purchaseOrderId: order.id,
        createdById: req.auth!.userId,
      },
    });
  }

  res.json(order);
});

router.delete("/orders/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Purchase order not found" });
  await prisma.purchaseOrder.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
