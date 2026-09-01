import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const policyTypeEnum = z.enum(["PROPERTY", "EQUIPMENT", "LIABILITY", "BUSINESS_INTERRUPTION", "MARINE_TRANSIT", "DIRECTORS_OFFICERS", "OTHER"]);
const policyStatusEnum = z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "PENDING_RENEWAL"]);
const claimStatusEnum = z.enum(["LODGED", "UNDER_ASSESSMENT", "APPROVED", "REJECTED", "SETTLED", "CLOSED"]);

const policySchema = z.object({
  policyNumber: z.string().min(1),
  insurer: z.string().min(1),
  policyType: policyTypeEnum,
  coverageAmount: z.coerce.number().min(0).optional().nullable(),
  premiumAmount: z.coerce.number().min(0).optional().nullable(),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  status: policyStatusEnum.optional(),
  notes: z.string().optional(),
});

const claimSchema = z.object({
  policyId: z.string().min(1),
  incidentId: z.string().optional().nullable(),
  claimNumber: z.string().optional(),
  dateOfLoss: z.coerce.date(),
  description: z.string().min(1),
  amountClaimed: z.coerce.number().min(0).optional().nullable(),
  amountSettled: z.coerce.number().min(0).optional().nullable(),
  status: claimStatusEnum.optional(),
  notes: z.string().optional(),
});

const policySelect = {
  id: true,
  policyNumber: true,
  insurer: true,
  policyType: true,
  coverageAmount: true,
  premiumAmount: true,
  startDate: true,
  expiryDate: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const claimSelect = {
  id: true,
  policyId: true,
  policy: { select: { id: true, policyNumber: true, insurer: true } },
  incidentId: true,
  incident: { select: { id: true, title: true } },
  claimNumber: true,
  dateOfLoss: true,
  description: true,
  amountClaimed: true,
  amountSettled: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

router.use(requireAuth);

router.get("/policies", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const policies = await prisma.insurancePolicy.findMany({
    where: { mineId },
    select: policySelect,
    orderBy: { expiryDate: "asc" },
  });
  res.json(policies);
});

router.post("/policies", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const policy = await prisma.insurancePolicy.create({ data: { ...parsed.data, mineId }, select: policySelect });
  res.status(201).json(policy);
});

router.put("/policies/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = policySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.insurancePolicy.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });
  const policy = await prisma.insurancePolicy.update({ where: { id: existing.id }, data: parsed.data, select: policySelect });
  res.json(policy);
});

router.delete("/policies/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.insurancePolicy.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });
  await prisma.insurancePolicy.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/claims", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const claims = await prisma.insuranceClaim.findMany({
    where: { mineId },
    select: claimSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(claims);
});

router.post("/claims", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const policy = await prisma.insurancePolicy.findFirst({ where: { id: parsed.data.policyId, mineId } });
  if (!policy) return res.status(404).json({ error: "Policy not found" });
  if (parsed.data.incidentId) {
    const incident = await prisma.incident.findFirst({ where: { id: parsed.data.incidentId, site: { mineId } } });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
  }
  const claim = await prisma.insuranceClaim.create({ data: { ...parsed.data, mineId }, select: claimSelect });
  res.status(201).json(claim);
});

router.put("/claims/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = claimSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.insuranceClaim.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Claim not found" });
  if (parsed.data.policyId) {
    const policy = await prisma.insurancePolicy.findFirst({ where: { id: parsed.data.policyId, mineId } });
    if (!policy) return res.status(404).json({ error: "Policy not found" });
  }
  if (parsed.data.incidentId) {
    const incident = await prisma.incident.findFirst({ where: { id: parsed.data.incidentId, site: { mineId } } });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
  }
  const claim = await prisma.insuranceClaim.update({ where: { id: existing.id }, data: parsed.data, select: claimSelect });
  res.json(claim);
});

router.delete("/claims/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.insuranceClaim.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Claim not found" });
  await prisma.insuranceClaim.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
