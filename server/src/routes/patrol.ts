import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { imageFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const checkpointSelect = {
  id: true,
  sequence: true,
  name: true,
  description: true,
} as const;

const routeSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  description: true,
  isActive: true,
  checkpoints: { select: checkpointSelect, orderBy: { sequence: "asc" } },
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const logEntrySelect = {
  id: true,
  checkpointId: true,
  checkpoint: { select: { id: true, name: true, sequence: true } },
  category: true,
  photoMimeType: true,
  notes: true,
  latitude: true,
  longitude: true,
  loggedAt: true,
} as const;

const observationSelect = {
  id: true,
  assignmentId: true,
  checkpointId: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  category: true,
  photoMimeType: true,
  notes: true,
  latitude: true,
  longitude: true,
  loggedAt: true,
} as const;

const observationCategoryEnum = z.enum([
  "SAFETY_HAZARD",
  "SUSPICIOUS_ACTIVITY",
  "SECURITY_CONCERN",
  "MAINTENANCE_ISSUE",
  "GENERAL_OBSERVATION",
  "OTHER",
]);

const assignmentSelect = {
  id: true,
  routeId: true,
  route: { select: routeSelect },
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  siteId: true,
  site: { select: { id: true, name: true } },
  shiftDate: true,
  status: true,
  startedAt: true,
  completedAt: true,
  notes: true,
  assignedBy: { select: { id: true, name: true } },
  logs: { select: logEntrySelect, orderBy: { loggedAt: "asc" } },
  createdAt: true,
} as const;

async function findGuard(siteId: string, workerId: string) {
  return prisma.worker.findFirst({
    where: { id: workerId, siteId, category: "SECURITY" },
    select: { id: true, name: true, employeeId: true, status: true },
  });
}

// ---------------------------------------------------------------------------
// Public guard duty portal (/patrol/:siteId on the client) — no login. A guard is
// physical staff (Worker), not a User account, so this mirrors the trust model
// already used for visitor self-check-in: knowing the site-scoped link plus
// identifying yourself from the site's own security-staff list is the access
// control, the same as a visitor filling in their own check-in form.
// ---------------------------------------------------------------------------

// A guard's personal duty link (/patrol/g/:token) resolves straight to their own
// identity + site, skipping the site-wide name picker — the token itself is the
// credential, so it must never be guessable (crypto.randomBytes, see below).
router.get("/public/duty-link/:token", async (req, res) => {
  const guard = await prisma.worker.findFirst({
    where: { dutyToken: req.params.token, category: "SECURITY" },
    select: { id: true, name: true, employeeId: true, status: true, siteId: true, site: { select: { id: true, name: true } } },
  });
  if (!guard) return res.status(404).json({ error: "Invalid or expired duty link" });
  res.json(guard);
});

router.get("/public/:siteId/guards", async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId }, select: { id: true, name: true } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const guards = await prisma.worker.findMany({
    where: { siteId: site.id, category: "SECURITY" },
    select: { id: true, name: true, employeeId: true, status: true },
    orderBy: { name: "asc" },
  });
  res.json({ site, guards });
});

