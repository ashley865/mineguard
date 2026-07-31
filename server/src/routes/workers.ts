import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const workerSchema = z.object({
  name: z.string().min(1),
  employeeId: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  status: z.enum(["ON_SHIFT", "OFF_SHIFT", "EMERGENCY"]).optional(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  nextOfKinName: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const workers = await prisma.worker.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(workers);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = workerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const worker = await prisma.worker.create({ data: parsed.data });
    res.status(201).json(worker);
  } catch {
    res.status(409).json({ error: "Employee ID already exists" });
  }
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = workerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const worker = await prisma.worker.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(worker);
  } catch {
    res.status(404).json({ error: "Worker not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.worker.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Worker not found" });
  }
});

router.post("/:id/toggle-attendance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const openRecord = await prisma.workerAttendance.findFirst({
    where: { workerId: worker.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (openRecord) {
    await prisma.workerAttendance.update({ where: { id: openRecord.id }, data: { checkOutAt: new Date() } });
    const updated = await prisma.worker.update({ where: { id: worker.id }, data: { status: "OFF_SHIFT" } });
    return res.json({ worker: updated, action: "CHECKED_OUT" });
  }

  await prisma.workerAttendance.create({ data: { workerId: worker.id } });
  const updated = await prisma.worker.update({ where: { id: worker.id }, data: { status: "ON_SHIFT" } });
  res.json({ worker: updated, action: "CHECKED_IN" });
});

router.get("/:id/attendance", async (req, res) => {
  const records = await prisma.workerAttendance.findMany({
    where: { workerId: req.params.id },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });
  res.json(records);
});

export default router;
