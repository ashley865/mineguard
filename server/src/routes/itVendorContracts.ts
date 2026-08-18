import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const vendorSchema = z.object({
  vendorName: z.string().min(1),
  serviceDescription: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  annualCost: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
  startDate: z.coerce.date().optional().nullable(),
  renewalDate: z.coerce.date().optional().nullable(),
  ownerName: z.string().optional(),
  notes: z.string().optional(),
});

const vendorSelect = {
  id: true,
  vendorName: true,
  serviceDescription: true,
  contactName: true,
  contactEmail: true,
  annualCost: true,
  currency: true,
  status: true,
  startDate: true,
  renewalDate: true,
  ownerName: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const vendors = await prisma.iTVendorContract.findMany({
    where: { mineId },
    select: vendorSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(vendors);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await prisma.iTVendorContract.create({
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined, mineId, createdById: req.auth!.userId },
    select: vendorSelect,
  });
  res.status(201).json(vendor);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = vendorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTVendorContract.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vendor contract not found" });
  const vendor = await prisma.iTVendorContract.update({
    where: { id: existing.id },
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined },
    select: vendorSelect,
  });
  res.json(vendor);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTVendorContract.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Vendor contract not found" });
  await prisma.iTVendorContract.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
