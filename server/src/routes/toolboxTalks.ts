import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const talkSchema = z.object({
  siteId: z.string().min(1),
  talkDate: z.coerce.date(),
  topic: z.string().min(1),
  presenter: z.string().min(1),
  attendeeCount: z.coerce.number().int().nonnegative(),
  notes: z.string().optional(),
});

const talkSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  talkDate: true,
  topic: true,
  presenter: true,
  attendeeCount: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const talks = await prisma.toolboxTalk.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: talkSelect,
    orderBy: { talkDate: "desc" },
    take: 200,
  });
  res.json(talks);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = talkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const talk = await prisma.toolboxTalk.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: talkSelect,
  });
  res.status(201).json(talk);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.toolboxTalk.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Toolbox talk not found" });
  await prisma.toolboxTalk.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
