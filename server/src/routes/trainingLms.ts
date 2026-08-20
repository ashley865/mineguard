import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const trainingTypeEnum = z.enum([
  "INDUCTION",
  "REFRESHER",
  "FIRST_AID",
  "FIRE_FIGHTING",
  "SELF_RESCUE",
  "HAZARD_SPECIFIC",
  "SKILLS_DEVELOPMENT",
  "OTHER",
]);

const courseSchema = z.object({
  siteId: z.string().optional().nullable(),
  courseName: z.string().min(1),
  courseType: trainingTypeEnum,
  description: z.string().optional(),
  durationHours: z.coerce.number().optional().nullable(),
  provider: z.string().optional(),
});

const sessionSchema = z.object({
  courseId: z.string().min(1),
  scheduledDate: z.coerce.date(),
  location: z.string().optional(),
  instructor: z.string().optional(),
  capacity: z.coerce.number().int().optional().nullable(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

const enrollmentSchema = z.object({
  workerId: z.string().min(1),
});

const enrollmentUpdateSchema = z.object({
  attendanceStatus: z.enum(["ENROLLED", "ATTENDED", "NO_SHOW", "COMPLETED"]).optional(),
  completionDate: z.coerce.date().optional().nullable(),
});

const courseSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  courseName: true,
  courseType: true,
  description: true,
  durationHours: true,
  provider: true,
  createdAt: true,
} as const;

const sessionSelect = {
  id: true,
  courseId: true,
  course: { select: { id: true, courseName: true, courseType: true } },
  scheduledDate: true,
  location: true,
  instructor: true,
  capacity: true,
  status: true,
  _count: { select: { enrollments: true } },
  enrollments: { select: { attendanceStatus: true } },
  createdAt: true,
} as const;

const enrollmentSelect = {
  id: true,
  sessionId: true,
  worker: { select: { id: true, name: true, employeeId: true, role: true } },
  attendanceStatus: true,
  completionDate: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/courses", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const courses = await prisma.trainingCourse.findMany({
    where: { mineId, ...(siteId ? { OR: [{ siteId }, { siteId: null }] } : {}) },
    select: courseSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(courses);
});

router.post("/courses", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = courseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const course = await prisma.trainingCourse.create({ data: { ...parsed.data, mineId }, select: courseSelect });
  res.status(201).json(course);
});

router.put("/courses/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = courseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.trainingCourse.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Course not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const course = await prisma.trainingCourse.update({ where: { id: existing.id }, data: parsed.data, select: courseSelect });
  res.json(course);
});

router.delete("/courses/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.trainingCourse.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Course not found" });
  await prisma.trainingCourse.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/sessions", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const courseId = req.query.courseId as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const sessions = await prisma.trainingSession.findMany({
    where: {
      course: { mineId },
      courseId: courseId || undefined,
      status: status && status !== "ALL" ? (status as "SCHEDULED" | "COMPLETED" | "CANCELLED") : undefined,
      ...(search
        ? {
            OR: [
              { course: { courseName: { contains: search, mode: "insensitive" } } },
              { location: { contains: search, mode: "insensitive" } },
              { instructor: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: sessionSelect,
    orderBy: { scheduledDate: "desc" },
  });
  res.json(sessions);
});

router.post("/sessions", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const course = await prisma.trainingCourse.findFirst({ where: { id: parsed.data.courseId, mineId } });
  if (!course) return res.status(404).json({ error: "Course not found" });
  const session = await prisma.trainingSession.create({ data: parsed.data, select: sessionSelect });
  res.status(201).json(session);
});

router.put("/sessions/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sessionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.trainingSession.findFirst({ where: { id: req.params.id, course: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Session not found" });
  const session = await prisma.trainingSession.update({ where: { id: existing.id }, data: parsed.data, select: sessionSelect });
  res.json(session);
});

router.delete("/sessions/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.trainingSession.findFirst({ where: { id: req.params.id, course: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Session not found" });
  await prisma.trainingSession.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/sessions/:id/enrollments", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const session = await prisma.trainingSession.findFirst({ where: { id: req.params.id, course: { mineId } } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  const enrollments = await prisma.trainingEnrollment.findMany({
    where: { sessionId: session.id },
    select: enrollmentSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json(enrollments);
});

router.post("/sessions/:id/enrollments", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = enrollmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const session = await prisma.trainingSession.findFirst({ where: { id: req.params.id, course: { mineId } } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  try {
    const enrollment = await prisma.trainingEnrollment.create({
      data: { sessionId: session.id, workerId: parsed.data.workerId },
      select: enrollmentSelect,
    });
    res.status(201).json(enrollment);
  } catch {
    res.status(409).json({ error: "This worker is already enrolled in this session" });
  }
});

router.put("/enrollments/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = enrollmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.trainingEnrollment.findFirst({ where: { id: req.params.id, session: { course: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Enrollment not found" });
  const enrollment = await prisma.trainingEnrollment.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      completionDate: parsed.data.attendanceStatus === "COMPLETED" ? (parsed.data.completionDate ?? new Date()) : parsed.data.completionDate,
    },
    select: enrollmentSelect,
  });
  res.json(enrollment);
});

router.delete("/enrollments/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.trainingEnrollment.findFirst({ where: { id: req.params.id, session: { course: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Enrollment not found" });
  await prisma.trainingEnrollment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
