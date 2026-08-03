import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const recordSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  shiftDate: z.coerce.date(),
  shift: z.enum(["DAY", "AFTERNOON", "NIGHT"]),
  mineralType: z.string().min(1),
  tonnesMined: z.coerce.number().nonnegative(),
  oreGrade: z.coerce.number().optional().nullable(),
  wasteRemoved: z.coerce.number().optional().nullable(),
  targetTonnes: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

const recordSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  shiftDate: true,
  shift: true,
  mineralType: true,
  tonnesMined: true,
  oreGrade: true,
  wasteRemoved: true,
  targetTonnes: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const records = await prisma.productionRecord.findMany({
    where: {
      siteId: siteId || undefined,
      shiftDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    select: recordSelect,
    orderBy: { shiftDate: "desc" },
  });
  res.json(records);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const record = await prisma.productionRecord.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: recordSelect,
  });
  res.status(201).json(record);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = recordSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const record = await prisma.productionRecord.update({ where: { id: req.params.id }, data: parsed.data, select: recordSelect });
    res.json(record);
  } catch {
    res.status(404).json({ error: "Production record not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.productionRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Production record not found" });
  }
});

export default router;
