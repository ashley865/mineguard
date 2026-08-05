import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const siteSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["OPERATIONAL", "RESTRICTED", "SHUT_DOWN"]).optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const [sites, workers] = await Promise.all([
    prisma.site.findMany({
      where: { mineId },
      include: {
        zones: true,
        _count: { select: { workers: true, incidents: true, equipment: true, alerts: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.worker.findMany({ where: { site: { mineId } }, select: { siteId: true, zoneId: true, status: true } }),
  ]);

  const siteCounts = new Map<string, { present: number; total: number }>();
  const zoneCounts = new Map<string, { present: number; total: number }>();
  for (const w of workers) {
    const s = siteCounts.get(w.siteId) ?? { present: 0, total: 0 };
    s.total += 1;
    if (w.status === "ON_SHIFT") s.present += 1;
    siteCounts.set(w.siteId, s);
    if (w.zoneId) {
      const z = zoneCounts.get(w.zoneId) ?? { present: 0, total: 0 };
      z.total += 1;
      if (w.status === "ON_SHIFT") z.present += 1;
      zoneCounts.set(w.zoneId, z);
    }
  }

  res.json(
    sites.map((site) => ({
      ...site,
      workforcePresence: siteCounts.get(site.id) ?? { present: 0, total: 0 },
      zones: site.zones.map((zone) => ({
        ...zone,
        workforcePresence: zoneCounts.get(zone.id) ?? { present: 0, total: 0 },
      })),
    }))
  );
});

router.get("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const site = await prisma.site.findFirst({
    where: { id: req.params.id, mineId },
    include: { zones: { include: { sensors: true } }, workers: true, equipment: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = siteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(site);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = siteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.site.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Site not found" });
  const site = await prisma.site.update({ where: { id: existing.id }, data: parsed.data });
  res.json(site);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.site.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Site not found" });
  await prisma.site.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
