import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const projectSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  budget: z.coerce.number().optional().nullable(),
  spentToDate: z.coerce.number().optional().nullable(),
  currency: z.string().optional(),
  startDate: z.coerce.date().optional().nullable(),
  targetCompletionDate: z.coerce.date().optional().nullable(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]).optional(),
  beneficiaries: z.string().optional(),
  notes: z.string().optional(),
});

const engagementSchema = z.object({
  siteId: z.string().min(1),
  engagementType: z.enum(["PUBLIC_MEETING", "FOCUS_GROUP", "FORUM", "SITE_VISIT", "SURVEY", "OTHER"]),
  engagementDate: z.coerce.date(),
  location: z.string().optional(),
  attendeesCount: z.coerce.number().int().optional().nullable(),
  topicsDiscussed: z.string().optional(),
  outcomes: z.string().optional(),
});

const grievanceSchema = z.object({
  siteId: z.string().min(1),
  complainantName: z.string().min(1),
  complainantContact: z.string().optional(),
  description: z.string().min(1),
  dateRaised: z.coerce.date(),
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "RESOLVED", "ESCALATED", "WITHDRAWN"]).optional(),
  resolution: z.string().optional(),
});

const spendSchema = z.object({
  siteId: z.string().min(1),
  recordDate: z.coerce.date(),
  category: z.string().min(1),
  amount: z.coerce.number(),
  currency: z.string().optional(),
  supplierOrBeneficiary: z.string().optional(),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.get("/projects", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const projects = await prisma.communityProject.findMany({
    where: { site: { mineId } },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
});

router.post("/projects", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const project = await prisma.communityProject.create({ data: parsed.data });
  res.status(201).json(project);
});

router.put("/projects/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.communityProject.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Project not found" });
  const project = await prisma.communityProject.update({ where: { id: existing.id }, data: parsed.data });
  res.json(project);
});

router.delete("/projects/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.communityProject.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Project not found" });
  await prisma.communityProject.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/engagements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const engagements = await prisma.communityEngagement.findMany({
    where: { site: { mineId } },
    include: { site: { select: { id: true, name: true } }, facilitatedBy: { select: { id: true, name: true } } },
    orderBy: { engagementDate: "desc" },
  });
  res.json(engagements);
});

router.post("/engagements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = engagementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const engagement = await prisma.communityEngagement.create({ data: { ...parsed.data, facilitatedById: req.auth!.userId } });
  res.status(201).json(engagement);
});

router.delete("/engagements/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.communityEngagement.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Engagement not found" });
  await prisma.communityEngagement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/grievances", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const grievances = await prisma.communityGrievance.findMany({
    where: { site: { mineId } },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { dateRaised: "desc" },
  });
  res.json(grievances);
});

router.post("/grievances", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = grievanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const grievance = await prisma.communityGrievance.create({ data: parsed.data });
  res.status(201).json(grievance);
});

router.put("/grievances/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = grievanceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.communityGrievance.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Grievance not found" });
  const data = { ...parsed.data, resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : existing.resolvedAt };
  const grievance = await prisma.communityGrievance.update({ where: { id: existing.id }, data });
  res.json(grievance);
});

router.delete("/grievances/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.communityGrievance.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Grievance not found" });
  await prisma.communityGrievance.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/spend", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const records = await prisma.communitySpendRecord.findMany({
    where: { site: { mineId } },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { recordDate: "desc" },
  });
  res.json(records);
});

router.post("/spend", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = spendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const record = await prisma.communitySpendRecord.create({ data: parsed.data });
  res.status(201).json(record);
});

router.delete("/spend/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.communitySpendRecord.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Record not found" });
  await prisma.communitySpendRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
