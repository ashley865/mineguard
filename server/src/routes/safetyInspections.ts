import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const inspectionSchema = z.object({
  title: z.string().min(1),
  inspectionType: z.string().min(1),
  scheduledDate: z.coerce.date(),
  completedDate: z.coerce.date().optional().nullable(),
  inspector: z.string().min(1),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "OVERDUE"]).optional(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.safetyInspection.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = inspectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.safetyInspection.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = inspectionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (parsed.data.status === "COMPLETED" && !data.completedDate) data.completedDate = new Date();
  try {
    const item = await prisma.safetyInspection.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Inspection not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.safetyInspection.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Inspection not found" });
  }
});

export default router;
