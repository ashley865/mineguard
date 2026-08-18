import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const licenseSchema = z.object({
  productName: z.string().min(1),
  vendor: z.string().optional(),
  seatsTotal: z.coerce.number().int().positive(),
  seatsUsed: z.coerce.number().int().min(0).optional(),
  cost: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL", "ONE_TIME", "OTHER"]).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
  purchaseDate: z.coerce.date().optional().nullable(),
  renewalDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const licenseSelect = {
  id: true,
  productName: true,
  vendor: true,
  seatsTotal: true,
  seatsUsed: true,
  cost: true,
  currency: true,
  billingCycle: true,
  status: true,
  purchaseDate: true,
  renewalDate: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const licenses = await prisma.iTSoftwareLicense.findMany({
    where: { mineId },
    select: licenseSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(licenses);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = licenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const license = await prisma.iTSoftwareLicense.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: licenseSelect,
  });
  res.status(201).json(license);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = licenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTSoftwareLicense.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Software license not found" });
  const license = await prisma.iTSoftwareLicense.update({ where: { id: existing.id }, data: parsed.data, select: licenseSelect });
  res.json(license);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTSoftwareLicense.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Software license not found" });
  await prisma.iTSoftwareLicense.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