router.get("/public/:siteId/duty/:workerId", async (req, res) => {
  const guard = await findGuard(req.params.siteId, req.params.workerId);
  if (!guard) return res.status(404).json({ error: "Guard not found at this site" });
  const openAttendance = await prisma.workerAttendance.findFirst({
    where: { workerId: guard.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const assignment = await prisma.patrolAssignment.findFirst({
    where: { workerId: guard.id, siteId: req.params.siteId, shiftDate: { gte: startOfDay }, status: { not: "MISSED" } },
    select: assignmentSelect,
    orderBy: { shiftDate: "desc" },
  });
  res.json({ guard, onDuty: !!openAttendance, assignment });
});

router.post("/public/:siteId/duty/:workerId/toggle", async (req, res) => {
  const guard = await findGuard(req.params.siteId, req.params.workerId);
  if (!guard) return res.status(404).json({ error: "Guard not found at this site" });

  const openRecord = await prisma.workerAttendance.findFirst({
    where: { workerId: guard.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (openRecord) {
    await prisma.workerAttendance.update({ where: { id: openRecord.id }, data: { checkOutAt: new Date() } });
    await prisma.worker.update({ where: { id: guard.id }, data: { status: "OFF_SHIFT" } });
    return res.json({ onDuty: false });
  }

  await prisma.workerAttendance.create({ data: { workerId: guard.id } });
  await prisma.worker.update({ where: { id: guard.id }, data: { status: "ON_SHIFT" } });
  res.json({ onDuty: true });
});

async function loadAssignmentForGuard(siteId: string, workerId: string, assignmentId: string) {
  return prisma.patrolAssignment.findFirst({
    where: { id: assignmentId, siteId, workerId },
    include: { route: { include: { checkpoints: true } }, logs: true },
  });
}

router.post(
  "/public/:siteId/duty/:workerId/assignments/:assignmentId/checkpoints/:checkpointId/log",
  upload.single("photo"),
  async (req, res) => {
    const guard = await findGuard(req.params.siteId, req.params.workerId);
    if (!guard) return res.status(404).json({ error: "Guard not found at this site" });
    const assignment = await loadAssignmentForGuard(req.params.siteId, guard.id, req.params.assignmentId);
    if (!assignment) return res.status(404).json({ error: "Patrol assignment not found" });
    const checkpoint = assignment.route.checkpoints.find((c) => c.id === req.params.checkpointId);
    if (!checkpoint) return res.status(404).json({ error: "Checkpoint not found on this route" });

    await prisma.patrolLogEntry.create({
      data: {
        assignmentId: assignment.id,
        checkpointId: checkpoint.id,
        notes: (req.body?.notes as string) || undefined,
        photoData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
        photoMimeType: req.file?.mimetype,
      },
    });

    const loggedCheckpointIds = new Set([...assignment.logs.map((l) => l.checkpointId), checkpoint.id]);
    const allLogged = assignment.route.checkpoints.every((c) => loggedCheckpointIds.has(c.id));
    const updated = await prisma.patrolAssignment.update({
      where: { id: assignment.id },
      data: {
        status: allLogged ? "COMPLETED" : "IN_PROGRESS",
        startedAt: assignment.startedAt ?? new Date(),
        completedAt: allLogged ? new Date() : undefined,
      },
      select: assignmentSelect,
    });
    res.status(201).json(updated);
  }
);

router.post("/public/:siteId/duty/:workerId/assignments/:assignmentId/photo", upload.single("photo"), async (req, res) => {
  const guard = await findGuard(req.params.siteId, req.params.workerId);
  if (!guard) return res.status(404).json({ error: "Guard not found at this site" });
  const assignment = await prisma.patrolAssignment.findFirst({
    where: { id: req.params.assignmentId, siteId: req.params.siteId, workerId: guard.id },
  });
  if (!assignment) return res.status(404).json({ error: "Patrol assignment not found" });
  const notes = (req.body?.notes as string) || undefined;
  if (!req.file && !notes) return res.status(400).json({ error: "A photo or a note is required" });
  const category = observationCategoryEnum.safeParse(req.body?.category);

  const entry = await prisma.patrolLogEntry.create({
    data: {
      assignmentId: assignment.id,
      siteId: req.params.siteId,
      workerId: guard.id,
      category: category.success ? category.data : "GENERAL_OBSERVATION",
      notes,
      photoData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
      photoMimeType: req.file?.mimetype,
      latitude: req.body?.latitude ? Number(req.body.latitude) : undefined,
      longitude: req.body?.longitude ? Number(req.body.longitude) : undefined,
    },
    select: logEntrySelect,
  });
  res.status(201).json(entry);
});

// A guard doesn't need a scheduled patrol assignment to report something — this is the
// same "log an observation" capability without requiring assignment context, for a guard
// simply on duty (or between assignments) who spots a hazard or something suspicious.
router.post("/public/:siteId/duty/:workerId/observation", upload.single("photo"), async (req, res) => {
  const guard = await findGuard(req.params.siteId, req.params.workerId);
  if (!guard) return res.status(404).json({ error: "Guard not found at this site" });
  const notes = (req.body?.notes as string) || undefined;
  if (!req.file && !notes) return res.status(400).json({ error: "A photo or a note is required" });
  const category = observationCategoryEnum.safeParse(req.body?.category);

  const entry = await prisma.patrolLogEntry.create({
    data: {
      siteId: req.params.siteId,
      workerId: guard.id,
      category: category.success ? category.data : "GENERAL_OBSERVATION",
      notes,
      photoData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
      photoMimeType: req.file?.mimetype,
      latitude: req.body?.latitude ? Number(req.body.latitude) : undefined,
      longitude: req.body?.longitude ? Number(req.body.longitude) : undefined,
    },
    select: logEntrySelect,
  });
  res.status(201).json(entry);
});

router.get("/public/log-entries/:id/photo", async (req, res) => {
  const entry = await prisma.patrolLogEntry.findUnique({
    where: { id: req.params.id },
    select: { photoData: true, photoMimeType: true },
  });
  if (!entry?.photoData || !entry.photoMimeType) return res.status(404).json({ error: "No photo on this log entry" });
  res.setHeader("Content-Type", entry.photoMimeType);
  res.send(Buffer.from(entry.photoData));
});

const evacuateSchema = z.object({
  workerId: z.string().min(1),
  assemblyPoint: z.string().min(1),
  message: z.string().optional(),
});

// Mirrors the "anyone can raise the alarm" philosophy in emergency.ts, extended to the
// guard duty portal: a genuine evacuation is not the moment to require a User login, but
// it's still scoped to a verified on-site security guard rather than fully anonymous.
router.post("/public/:siteId/evacuate", async (req, res) => {
  const parsed = evacuateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const guard = await findGuard(req.params.siteId, parsed.data.workerId);
  if (!guard) return res.status(404).json({ error: "Guard not found at this site" });
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId }, select: { id: true, mineId: true } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const evacuation = await prisma.emergencyEvacuation.create({
    data: {
      mineId: site.mineId,
      siteId: site.id,
      assemblyPoint: parsed.data.assemblyPoint,
      message: parsed.data.message,
      triggeredByWorkerId: guard.id,
    },
    select: {
      id: true,
      siteId: true,
      site: { select: { id: true, name: true } },
      assemblyPoint: true,
      message: true,
      status: true,
      triggeredByWorker: { select: { id: true, name: true } },
      triggeredAt: true,
    },
  });

  const io = req.app.get("io");
  io?.to(`mine:${site.mineId}`).emit("emergency:evacuation", evacuation);

  res.status(201).json(evacuation);
});

// ---------------------------------------------------------------------------
// Authenticated management (Security Manager / Admin dashboard)
// ---------------------------------------------------------------------------

const checkpointInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const routeSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
  checkpoints: z.array(checkpointInputSchema).min(1),
});

const assignmentSchema = z.object({
  routeId: z.string().min(1),
  workerId: z.string().min(1),
  siteId: z.string().min(1),
  shiftDate: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

const assignmentUpdateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "MISSED"]).optional(),
  notes: z.string().optional().nullable(),
});

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Guards & duty (Security Manager / Admin dashboard)
// ---------------------------------------------------------------------------

router.get("/guards", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const guards = await prisma.worker.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, category: "SECURITY" },
    select: { id: true, name: true, employeeId: true, status: true, siteId: true, site: { select: { id: true, name: true } }, dutyToken: true },
    orderBy: { name: "asc" },
  });
  const openAttendance = await prisma.workerAttendance.findMany({
    where: { workerId: { in: guards.map((g) => g.id) }, checkOutAt: null },
    select: { workerId: true, checkInAt: true },
  });
  const onDutySince = new Map(openAttendance.map((a) => [a.workerId, a.checkInAt]));
  res.json(
    guards.map((g) => ({
      id: g.id,
      name: g.name,
      employeeId: g.employeeId,
      status: g.status,
      siteId: g.siteId,
      site: g.site,
      hasDutyLink: !!g.dutyToken,
      onDutySince: onDutySince.get(g.id) ?? null,
    }))
  );
});

