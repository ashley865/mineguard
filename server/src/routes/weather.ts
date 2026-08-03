import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const readingSchema = z.object({
  siteId: z.string().min(1),
  recordedAt: z.coerce.date().optional(),
  temperature: z.coerce.number().optional().nullable(),
  windSpeed: z.coerce.number().optional().nullable(),
  windDirection: z.string().optional(),
  precipitation: z.coerce.number().optional().nullable(),
  condition: z.enum(["CLEAR", "CLOUDY", "RAIN", "STORM", "FOG", "HIGH_WIND"]).optional(),
  lightningDetected: z.coerce.boolean().optional(),
  alertIssued: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

const readingSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  recordedAt: true,
  temperature: true,
  windSpeed: true,
  windDirection: true,
  precipitation: true,
  condition: true,
  lightningDetected: true,
  alertIssued: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const readings = await prisma.weatherReading.findMany({
    where: { siteId: siteId || undefined },
    select: readingSelect,
    orderBy: { recordedAt: "desc" },
    take: 200,
  });
  res.json(readings);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reading = await prisma.weatherReading.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: readingSelect,
  });
  res.status(201).json(reading);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = readingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const reading = await prisma.weatherReading.update({ where: { id: req.params.id }, data: parsed.data, select: readingSelect });
    res.json(reading);
  } catch {
    res.status(404).json({ error: "Weather reading not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.weatherReading.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Weather reading not found" });
  }
});

export default router;
