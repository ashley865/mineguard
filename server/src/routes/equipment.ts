import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const equipmentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "DOWN"]).optional(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  lastMaintenance: z.string().datetime().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const equipment = await prisma.equipment.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(equipment);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { lastMaintenance, ...rest } = parsed.data;
  const equipment = await prisma.equipment.create({
    data: { ...rest, lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null },
  });
  res.status(201).json(equipment);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { lastMaintenance, ...rest } = parsed.data;
  try {
    const equipment = await prisma.equipment.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(lastMaintenance !== undefined
          ? { lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null }
          : {}),
      },
    });
    res.json(equipment);
  } catch {
    res.status(404).json({ error: "Equipment not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.equipment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Equipment not found" });
  }
});

export default router;
