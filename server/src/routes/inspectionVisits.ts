import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.inspectionVisit.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
    },
    orderBy: { visitDate: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.inspectionVisit.create({
    data: parsed.data,
    include: {
      site: { select: { id: true, name: true } },
      relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
    },
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = visitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.inspectionVisit.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        site: { select: { id: true, name: true } },
        relatedNotice: { select: { id: true, noticeNumber: true, section: true } },
      },
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Inspection visit not found" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.inspectionVisit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Inspection visit not found" });
  }
});

export default router;
