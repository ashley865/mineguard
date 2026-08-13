import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const winderSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  shaftName: z.string().optional(),
  winderType: z.string().optional(),
  installedDate: z.coerce.date().optional().nullable(),
  status: z.string().optional(),
});

const inspectionSchema = z.object({
  winderId: z.string().min(1),
  inspectionDate: z.coerce.date(),
  inspector: z.string().min(1),
  brakeTestResult: z.enum(["PASS", "FAIL", "CONDITIONAL"]).optional(),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
});

const ropeSchema = z.object({
  winderId: z.string().min(1),
  ropeIdentifier: z.string().min(1),
  installedDate: z.coerce.date(),
  discardDate: z.coerce.date().optional().nullable(),
  lastTestDate: z.coerce.date().optional().nullable(),
  nextTestDue: z.coerce.date().optional().nullable(),
  status: z.enum(["IN_SERVICE", "DISCARDED", "PENDING_REPLACEMENT"]).optional(),
  notes: z.string().optional(),
});

const shaftInspectionSchema = z.object({
  siteId: z.string().min(1),
  shaftName: z.string().min(1),
  inspectionDate: z.coerce.date(),
  inspector: z.string().min(1),
  headgearCondition: z.string().optional(),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
});

const winderSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  shaftName: true,
  winderType: true,
  installedDate: true,
  status: true,
  inspections: { select: { id: true, inspectionDate: true, inspector: true, brakeTestResult: true, nextInspectionDue: true }, orderBy: { inspectionDate: "desc" as const }, take: 5 },
  ropes: { select: { id: true, ropeIdentifier: true, discardDate: true, nextTestDue: true, status: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const winders = await prisma.winder.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: winderSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(winders);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = winderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const winder = await prisma.winder.create({ data: parsed.data, select: winderSelect });
  res.status(201).json(winder);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = winderSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.winder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Winder not found" });
  const winder = await prisma.winder.update({ where: { id: existing.id }, data: parsed.data, select: winderSelect });
  res.json(winder);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.winder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Winder not found" });
  await prisma.winder.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/:id/inspections", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const winder = await prisma.winder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!winder) return res.status(404).json({ error: "Winder not found" });
  const inspections = await prisma.winderInspection.findMany({ where: { winderId: winder.id }, orderBy: { inspectionDate: "desc" } });
  res.json(inspections);
});

router.post("/:id/inspections", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = inspectionSchema.omit({ winderId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const winder = await prisma.winder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!winder) return res.status(404).json({ error: "Winder not found" });
  const inspection = await prisma.winderInspection.create({ data: { ...parsed.data, winderId: winder.id } });
  res.status(201).json(inspection);
});

router.post("/:id/ropes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ropeSchema.omit({ winderId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const winder = await prisma.winder.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!winder) return res.status(404).json({ error: "Winder not found" });
  const rope = await prisma.conveyanceRope.create({ data: { ...parsed.data, winderId: winder.id } });
  res.status(201).json(rope);
});

router.put("/ropes/:ropeId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ropeSchema.partial().omit({ winderId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.conveyanceRope.findFirst({ where: { id: req.params.ropeId, winder: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Rope not found" });
  const rope = await prisma.conveyanceRope.update({ where: { id: existing.id }, data: parsed.data });
  res.json(rope);
});

router.get("/shaft-inspections", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const inspections = await prisma.shaftInspection.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { inspectionDate: "desc" },
  });
  res.json(inspections);
});

router.post("/shaft-inspections", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = shaftInspectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const inspection = await prisma.shaftInspection.create({ data: parsed.data });
  res.status(201).json(inspection);
});

router.delete("/shaft-inspections/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.shaftInspection.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Shaft inspection not found" });
  await prisma.shaftInspection.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
