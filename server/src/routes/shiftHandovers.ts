import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const handoverSchema = z.object({
  siteId: z.string().min(1),
  shiftDate: z.coerce.date(),
  shift: z.enum(["DAY", "AFTERNOON", "NIGHT"]),
  outgoingSupervisor: z.string().min(1),
  summary: z.string().min(1),
  issues: z.string().optional(),
  actionItems: z.string().optional(),
});

const handoverSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  shiftDate: true,
  shift: true,
  outgoingSupervisor: true,
  summary: true,
  issues: true,
  actionItems: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const handovers = await prisma.shiftHandover.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: handoverSelect,
    orderBy: { shiftDate: "desc" },
    take: 200,
  });
  res.json(handovers);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = handoverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const handover = await prisma.shiftHandover.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: handoverSelect,
  });
  res.status(201).json(handover);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.shiftHandover.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Shift handover not found" });
  await prisma.shiftHandover.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
