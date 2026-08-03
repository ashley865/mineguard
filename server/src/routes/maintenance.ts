import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const scheduleSchema = z.object({
  equipmentId: z.string().min(1),
  maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]),
  scheduledDate: z.coerce.date(),
  completedDate: z.coerce.date().optional().nullable(),
  performedBy: z.string().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"]).optional(),
  findings: z.string().optional(),
  partsUsed: z.string().optional(),
  cost: z.coerce.number().optional().nullable(),
});

const scheduleSelect = {
  id: true,
  equipmentId: true,
  equipment: { select: { id: true, name: true, type: true, site: { select: { id: true, name: true } } } },
  maintenanceType: true,
  scheduledDate: true,
  completedDate: true,
  performedBy: true,
  status: true,
  findings: true,
  partsUsed: true,
  cost: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const equipmentId = req.query.equipmentId as string | undefined;
  const status = req.query.status as string | undefined;
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { equipmentId: equipmentId || undefined, status: (status as any) || undefined },
    select: scheduleSelect,
    orderBy: { scheduledDate: "asc" },
  });
  res.json(schedules);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const schedule = await prisma.maintenanceSchedule.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: scheduleSelect,
  });
  res.status(201).json(schedule);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = scheduleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const schedule = await prisma.maintenanceSchedule.update({ where: { id: req.params.id }, data: parsed.data, select: scheduleSelect });
    res.json(schedule);
  } catch {
    res.status(404).json({ error: "Maintenance schedule not found" });
  }
});

router.post("/:id/complete", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  try {
    const schedule = await prisma.maintenanceSchedule.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED", completedDate: new Date() },
      select: scheduleSelect,
    });
    res.json(schedule);
  } catch {
    res.status(404).json({ error: "Maintenance schedule not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.maintenanceSchedule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Maintenance schedule not found" });
  }
});

export default router;
