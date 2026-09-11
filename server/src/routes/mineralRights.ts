import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const rightTypes = ["PROSPECTING_RIGHT", "MINING_RIGHT", "MINING_PERMIT", "RECONNAISSANCE_PERMIT", "RETENTION_PERMIT"] as const;
const rightStatuses = ["ACTIVE", "RENEWAL_PENDING", "EXPIRED", "RELINQUISHED"] as const;

const mineralRightSchema = z.object({
  siteId: z.string().optional().nullable(),
  rightType: z.enum(rightTypes),
  rightReferenceNumber: z.string().min(1),
  mineralsScheduled: z.string().optional(),
  areaHectares: z.number().nonnegative().optional().nullable(),
  holderName: z.string().optional(),
  grantedDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  renewalApplicationDue: z.coerce.date().optional().nullable(),
  renewalLodgedDate: z.coerce.date().optional().nullable(),
  status: z.enum(rightStatuses).optional(),
  notes: z.string().optional(),
});

const mineralRightSelect = {
  id: true,
  mineId: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  rightType: true,
  rightReferenceNumber: true,
  mineralsScheduled: true,
  areaHectares: true,
  holderName: true,
  grantedDate: true,
  expiryDate: true,
  renewalApplicationDue: true,
  renewalLodgedDate: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const rights = await prisma.mineralRight.findMany({
    where: { mineId },
    select: mineralRightSelect,
    orderBy: { rightReferenceNumber: "asc" },
  });
  res.json(rights);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = mineralRightSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const right = await prisma.mineralRight.create({ data: { ...parsed.data, mineId }, select: mineralRightSelect });
  res.status(201).json(right);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = mineralRightSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.mineralRight.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Mineral right not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const right = await prisma.mineralRight.update({ where: { id: existing.id }, data: parsed.data, select: mineralRightSelect });
  res.json(right);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.mineralRight.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Mineral right not found" });
  await prisma.mineralRight.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
