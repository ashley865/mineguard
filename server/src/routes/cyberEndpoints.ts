import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";

const router = Router();

const endpointSchema = z.object({
  hostname: z.string().min(1),
  deviceType: z.enum(["COMPUTER", "SERVER", "MOBILE", "IOT", "OT_EQUIPMENT"]).optional(),
  ownerName: z.string().optional(),
  operatingSystem: z.string().optional(),
  avEdrStatus: z.enum(["PROTECTED", "OUTDATED", "MISSING", "DISABLED"]).optional(),
  avEdrProduct: z.string().optional(),
  patchStatus: z.enum(["UP_TO_DATE", "PENDING", "OVERDUE", "UNKNOWN"]).optional(),
  lastPatchedAt: z.coerce.date().optional().nullable(),
  encryptionStatus: z.enum(["ENCRYPTED", "NOT_ENCRYPTED", "UNKNOWN"]).optional(),
  isCompromised: z.coerce.boolean().optional(),
  lastSeenAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const endpointSelect = {
  id: true,
  hostname: true,
  deviceType: true,
  ownerName: true,
  operatingSystem: true,
  avEdrStatus: true,
  avEdrProduct: true,
  patchStatus: true,
  lastPatchedAt: true,
  encryptionStatus: true,
  isCompromised: true,
  lastSeenAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const endpoints = await prisma.cyberEndpoint.findMany({
    where: { mineId },
    select: endpointSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(endpoints);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = endpointSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const endpoint = await prisma.cyberEndpoint.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: endpointSelect,
  });
  res.status(201).json(endpoint);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = endpointSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberEndpoint.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Endpoint not found" });
  const endpoint = await prisma.cyberEndpoint.update({ where: { id: existing.id }, data: parsed.data, select: endpointSelect });
  res.json(endpoint);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberEndpoint.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Endpoint not found" });
  await prisma.cyberEndpoint.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
