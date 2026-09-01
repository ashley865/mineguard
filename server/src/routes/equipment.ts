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

const consumablePartSchema = z.object({
  partType: z.enum(["TYRE", "GET_BUCKET_TOOTH", "GET_CUTTING_EDGE", "GET_BLADE", "OTHER"]),
  position: z.string().optional(),
  brand: z.string().optional(),
  serialOrPartNumber: z.string().optional(),
  installDate: z.coerce.date().optional().nullable(),
  installHoursMeter: z.coerce.number().min(0).optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  initialMeasurement: z.coerce.number().optional().nullable(),
  currentMeasurement: z.coerce.number().optional().nullable(),
  measurementUnit: z.string().optional(),
  status: z.enum(["IN_SERVICE", "REMOVED", "SCRAPPED"]).optional(),
  removedDate: z.coerce.date().optional().nullable(),
  removalReason: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/:equipmentId/consumable-parts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const equipment = await prisma.equipment.findFirst({ where: { id: req.params.equipmentId, site: { mineId } } });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });
  const parts = await prisma.equipmentConsumablePart.findMany({
    where: { equipmentId: equipment.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(parts);
});

router.post("/:equipmentId/consumable-parts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const equipment = await prisma.equipment.findFirst({ where: { id: req.params.equipmentId, site: { mineId } } });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });
  const parsed = consumablePartSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const part = await prisma.equipmentConsumablePart.create({ data: { ...parsed.data, equipmentId: equipment.id } });
  res.status(201).json(part);
});

router.put("/:equipmentId/consumable-parts/:partId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.equipmentConsumablePart.findFirst({
    where: { id: req.params.partId, equipmentId: req.params.equipmentId, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Part not found" });
  const parsed = consumablePartSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const part = await prisma.equipmentConsumablePart.update({ where: { id: existing.id }, data: parsed.data });
  res.json(part);
});

router.delete("/:equipmentId/consumable-parts/:partId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.equipmentConsumablePart.findFirst({
    where: { id: req.params.partId, equipmentId: req.params.equipmentId, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Part not found" });
  await prisma.equipmentConsumablePart.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
