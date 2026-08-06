import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const maintenanceTypeEnum = z.enum(["PLANNED", "PREVENTIVE", "CORRECTIVE", "EMERGENCY", "INSPECTION"]);

const scheduleSchema = z.object({
  equipmentId: z.string().min(1),
  maintenanceType: maintenanceTypeEnum,
  scheduledDate: z.coerce.date(),
  completedDate: z.coerce.date().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"]).optional(),
  downtimeMinutes: z.coerce.number().nonnegative().optional().nullable(),
  downtimeReason: z.string().optional().nullable(),
  findings: z.string().optional(),
  partsUsed: z.string().optional(),
  cost: z.coerce.number().optional().nullable(),
});

const partUsedSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.coerce.number().positive(),
});

const scheduleSelect = {
  id: true,
  equipmentId: true,
  equipment: { select: { id: true, name: true, type: true, site: { select: { id: true, name: true } } } },
  maintenanceType: true,
  scheduledDate: true,
  completedDate: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
  status: true,
  downtimeMinutes: true,
  downtimeReason: true,
  findings: true,
  partsUsed: true,
  cost: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
  partsConsumed: {
    select: {
      id: true,
      quantity: true,
      inventoryItem: { select: { id: true, name: true, unit: true } },
      createdAt: true,
    },
  },
} as const;

router.use(requireAuth);

