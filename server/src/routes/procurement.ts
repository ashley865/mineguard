import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const status = req.query.status as string | undefined;
  const suppliers = await prisma.supplier.findMany({
    where: { status: (status as any) || undefined },
    select: supplierSelect,
    orderBy: { name: "asc" },
  });
  res.json(suppliers);
});

router.post("/suppliers", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const supplier = await prisma.supplier.create({
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined },
    select: supplierSelect,
  });
  res.status(201).json(supplier);
});

router.put("/suppliers/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = supplierSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined },
      select: supplierSelect,
    });
    res.json(supplier);
  } catch {
    res.status(404).json({ error: "Supplier not found" });
  }
});

router.delete("/suppliers/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Supplier not found" });
  }
});

router.get("/orders", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const orders = await prisma.purchaseOrder.findMany({
    where: { siteId: siteId || undefined, status: (status as any) || undefined },
    select: orderSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

router.post("/orders", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
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
  res.status(201).json(order);
});

router.put("/orders/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = orderSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { lines, ...orderData } = parsed.data;
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: orderData,
      select: orderSelect,
    });
    res.json(order);
  } catch {
    res.status(404).json({ error: "Purchase order not found" });
  }
});

router.post("/orders/:id/approve", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: "APPROVED", approvedById: req.auth!.userId, approvedAt: new Date() },
      select: orderSelect,
    });
    res.json(order);
  } catch {
    res.status(404).json({ error: "Purchase order not found" });
  }
});

router.delete("/orders/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Purchase order not found" });
  }
});

export default router;
