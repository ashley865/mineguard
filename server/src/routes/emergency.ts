import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const contacts = await prisma.emergencyContact.findMany({
    where: siteId ? { OR: [{ siteId }, { siteId: null }] } : undefined,
    select: contactSelect,
    orderBy: { priority: "asc" },
  });
  res.json(contacts);
});

router.post("/contacts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const contact = await prisma.emergencyContact.create({ data: parsed.data, select: contactSelect });
  res.status(201).json(contact);
});

router.put("/contacts/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const contact = await prisma.emergencyContact.update({ where: { id: req.params.id }, data: parsed.data, select: contactSelect });
    res.json(contact);
  } catch {
    res.status(404).json({ error: "Emergency contact not found" });
  }
});

router.delete("/contacts/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.emergencyContact.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Emergency contact not found" });
  }
});

router.get("/drills", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const drills = await prisma.evacuationDrill.findMany({
    where: { siteId: siteId || undefined },
    select: drillSelect,
    orderBy: { drillDate: "desc" },
  });
  res.json(drills);
});

router.post("/drills", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = drillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const drill = await prisma.evacuationDrill.create({
    data: { ...parsed.data, conductedById: req.auth!.userId },
    select: drillSelect,
  });
  res.status(201).json(drill);
});

router.put("/drills/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = drillSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const drill = await prisma.evacuationDrill.update({ where: { id: req.params.id }, data: parsed.data, select: drillSelect });
    res.json(drill);
  } catch {
    res.status(404).json({ error: "Evacuation drill not found" });
  }
});

router.delete("/drills/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.evacuationDrill.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Evacuation drill not found" });
  }
});

export default router;