router.get("/technicians", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const technicians = await prisma.user.findMany({
    where: { mineId, role: { in: ["ADMIN", "SUPERVISOR", "EXECUTIVE"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json(technicians);
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const equipmentId = req.query.equipmentId as string | undefined;
  const status = req.query.status as string | undefined;
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      equipment: { site: { mineId } },
      equipmentId: equipmentId || undefined,
      status: (status as any) || undefined,
    },
    select: scheduleSelect,
    orderBy: { scheduledDate: "asc" },
  });
  res.json(schedules);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const equipment = await prisma.equipment.findFirst({ where: { id: parsed.data.equipmentId, site: { mineId } } });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });
  if (parsed.data.assignedToId) {
    const technician = await prisma.user.findFirst({ where: { id: parsed.data.assignedToId, mineId } });
    if (!technician) return res.status(404).json({ error: "Assigned technician not found" });
  }
  const schedule = await prisma.maintenanceSchedule.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: scheduleSelect,
  });
  res.status(201).json(schedule);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = scheduleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.maintenanceSchedule.findFirst({ where: { id: req.params.id, equipment: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Maintenance schedule not found" });
  if (parsed.data.assignedToId) {
    const technician = await prisma.user.findFirst({ where: { id: parsed.data.assignedToId, mineId } });
    if (!technician) return res.status(404).json({ error: "Assigned technician not found" });
  }
  const schedule = await prisma.maintenanceSchedule.update({ where: { id: existing.id }, data: parsed.data, select: scheduleSelect });
  res.json(schedule);
});

router.post("/:id/complete", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.maintenanceSchedule.findFirst({ where: { id: req.params.id, equipment: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Maintenance schedule not found" });
  const schedule = await prisma.maintenanceSchedule.update({
    where: { id: existing.id },
    data: { status: "COMPLETED", completedDate: new Date() },
    select: scheduleSelect,
  });
  res.json(schedule);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.maintenanceSchedule.findFirst({ where: { id: req.params.id, equipment: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Maintenance schedule not found" });
  await prisma.maintenanceSchedule.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Recording a part used against a work order decrements that item's stock on hand,
// mirroring the inventory movement pattern. Only additive (no edit) — to correct a
// mistake, remove the line, which restores the stock, then add the corrected one.
router.post("/:id/parts", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = partUsedSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const schedule = await prisma.maintenanceSchedule.findFirst({ where: { id: req.params.id, equipment: { site: { mineId } } } });
  if (!schedule) return res.status(404).json({ error: "Maintenance schedule not found" });
  const item = await prisma.inventoryItem.findFirst({ where: { id: parsed.data.inventoryItemId, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Inventory item not found" });
  if (item.quantityOnHand < parsed.data.quantity) {
    return res.status(409).json({ error: "Not enough stock on hand for this part" });
  }

  const [part] = await prisma.$transaction([
    prisma.maintenancePartUsed.create({
      data: { maintenanceScheduleId: schedule.id, inventoryItemId: item.id, quantity: parsed.data.quantity },
      select: { id: true, quantity: true, inventoryItem: { select: { id: true, name: true, unit: true } }, createdAt: true },
    }),
    prisma.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: parsed.data.quantity } } }),
    prisma.inventoryMovement.create({
      data: {
        itemId: item.id,
        direction: "OUT",
        quantity: parsed.data.quantity,
        reason: `Used on maintenance work order ${schedule.id}`,
        performedById: req.auth!.userId,
      },
    }),
  ]);
  res.status(201).json(part);
});

router.delete("/:id/parts/:partId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const part = await prisma.maintenancePartUsed.findFirst({
    where: { id: req.params.partId, maintenanceScheduleId: req.params.id, maintenanceSchedule: { equipment: { site: { mineId } } } },
  });
  if (!part) return res.status(404).json({ error: "Part usage record not found" });
  await prisma.$transaction([
    prisma.maintenancePartUsed.delete({ where: { id: part.id } }),
    prisma.inventoryItem.update({ where: { id: part.inventoryItemId }, data: { quantityOnHand: { increment: part.quantity } } }),
    prisma.inventoryMovement.create({
      data: {
        itemId: part.inventoryItemId,
        direction: "IN",
        quantity: part.quantity,
        reason: `Reversed from maintenance work order ${req.params.id}`,
        performedById: req.auth!.userId,
      },
    }),
  ]);
  res.status(204).send();
});

// Operations-manager-facing rollup: maintenance mix, backlog, technician workload, the
// spare parts actually being consumed, a fleet-wide MTBF approximation, and — the core
// ask — a feed of recent downtime events so managers can see why production stopped.
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const windowDays = Math.min(Math.max(Number(req.query.days) || 180, 1), 730);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const [schedules, equipmentCount] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: { equipment: { site: { mineId } }, scheduledDate: { gte: windowStart } },
      select: {
        maintenanceType: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        downtimeMinutes: true,
        downtimeReason: true,
        equipment: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        partsConsumed: { select: { quantity: true, inventoryItem: { select: { id: true, name: true } } } },
      },
      orderBy: { scheduledDate: "desc" },
    }),
    prisma.equipment.count({ where: { site: { mineId } } }),
  ]);

  const typeCounts: Record<string, number> = { PLANNED: 0, PREVENTIVE: 0, CORRECTIVE: 0, EMERGENCY: 0, INSPECTION: 0 };
  const statusCounts: Record<string, number> = { SCHEDULED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0, CANCELLED: 0 };
  const now = new Date();
  let backlog = 0;
  let totalDowntimeMinutes = 0;
  let downtimeEventCount = 0;
  let failureCount = 0;
  const technicianTotals: Record<string, { name: string; open: number; completed: number }> = {};
  const partTotals: Record<string, { name: string; quantity: number }> = {};
  const downtimeEvents: { equipment: string; type: string; downtimeMinutes: number | null; reason: string | null; date: string }[] = [];

  for (const s of schedules) {
    typeCounts[s.maintenanceType] = (typeCounts[s.maintenanceType] ?? 0) + 1;
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    if (s.status === "OVERDUE" || (s.status === "SCHEDULED" && s.scheduledDate < now)) backlog++;
    if (s.downtimeMinutes != null) {
      totalDowntimeMinutes += s.downtimeMinutes;
      downtimeEventCount++;
    }
    if (s.maintenanceType === "CORRECTIVE" || s.maintenanceType === "EMERGENCY") {
      failureCount++;
      downtimeEvents.push({
        equipment: s.equipment.name,
        type: s.maintenanceType,
        downtimeMinutes: s.downtimeMinutes,
        reason: s.downtimeReason,
        date: (s.completedDate ?? s.scheduledDate).toISOString(),
      });
    }
    if (s.assignedTo) {
      const bucket = (technicianTotals[s.assignedTo.id] ??= { name: s.assignedTo.name, open: 0, completed: 0 });
      if (s.status === "COMPLETED") bucket.completed++;
      else if (s.status !== "CANCELLED") bucket.open++;
    }
    for (const p of s.partsConsumed) {
      const bucket = (partTotals[p.inventoryItem.id] ??= { name: p.inventoryItem.name, quantity: 0 });
      bucket.quantity += p.quantity;
    }
  }

  downtimeEvents.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Fleet-wide MTBF approximation: total available operating time (equipment count x
  // window length) divided by the number of failure (corrective/emergency) events.
  const mtbfDays = failureCount > 0 ? Math.round(((equipmentCount * windowDays) / failureCount) * 10) / 10 : null;

  res.json({
    windowDays,
    byType: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
    byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    backlog,
    totalDowntimeMinutes: Math.round(totalDowntimeMinutes),
    avgDowntimeMinutes: downtimeEventCount > 0 ? Math.round(totalDowntimeMinutes / downtimeEventCount) : null,
    mtbfDays,
    failureCount,
    byTechnician: Object.values(technicianTotals).sort((a, b) => b.open + b.completed - (a.open + a.completed)),
    topPartsUsed: Object.values(partTotals)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    recentDowntimeEvents: downtimeEvents.slice(0, 10),
  });
});

export default router;
