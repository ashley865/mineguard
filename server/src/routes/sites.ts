import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const siteSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["OPERATIONAL", "RESTRICTED", "SHUT_DOWN"]).optional(),
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const sites = await prisma.site.findMany({
    include: {
      zones: true,
      _count: { select: { workers: true, incidents: true, equipment: true, alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(sites);
});

router.get("/:id", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.id },
    include: { zones: { include: { sensors: true } }, workers: true, equipment: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = siteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.create({ data: parsed.data });
  res.status(201).json(site);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = siteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const site = await prisma.site.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(site);
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.site.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

export default router;
