import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  targetLevel: z.enum(["NOVICE", "COMPETENT", "PROFICIENT", "EXPERT"]).optional().nullable(),
});

const ratingSchema = z.object({
  workerId: z.string().min(1),
  skillId: z.string().min(1),
  level: z.enum(["NOVICE", "COMPETENT", "PROFICIENT", "EXPERT"]),
  assessedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.get("/skills", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const skills = await prisma.skill.findMany({ where: { mineId }, orderBy: { name: "asc" } });
  res.json(skills);
});

router.post("/skills", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = skillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.skill.findFirst({ where: { mineId, name: parsed.data.name } });
  if (existing) return res.status(409).json({ error: "A skill with this name already exists" });
  const skill = await prisma.skill.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(skill);
});

router.put("/skills/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = skillSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.skill.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Skill not found" });
  if (parsed.data.name) {
    const nameClash = await prisma.skill.findFirst({ where: { mineId, name: parsed.data.name, id: { not: existing.id } } });
    if (nameClash) return res.status(409).json({ error: "A skill with this name already exists" });
  }
  const skill = await prisma.skill.update({ where: { id: existing.id }, data: parsed.data });
  res.json(skill);
});

router.delete("/skills/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.skill.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Skill not found" });
  await prisma.skill.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/ratings", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const ratings = await prisma.workerSkillRating.findMany({
    where: { worker: { site: { mineId } } },
    select: {
      id: true,
      workerId: true,
      worker: { select: { id: true, name: true, employeeId: true } },
      skillId: true,
      skill: { select: { id: true, name: true, category: true } },
      level: true,
      assessedDate: true,
      notes: true,
      assessedBy: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  res.json(ratings);
});

// A worker can only have one current rating per skill — re-assessing simply
// overwrites the previous rating rather than piling up a history table.
router.put("/ratings", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [worker, skill] = await Promise.all([
    prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } }),
    prisma.skill.findFirst({ where: { id: parsed.data.skillId, mineId } }),
  ]);
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  if (!skill) return res.status(404).json({ error: "Skill not found" });

  const rating = await prisma.workerSkillRating.upsert({
    where: { workerId_skillId: { workerId: parsed.data.workerId, skillId: parsed.data.skillId } },
    create: { ...parsed.data, assessedById: req.auth!.userId },
    update: {
      level: parsed.data.level,
      assessedDate: parsed.data.assessedDate,
      notes: parsed.data.notes,
      assessedById: req.auth!.userId,
    },
  });
  res.json(rating);
});

router.delete("/ratings/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.workerSkillRating.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Rating not found" });
  await prisma.workerSkillRating.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
