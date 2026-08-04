import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const contactSchema = z.object({
  siteId: z.string().optional().nullable(),
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().min(1),
  category: z.enum(["MINE_RESCUE", "MEDICAL", "FIRE", "POLICE", "INTERNAL_MANAGEMENT", "OTHER"]).optional(),
  priority: z.coerce.number().optional(),
});

const drillSchema = z.object({
  siteId: z.string().min(1),
  drillDate: z.coerce.date(),
  drillType: z.enum(["FIRE", "GAS_LEAK", "SEISMIC", "GENERAL"]),
  totalParticipants: z.coerce.number().int().optional().nullable(),
  musterTimeSeconds: z.coerce.number().int().optional().nullable(),
  issuesIdentified: z.string().optional(),
});

const contactSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  role: true,
  phone: true,
  category: true,
  priority: true,
  createdAt: true,
} as const;

const drillSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  drillDate: true,
  drillType: true,
  totalParticipants: true,
  musterTimeSeconds: true,
  issuesIdentified: true,
  conductedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/contacts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const contacts = await prisma.emergencyContact.findMany({
    where: { mineId, ...(siteId ? { OR: [{ siteId }, { siteId: null }] } : {}) },
    select: contactSelect,
    orderBy: { priority: "asc" },
  });
  res.json(contacts);
});

router.post("/contacts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const contact = await prisma.emergencyContact.create({ data: { ...parsed.data, mineId }, select: contactSelect });
  res.status(201).json(contact);
});

router.put("/contacts/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.emergencyContact.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Emergency contact not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const contact = await prisma.emergencyContact.update({ where: { id: existing.id }, data: parsed.data, select: contactSelect });
  res.json(contact);
});

router.delete("/contacts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.emergencyContact.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Emergency contact not found" });
  await prisma.emergencyContact.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/drills", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const drills = await prisma.evacuationDrill.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: drillSelect,
    orderBy: { drillDate: "desc" },
  });
  res.json(drills);
});

router.post("/drills", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const drill = await prisma.evacuationDrill.create({
    data: { ...parsed.data, conductedById: req.auth!.userId },
    select: drillSelect,
  });
  res.status(201).json(drill);
});

router.put("/drills/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = drillSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.evacuationDrill.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Evacuation drill not found" });
  const drill = await prisma.evacuationDrill.update({ where: { id: existing.id }, data: parsed.data, select: drillSelect });
  res.json(drill);
});

router.delete("/drills/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.evacuationDrill.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Evacuation drill not found" });
  await prisma.evacuationDrill.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
