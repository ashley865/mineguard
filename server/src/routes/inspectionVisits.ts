import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const visitSchema = z.object({
  visitDate: z.coerce.date(),
  inspectorName: z.string().min(1),
  inspectorBadge: z.string().optional(),
  authority: z.string().min(1),
  areasInspected: z.string().min(1),
  purpose: z.string().optional(),
  findings: z.string().optional(),
  outcome: z.enum(["NO_ACTION", "VERBAL_WARNING", "NOTICE_ISSUED", "FOLLOW_UP_REQUIRED"]).optional(),
  siteId: z.string().min(1),
  relatedNoticeId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.inspectionVisit.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: {
      site: { select: { id: true, name: true } },
      relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
    },
    orderBy: { visitDate: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.inspectionVisit.create({
    data: parsed.data,
    include: {
      site: { select: { id: true, name: true } },
      relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
    },
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = visitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.inspectionVisit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Inspection visit not found" });
  const item = await prisma.inspectionVisit.update({
    where: { id: existing.id },
    data: parsed.data,
    include: {
      site: { select: { id: true, name: true } },
      relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
    },
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.inspectionVisit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Inspection visit not found" });
  await prisma.inspectionVisit.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
