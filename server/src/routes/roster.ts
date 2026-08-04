import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const rosterSchema = z.object({
  siteId: z.string().min(1),
  shiftDate: z.coerce.date(),
  shiftType: z.enum(["DAY", "AFTERNOON", "NIGHT"]),
  notes: z.string().optional(),
});

const assignmentSchema = z.object({
  workerId: z.string().min(1),
  position: z.string().optional(),
});

const rosterSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  shiftDate: true,
  shiftType: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  assignments: {
    select: {
      id: true,
      position: true,
      worker: { select: { id: true, name: true, employeeId: true, role: true } },
    },
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const rosters = await prisma.shiftRoster.findMany({
    where: {
      site: { mineId },
      siteId: siteId || undefined,
      shiftDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    select: rosterSelect,
    orderBy: { shiftDate: "asc" },
  });
  res.json(rosters);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = rosterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  try {
    const roster = await prisma.shiftRoster.create({
      data: { ...parsed.data, createdById: req.auth!.userId },
      select: rosterSelect,
    });
    res.status(201).json(roster);
  } catch {
    res.status(409).json({ error: "A roster already exists for this site, date, and shift" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.shiftRoster.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Roster not found" });
  await prisma.shiftRoster.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/assignments", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const roster = await prisma.shiftRoster.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!roster) return res.status(404).json({ error: "Roster not found" });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  try {
    await prisma.rosterAssignment.create({ data: { rosterId: roster.id, ...parsed.data } });
    const updated = await prisma.shiftRoster.findUnique({ where: { id: roster.id }, select: rosterSelect });
    res.status(201).json(updated);
  } catch {
    res.status(409).json({ error: "This worker is already assigned to this roster" });
  }
});

router.delete("/assignments/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.rosterAssignment.findFirst({ where: { id: req.params.id, roster: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Assignment not found" });
  await prisma.rosterAssignment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
