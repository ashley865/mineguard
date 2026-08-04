import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const staffCategoryEnum = z.enum([
  "MINING_OPERATIONS",
  "ENGINEERING_TECHNICAL",
  "DRIVER",
  "CLEANER",
  "SECURITY",
  "ADMINISTRATION",
  "EXECUTIVE",
  "MEDICAL",
  "SAFETY_HEALTH",
  "MAINTENANCE",
  "CATERING",
  "OTHER",
]);

const workerSchema = z.object({
  name: z.string().min(1),
  employeeId: z.string().min(1),
  role: z.string().min(1),
  category: staffCategoryEnum.optional(),
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
  category: true,
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
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const category = req.query.category as string | undefined;
  const workers = await prisma.worker.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, category: (category as any) || undefined },
    select: workerSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(workers.map(withHasPhoto));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = workerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  try {
    const worker = await prisma.worker.create({ data: parsed.data, select: workerSelect });
    res.status(201).json(withHasPhoto(worker));
  } catch {
    res.status(409).json({ error: "Employee ID already exists" });
  }
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = workerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Worker not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  try {
    const worker = await prisma.worker.update({ where: { id: existing.id }, data: parsed.data, select: workerSelect });
    res.json(withHasPhoto(worker));
  } catch {
    res.status(409).json({ error: "Employee ID already exists" });
  }
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Worker not found" });
  await prisma.worker.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/toggle-attendance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const worker = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } } });
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
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const worker = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const records = await prisma.workerAttendance.findMany({
    where: { workerId: worker.id },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });
  res.json(records);
});

router.post("/:id/photo", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("photo"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!req.file) return res.status(400).json({ error: "A photo file is required" });
  const worker = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  await prisma.worker.update({
    where: { id: worker.id },
    data: { photoData: Uint8Array.from(req.file.buffer), photoMimeType: req.file.mimetype },
  });
  res.status(204).send();
});

router.get("/:id/photo", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const worker = await prisma.worker.findFirst({
    where: { id: req.params.id, site: { mineId } },
    select: { photoData: true, photoMimeType: true },
  });
  if (!worker?.photoData || !worker.photoMimeType) return res.status(404).json({ error: "No photo set" });
  res.setHeader("Content-Type", worker.photoMimeType);
  res.send(Buffer.from(worker.photoData));
});

router.get("/:id/profile", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const worker = await prisma.worker.findFirst({ where: { id: req.params.id, site: { mineId } }, select: workerSelect });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [attendance90, attendance30, certificates, trainingRecords, medicalRecords, leaveRequests, payslips] = await Promise.all([
    prisma.workerAttendance.findMany({
      where: { workerId: worker.id, checkInAt: { gte: since90 } },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.workerAttendance.findMany({
      where: { workerId: worker.id, checkInAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { checkInAt: "asc" },
    }),
    prisma.certificate.findMany({ where: { workerId: worker.id }, orderBy: { issueDate: "desc" } }),
    prisma.trainingRecord.findMany({ where: { workerId: worker.id }, orderBy: { completionDate: "desc" } }),
    prisma.medicalSurveillance.findMany({ where: { workerId: worker.id }, orderBy: { examDate: "desc" } }),
    prisma.leaveRequest.findMany({ where: { workerId: worker.id }, orderBy: { startDate: "desc" } }),
    prisma.payslip.findMany({
      where: { workerId: worker.id },
      select: {
        id: true,
        payPeriodStart: true,
        payPeriodEnd: true,
        grossPay: true,
        deductions: true,
        netPay: true,
        issuedAt: true,
        fileName: true,
        fileMimeType: true,
      },
      orderBy: { payPeriodEnd: "desc" },
      take: 12,
    }),
  ]);

  const daysWorkedSet = new Set(attendance90.map((a) => a.checkInAt.toISOString().slice(0, 10)));
  const completedShifts = attendance90.filter((a) => a.checkOutAt);
  const totalHours = completedShifts.reduce((sum, a) => {
    const hours = (a.checkOutAt!.getTime() - a.checkInAt.getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  const dailyHoursMap = new Map<string, number>();
  for (const a of attendance30) {
    if (!a.checkOutAt) continue;
    const key = a.checkInAt.toISOString().slice(0, 10);
    const hours = (a.checkOutAt.getTime() - a.checkInAt.getTime()) / (1000 * 60 * 60);
    dailyHoursMap.set(key, (dailyHoursMap.get(key) ?? 0) + hours);
  }
  const dailyHoursLast30 = Array.from(dailyHoursMap.entries())
    .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const leaveThisYear = leaveRequests.filter((l) => l.status === "APPROVED" && l.startDate >= yearStart);
  const leaveDaysByType: Record<string, number> = {};
  for (const l of leaveThisYear) {
    leaveDaysByType[l.leaveType] = (leaveDaysByType[l.leaveType] ?? 0) + l.daysRequested;
  }

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
      leaveDaysTakenThisYear: Object.values(leaveDaysByType).reduce((sum, d) => sum + d, 0),
    },
    recentAttendance: attendance90.slice(0, 10),
    dailyHoursLast30,
    certificates,
    trainingRecords,
    medicalRecords,
    leaveDaysByType,
    recentLeaveRequests: leaveRequests.slice(0, 10),
    payslips,
  });
});

export default router;
