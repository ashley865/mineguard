import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const policySchema = z.object({
  name: z.string().min(1),
  framework: z.string().optional(),
  status: z.enum(["COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "NOT_ASSESSED"]).optional(),
  ownerName: z.string().optional(),
  lastReviewedAt: z.coerce.date().optional().nullable(),
  nextReviewDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const findingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK"]).optional(),
  policyId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const policySelect = {
  id: true,
  name: true,
  framework: true,
  status: true,
  ownerName: true,
  lastReviewedAt: true,
  nextReviewDue: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const findingSelect = {
  id: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  policyId: true,
  policy: { select: { id: true, name: true } },
  dueDate: true,
  resolvedAt: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/policies", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const policies = await prisma.cyberCompliancePolicy.findMany({
    where: { mineId },
    select: policySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(policies);
});

router.post("/policies", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const policy = await prisma.cyberCompliancePolicy.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: policySelect,
  });
  res.status(201).json(policy);
});

router.put("/policies/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = policySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberCompliancePolicy.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });
  const policy = await prisma.cyberCompliancePolicy.update({ where: { id: existing.id }, data: parsed.data, select: policySelect });
  res.json(policy);
});

router.delete("/policies/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.cyberCompliancePolicy.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Policy not found" });
  await prisma.cyberCompliancePolicy.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/findings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const findings = await prisma.cyberAuditFinding.findMany({
    where: { mineId },
    select: findingSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(findings);
});

router.post("/findings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = findingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.policyId) {
    const policy = await prisma.cyberCompliancePolicy.findFirst({ where: { id: parsed.data.policyId, mineId } });
    if (!policy) return res.status(404).json({ error: "Policy not found" });
  }
  const finding = await prisma.cyberAuditFinding.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: findingSelect,
  });
  res.status(201).json(finding);
});

router.put("/findings/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = findingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberAuditFinding.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Finding not found" });
  const data = {
    ...parsed.data,
    resolvedAt: parsed.data.status === "RESOLVED" && !existing.resolvedAt ? new Date() : undefined,
  };
  const finding = await prisma.cyberAuditFinding.update({ where: { id: existing.id }, data, select: findingSelect });
  res.json(finding);
});

router.delete("/findings/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.cyberAuditFinding.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Finding not found" });
  await prisma.cyberAuditFinding.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
