import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const downtimeSchema = z.object({
  siteId: z.string().min(1),
  category: z.enum([
    "EQUIPMENT_BREAKDOWN",
    "POWER_OUTAGE",
    "WEATHER",
    "SAFETY_STOPPAGE",
    "MATERIAL_SHORTAGE",
    "LABOUR_SHORTAGE",
    "PLANNED_MAINTENANCE",
    "OTHER",
  ]),
  description: z.string().min(1),
  affectedArea: z.string().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional().nullable(),
});

const downtimeSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  category: true,
  description: true,
  affectedArea: true,
  startedAt: true,
  endedAt: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const events = await prisma.downtimeEvent.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: downtimeSelect,
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  res.json(events);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = downtimeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const event = await prisma.downtimeEvent.create({
    data: parsed.data,
    select: downtimeSelect,
  });
  res.status(201).json(event);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = downtimeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.downtimeEvent.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Downtime event not found" });
  const event = await prisma.downtimeEvent.update({
    where: { id: existing.id },
    data: parsed.data,
    select: downtimeSelect,
  });
  res.json(event);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.downtimeEvent.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Downtime event not found" });
  await prisma.downtimeEvent.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
