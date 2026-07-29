import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const zoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  siteId: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const zones = await prisma.zone.findMany({
    where: siteId ? { siteId } : undefined,
    include: { sensors: true, site: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(zones);
});

router.get("/:id", async (req, res) => {
  const zone = await prisma.zone.findUnique({
    where: { id: req.params.id },
    include: { sensors: true, workers: true, equipment: true },
  });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  res.json(zone);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const zone = await prisma.zone.create({ data: parsed.data });
  res.status(201).json(zone);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = zoneSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(zone);
  } catch {
    res.status(404).json({ error: "Zone not found" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.zone.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Zone not found" });
  }
});

export default router;
