import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const requirementSchema = z.object({
  siteId: z.string().min(1),
  regulation: z.string().min(1),
  requirement: z.string().min(1),
  applicableOperation: z.string().min(1),
  responsibleDepartment: z.string().min(1),
  responsiblePersonId: z.string().optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "ONCE_OFF", "AD_HOC"]),
  evidenceRequired: z.string().min(1),
  dueDate: z.coerce.date(),
  status: z.enum(["PENDING", "COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "OVERDUE", "NOT_APPLICABLE"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  lastVerification: z.coerce.date().optional().nullable(),
  nextReview: z.coerce.date().optional().nullable(),
  relatedDocuments: z.string().optional().nullable(),
});

const requirementSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  regulation: true,
  requirement: true,
  applicableOperation: true,
  responsibleDepartment: true,
  responsiblePersonId: true,
  responsiblePerson: { select: { id: true, name: true } },
  frequency: true,
  evidenceRequired: true,
  dueDate: true,
  status: true,
  riskLevel: true,
  lastVerification: true,
  nextReview: true,
  relatedDocuments: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/responsible-people", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const people = await prisma.user.findMany({
    where: { mineId, role: { in: ["ADMIN", "SUPERVISOR", "EXECUTIVE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(people);
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await prisma.complianceRequirement.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: requirementSelect,
    orderBy: { dueDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = requirementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }
  const item = await prisma.complianceRequirement.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: requirementSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = requirementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.complianceRequirement.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Requirement not found" });
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }
  const item = await prisma.complianceRequirement.update({
    where: { id: existing.id },
    data: parsed.data,
    select: requirementSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.complianceRequirement.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Requirement not found" });
  await prisma.complianceRequirement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