// Per-guard performance summary over a rolling window, computed entirely from records
// that already exist (assignments, checkpoint logs, duty attendance, observations) — no
// separate tracking needed. A due-but-still-SCHEDULED assignment (shift date already
// passed, never started) counts as a no-show alongside anything explicitly marked MISSED,
// since nothing else in this app currently flips that status automatically.
router.get("/guards/performance", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const guards = await prisma.worker.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, category: "SECURITY" },
    select: { id: true, name: true, employeeId: true, siteId: true, site: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  const guardIds = guards.map((g) => g.id);

  const [assignments, attendance, observations] = await Promise.all([
    prisma.patrolAssignment.findMany({
      where: { workerId: { in: guardIds }, shiftDate: { gte: cutoff } },
      select: {
        workerId: true,
        status: true,
        shiftDate: true,
        startedAt: true,
        completedAt: true,
        route: { select: { checkpoints: { select: { id: true } } } },
        logs: { select: { checkpointId: true } },
      },
    }),
    prisma.workerAttendance.findMany({
      where: { workerId: { in: guardIds }, checkInAt: { gte: cutoff } },
      select: { workerId: true, checkInAt: true, checkOutAt: true },
    }),
    // Same "an observation is any log entry with a category" filter used by GET /observations.
    prisma.patrolLogEntry.findMany({
      where: { workerId: { in: guardIds }, category: { not: null }, loggedAt: { gte: cutoff } },
      select: { workerId: true },
    }),
  ]);

  interface Accumulator {
    totalAssignments: number;
    completedAssignments: number;
    missedAssignments: number;
    inProgressAssignments: number;
    checkpointsLogged: number;
    checkpointsTotal: number;
    durationSumMinutes: number;
    durationCount: number;
    observationsLogged: number;
    dutyHoursSum: number;
    lastActiveAt: Date | null;
  }
  const byGuard = new Map<string, Accumulator>(
    guards.map((g) => [
      g.id,
      {
        totalAssignments: 0,
        completedAssignments: 0,
        missedAssignments: 0,
        inProgressAssignments: 0,
        checkpointsLogged: 0,
        checkpointsTotal: 0,
        durationSumMinutes: 0,
        durationCount: 0,
        observationsLogged: 0,
        dutyHoursSum: 0,
        lastActiveAt: null,
      },
    ])
  );

  for (const a of assignments) {
    const acc = byGuard.get(a.workerId);
    if (!acc) continue;
    acc.totalAssignments += 1;
    const loggedCheckpointIds = new Set(a.logs.filter((l) => l.checkpointId).map((l) => l.checkpointId));
    acc.checkpointsLogged += loggedCheckpointIds.size;
    acc.checkpointsTotal += a.route.checkpoints.length;
    if (a.status === "COMPLETED") {
      acc.completedAssignments += 1;
      if (a.startedAt && a.completedAt) {
        acc.durationSumMinutes += (a.completedAt.getTime() - a.startedAt.getTime()) / 60000;
        acc.durationCount += 1;
      }
    } else if (a.status === "MISSED" || (a.status === "SCHEDULED" && a.shiftDate < today)) {
      acc.missedAssignments += 1;
    } else if (a.status === "IN_PROGRESS") {
      acc.inProgressAssignments += 1;
    }
  }

  for (const att of attendance) {
    const acc = byGuard.get(att.workerId);
    if (!acc) continue;
    const end = att.checkOutAt ?? new Date();
    acc.dutyHoursSum += (end.getTime() - att.checkInAt.getTime()) / 3600000;
    if (!acc.lastActiveAt || att.checkInAt > acc.lastActiveAt) acc.lastActiveAt = att.checkInAt;
  }

  for (const o of observations) {
    if (!o.workerId) continue;
    const acc = byGuard.get(o.workerId);
    if (acc) acc.observationsLogged += 1;
  }

  const results = guards.map((g) => {
    const acc = byGuard.get(g.id)!;
    const dueCount = acc.completedAssignments + acc.missedAssignments + acc.inProgressAssignments;
    return {
      workerId: g.id,
      name: g.name,
      employeeId: g.employeeId,
      siteId: g.siteId,
      site: g.site,
      totalAssignments: acc.totalAssignments,
      completedAssignments: acc.completedAssignments,
      missedAssignments: acc.missedAssignments,
      inProgressAssignments: acc.inProgressAssignments,
      completionRate: dueCount > 0 ? Math.round((acc.completedAssignments / dueCount) * 1000) / 10 : null,
      checkpointComplianceRate: acc.checkpointsTotal > 0 ? Math.round((acc.checkpointsLogged / acc.checkpointsTotal) * 1000) / 10 : null,
      avgPatrolDurationMinutes: acc.durationCount > 0 ? Math.round(acc.durationSumMinutes / acc.durationCount) : null,
      observationsLogged: acc.observationsLogged,
      dutyHours: Math.round(acc.dutyHoursSum * 10) / 10,
      lastActiveAt: acc.lastActiveAt,
    };
  });

  res.json({ days, results });
});

