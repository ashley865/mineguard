import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAssignedSiteIds } from "../services/executiveSites";

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

router.get("/executives", requireRole("ADMIN"), async (_req, res) => {
  const executives = await prisma.user.findMany({
    where: { role: "EXECUTIVE" },
    select: { id: true, name: true, email: true, title: true },
    orderBy: { name: "asc" },
  });
  res.json(executives);
});

router.get("/", requireRole("ADMIN"), async (_req, res) => {
  const items = await prisma.executiveSiteAssignment.findMany({
    select: assignmentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

const assignSchema = z.object({ userId: z.string().min(1), siteId: z.string().min(1) });

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== "EXECUTIVE") {
    return res.status(400).json({ error: "User must have the Executive role" });
  }

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
  try {
    await prisma.executiveSiteAssignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Assignment not found" });
  }
});

export default router;
