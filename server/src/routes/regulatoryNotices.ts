import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const noticeSchema = z.object({
  noticeNumber: z.string().min(1),
  section: z.enum(["SECTION_54", "SECTION_55", "SECTION_53", "OTHER"]),
  issuedBy: z.string().min(1),
  issuedDate: z.coerce.date(),
  description: z.string().min(1),
  complianceDeadline: z.coerce.date().optional().nullable(),
  status: z.enum(["OPEN", "COMPLIED", "WITHDRAWN", "APPEALED"]).optional(),
  compliedDate: z.coerce.date().optional().nullable(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.regulatoryNotice.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { issuedDate: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = noticeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.regulatoryNotice.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = noticeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.regulatoryNotice.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Notice not found" });
  const data: any = { ...parsed.data };
  if (parsed.data.status === "COMPLIED" && !data.compliedDate) data.compliedDate = new Date();
  const item = await prisma.regulatoryNotice.update({ where: { id: existing.id }, data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.regulatoryNotice.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Notice not found" });
  await prisma.regulatoryNotice.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
