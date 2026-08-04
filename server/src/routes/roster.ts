import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const rosters = await prisma.shiftRoster.findMany({
    where: {
      siteId: siteId || undefined,
      shiftDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    select: rosterSelect,
    orderBy: { shiftDate: "asc" },
  });
  res.json(rosters);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = rosterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
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
  try {
    await prisma.shiftRoster.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Roster not found" });
  }
});

router.post("/:id/assignments", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const roster = await prisma.shiftRoster.findUnique({ where: { id: req.params.id } });
  if (!roster) return res.status(404).json({ error: "Roster not found" });
  try {
    await prisma.rosterAssignment.create({ data: { rosterId: roster.id, ...parsed.data } });
    const updated = await prisma.shiftRoster.findUnique({ where: { id: roster.id }, select: rosterSelect });
    res.status(201).json(updated);
  } catch {
    res.status(409).json({ error: "This worker is already assigned to this roster" });
  }
});

router.delete("/assignments/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.rosterAssignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Assignment not found" });
  }
});

export default router;
