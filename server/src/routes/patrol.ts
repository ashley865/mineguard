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
  photoMimeType: true,
  notes: true,
  loggedAt: true,
} as const;

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
  if (!req.file) return res.status(400).json({ error: "A photo is required" });

  const entry = await prisma.patrolLogEntry.create({
    data: {
      assignmentId: assignment.id,
      notes: (req.body?.notes as string) || undefined,
      photoData: Uint8Array.from(req.file.buffer),
      photoMimeType: req.file.mimetype,
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