// The token is only ever returned here, once, at generation time — like an API key —
// not exposed through the general guards list above.
router.post("/guards/:workerId/duty-link", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const guard = await prisma.worker.findFirst({ where: { id: req.params.workerId, site: { mineId }, category: "SECURITY" } });
  if (!guard) return res.status(404).json({ error: "Security worker not found" });
  const dutyToken = crypto.randomBytes(24).toString("base64url");
  await prisma.worker.update({ where: { id: guard.id }, data: { dutyToken } });
  res.json({ workerId: guard.id, dutyToken });
});

router.delete("/guards/:workerId/duty-link", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const guard = await prisma.worker.findFirst({ where: { id: req.params.workerId, site: { mineId }, category: "SECURITY" } });
  if (!guard) return res.status(404).json({ error: "Security worker not found" });
  await prisma.worker.update({ where: { id: guard.id }, data: { dutyToken: null } });
  res.status(204).send();
});

// Automatic report-for-duty log: every time a guard toggles on/off duty from their
// public duty link, it's a plain WorkerAttendance row — this just surfaces that
// history, scoped to security staff, on the Security dashboard.
router.get("/duty-log", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const records = await prisma.workerAttendance.findMany({
    where: { worker: { category: "SECURITY", site: { mineId }, siteId: siteId || undefined } },
    select: {
      id: true,
      checkInAt: true,
      checkOutAt: true,
      worker: { select: { id: true, name: true, employeeId: true, site: { select: { id: true, name: true } } } },
    },
    orderBy: { checkInAt: "desc" },
    take: 200,
  });
  res.json(records);
});

