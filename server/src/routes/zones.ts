import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const zoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  siteId: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const zones = await prisma.zone.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { sensors: true, site: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(zones);
});

router.get("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const zone = await prisma.zone.findFirst({
    where: { id: req.params.id, site: { mineId } },
    include: { sensors: true, workers: true, equipment: true },
  });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  res.json(zone);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const zone = await prisma.zone.create({ data: parsed.data });
  res.status(201).json(zone);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = zoneSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.zone.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Zone not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const zone = await prisma.zone.update({ where: { id: existing.id }, data: parsed.data });
  res.json(zone);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.zone.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Zone not found" });
  await prisma.zone.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
