import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const equipmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "EXCAVATOR",
    "HAUL_TRUCK",
    "DRILL_RIG",
    "LOADER",
    "DOZER",
    "GRADER",
    "CRUSHER",
    "CONVEYOR",
    "GENERATOR",
    "PUMP",
    "VENTILATION_FAN",
    "COMPRESSOR",
    "WINCH",
    "CRANE",
    "OTHER",
  ]),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "DOWN"]).optional(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  assignedOperatorId: z.string().optional().nullable(),
  lastMaintenance: z.string().datetime().optional().nullable(),
});

const equipmentInclude = {
  site: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  assignedOperator: { select: { id: true, name: true, employeeId: true } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const equipment = await prisma.equipment.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: equipmentInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(equipment);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.assignedOperatorId) {
    const operator = await prisma.worker.findFirst({ where: { id: parsed.data.assignedOperatorId, site: { mineId } } });
    if (!operator) return res.status(404).json({ error: "Assigned operator not found" });
  }
  const { lastMaintenance, ...rest } = parsed.data;
  const equipment = await prisma.equipment.create({
    data: { ...rest, lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null },
    include: equipmentInclude,
  });
  res.status(201).json(equipment);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.equipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Equipment not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.assignedOperatorId) {
    const operator = await prisma.worker.findFirst({ where: { id: parsed.data.assignedOperatorId, site: { mineId } } });
    if (!operator) return res.status(404).json({ error: "Assigned operator not found" });
  }
  const { lastMaintenance, ...rest } = parsed.data;
  const equipment = await prisma.equipment.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(lastMaintenance !== undefined
        ? { lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null }
        : {}),
    },
    include: equipmentInclude,
  });
  res.json(equipment);
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.equipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Equipment not found" });
  await prisma.equipment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