// Every guard-logged observation — whether tied to a checkpoint/assignment or standalone
// (assignmentId null) — surfaced in one place for the Security Manager to triage, since
// standalone observations don't appear anywhere in the assignments list.
router.get("/observations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const observations = await prisma.patrolLogEntry.findMany({
    where: {
      category: { not: null },
      site: { mineId },
      siteId: siteId || undefined,
    },
    select: observationSelect,
    orderBy: { loggedAt: "desc" },
    take: 200,
  });
  res.json(observations);
});

const scheduleGenerateSchema = z.object({
  siteId: z.string().min(1),
  workerIds: z.array(z.string()).min(1),
  routeIds: z.array(z.string()).min(1),
  startDate: z.coerce.date(),
  days: z.coerce.number().int().min(1).max(31),
});

// Auto-generates patrol assignments for the given guards over the given date range,
// rotating each guard through the selected routes so coverage doesn't need to be
// entered by hand one day at a time. Never overwrites a day a guard is already
// assigned on.
router.post("/schedule/generate", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = scheduleGenerateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { siteId, workerIds, routeIds, startDate, days } = parsed.data;

  const site = await prisma.site.findFirst({ where: { id: siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const [workers, routes] = await Promise.all([
    prisma.worker.findMany({ where: { id: { in: workerIds }, siteId, category: "SECURITY" } }),
    prisma.patrolRoute.findMany({ where: { id: { in: routeIds }, siteId, isActive: true } }),
  ]);
  if (workers.length === 0 || routes.length === 0) {
    return res.status(400).json({ error: "Select at least one guard and one active route" });
  }

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + days);

  const existing = await prisma.patrolAssignment.findMany({
    where: { siteId, workerId: { in: workers.map((w) => w.id) }, shiftDate: { gte: rangeStart, lt: rangeEnd } },
    select: { workerId: true, shiftDate: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.workerId}|${e.shiftDate.toISOString().slice(0, 10)}`));

  const toCreate: { routeId: string; workerId: string; siteId: string; shiftDate: Date; assignedById: string }[] = [];
  for (let day = 0; day < days; day++) {
    const shiftDate = new Date(rangeStart);
    shiftDate.setDate(shiftDate.getDate() + day);
    workers.forEach((worker, i) => {
      const key = `${worker.id}|${shiftDate.toISOString().slice(0, 10)}`;
      if (existingKeys.has(key)) return;
      const route = routes[(day + i) % routes.length];
      toCreate.push({ routeId: route.id, workerId: worker.id, siteId, shiftDate, assignedById: req.auth!.userId });
    });
  }
  if (toCreate.length > 0) await prisma.patrolAssignment.createMany({ data: toCreate });
  res.status(201).json({ created: toCreate.length, skipped: workers.length * days - toCreate.length });
});

router.get("/routes", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const routes = await prisma.patrolRoute.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: routeSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(routes);
});

router.post("/routes", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const { checkpoints, ...routeData } = parsed.data;
  const route = await prisma.patrolRoute.create({
    data: {
      ...routeData,
      createdById: req.auth!.userId,
      checkpoints: { create: checkpoints.map((c, i) => ({ ...c, sequence: i + 1 })) },
    },
    select: routeSelect,
  });
  res.status(201).json(route);
});

router.put("/routes/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.patrolRoute.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Patrol route not found" });

  const { checkpoints, ...routeData } = parsed.data;
  // Checkpoints are replaced wholesale on edit rather than diffed — routes are short
  // lists (a handful of stops), so this is simpler and safer than reconciling
  // in-progress patrol logs against renamed/reordered checkpoint ids.
  const route = await prisma.$transaction(async (tx) => {
    await tx.patrolCheckpoint.deleteMany({ where: { routeId: existing.id } });
    return tx.patrolRoute.update({
      where: { id: existing.id },
      data: {
        ...routeData,
        checkpoints: { create: checkpoints.map((c, i) => ({ ...c, sequence: i + 1 })) },
      },
      select: routeSelect,
    });
  });
  res.json(route);
});

router.delete("/routes/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.patrolRoute.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Patrol route not found" });
  await prisma.patrolRoute.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/assignments", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const workerId = req.query.workerId as string | undefined;
  const assignments = await prisma.patrolAssignment.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, workerId: workerId || undefined },
    select: assignmentSelect,
    orderBy: { shiftDate: "desc" },
  });
  res.json(assignments);
});

router.post("/assignments", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const route = await prisma.patrolRoute.findFirst({ where: { id: parsed.data.routeId, siteId: parsed.data.siteId, site: { mineId } } });
  if (!route) return res.status(404).json({ error: "Patrol route not found for this site" });
  const guard = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, siteId: parsed.data.siteId, category: "SECURITY" } });
  if (!guard) return res.status(404).json({ error: "Security worker not found at this site" });

  const assignment = await prisma.patrolAssignment.create({
    data: { ...parsed.data, assignedById: req.auth!.userId },
    select: assignmentSelect,
  });
  res.status(201).json(assignment);
});

router.put("/assignments/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assignmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.patrolAssignment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Patrol assignment not found" });
  const assignment = await prisma.patrolAssignment.update({
    where: { id: existing.id },
    data: parsed.data,
    select: assignmentSelect,
  });
  res.json(assignment);
});

router.delete("/assignments/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.patrolAssignment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Patrol assignment not found" });
  await prisma.patrolAssignment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
