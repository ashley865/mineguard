import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAssignedSiteIds } from "../services/executiveSites";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const assignmentSelect = {
  id: true,
  userId: true,
  siteId: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, title: true } },
  site: { select: { id: true, name: true } },
} as const;

router.use(requireAuth);

router.get("/mine", async (req, res) => {
  const siteIds = await getAssignedSiteIds(req.auth!.userId);
  res.json({ siteIds });
});

router.get("/executives", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const executives = await prisma.user.findMany({
    where: { role: "EXECUTIVE", mineId },
    select: { id: true, name: true, email: true, title: true },
    orderBy: { name: "asc" },
  });
  res.json(executives);
});

router.get("/", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const items = await prisma.executiveSiteAssignment.findMany({
    where: { site: { mineId } },
    select: assignmentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

const assignSchema = z.object({ userId: z.string().min(1), siteId: z.string().min(1) });

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findFirst({ where: { id: parsed.data.userId, mineId } });
  if (!user || user.role !== "EXECUTIVE") {
    return res.status(400).json({ error: "User must have the Executive role" });
  }
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  try {
    const item = await prisma.executiveSiteAssignment.create({
      data: parsed.data,
      select: assignmentSelect,
    });
    res.status(201).json(item);
  } catch {
    res.status(409).json({ error: "This executive is already assigned to that site" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.executiveSiteAssignment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Assignment not found" });
  await prisma.executiveSiteAssignment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
