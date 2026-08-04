import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

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

const workerSelect = {
  id: true,
  name: true,
  employeeId: true,
  role: true,
  phone: true,
  status: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  nextOfKinName: true,
  nextOfKinRelationship: true,
  nextOfKinPhone: true,
  createdAt: true,
  photoMimeType: true,
} as const;

function withHasPhoto<T extends { photoMimeType: string | null }>(worker: T) {
  const { photoMimeType, ...rest } = worker;
  return { ...rest, hasPhoto: !!photoMimeType };
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const workers = await prisma.worker.findMany({
    where: siteId ? { siteId } : undefined,
    select: workerSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(workers.map(withHasPhoto));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = workerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const worker = await prisma.worker.create({ data: parsed.data, select: workerSelect });
    res.status(201).json(withHasPhoto(worker));
  } catch {
    res.status(409).json({ error: "Employee ID already exists" });
  }
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = workerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const worker = await prisma.worker.update({ where: { id: req.params.id }, data: parsed.data, select: workerSelect });
    res.json(withHasPhoto(worker));
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
    const updated = await prisma.worker.update({ where: { id: worker.id }, data: { status: "OFF_SHIFT" }, select: workerSelect });
    return res.json({ worker: withHasPhoto(updated), action: "CHECKED_OUT" });
  }

  await prisma.workerAttendance.create({ data: { workerId: worker.id } });
  const updated = await prisma.worker.update({ where: { id: worker.id }, data: { status: "ON_SHIFT" }, select: workerSelect });
  res.json({ worker: withHasPhoto(updated), action: "CHECKED_IN" });
});

router.get("/:id/attendance", async (req, res) => {
  const records = await prisma.workerAttendance.findMany({
    where: { workerId: req.params.id },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });
  res.json(records);
});

router.post("/:id/photo", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A photo file is required" });
  try {
    await prisma.worker.update({
      where: { id: req.params.id },
      data: { photoData: Uint8Array.from(req.file.buffer), photoMimeType: req.file.mimetype },
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Worker not found" });
  }
});

router.get("/:id/photo", async (req, res) => {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.id }, select: { photoData: true, photoMimeType: true } });
  if (!worker?.photoData || !worker.photoMimeType) return res.status(404).json({ error: "No photo set" });
  res.setHeader("Content-Type", worker.photoMimeType);
  res.send(Buffer.from(worker.photoData));
});

router.get("/:id/profile", async (req, res) => {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.id }, select: workerSelect });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);

  const [attendance90, certificates, trainingRecords, medicalRecords] = await Promise.all([
    prisma.workerAttendance.findMany({
      where: { workerId: worker.id, checkInAt: { gte: since90 } },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.certificate.findMany({ where: { workerId: worker.id }, orderBy: { issueDate: "desc" } }),
    prisma.trainingRecord.findMany({ where: { workerId: worker.id }, orderBy: { completionDate: "desc" } }),
    prisma.medicalSurveillance.findMany({ where: { workerId: worker.id }, orderBy: { examDate: "desc" }, take: 1 }),
  ]);

  const daysWorkedSet = new Set(attendance90.map((a) => a.checkInAt.toISOString().slice(0, 10)));
  const completedShifts = attendance90.filter((a) => a.checkOutAt);
  const totalHours = completedShifts.reduce((sum, a) => {
    const hours = (a.checkOutAt!.getTime() - a.checkInAt.getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  res.json({
    worker: withHasPhoto(worker),
    stats: {
      daysWorkedLast90: daysWorkedSet.size,
      shiftsLast90: attendance90.length,
      avgHoursPerShift: completedShifts.length > 0 ? Math.round((totalHours / completedShifts.length) * 10) / 10 : null,
      activeCertificates: certificates.filter((c) => c.status === "ACTIVE").length,
      totalCertificates: certificates.length,
      trainingCompleted: trainingRecords.length,
      latestMedicalResult: medicalRecords[0]?.result ?? null,
    },
    recentAttendance: attendance90.slice(0, 10),
    certificates,
    trainingRecords,
  });
});

export default router;
