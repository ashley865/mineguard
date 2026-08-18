import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const backupSchema = z.object({
  systemName: z.string().min(1),
  schedule: z.string().optional(),
  retentionDays: z.coerce.number().int().positive().optional(),
  lastRunAt: z.coerce.date().optional().nullable(),
  lastRunStatus: z.enum(["SUCCESS", "FAILED", "PARTIAL", "NOT_RUN"]).optional(),
  lastDrTestDate: z.coerce.date().optional().nullable(),
  lastDrTestResult: z.enum(["PASSED", "FAILED", "NOT_TESTED"]).optional(),
  notes: z.string().optional(),
});

const backupSelect = {
  id: true,
  systemName: true,
  schedule: true,
  retentionDays: true,
  lastRunAt: true,
  lastRunStatus: true,
  lastDrTestDate: true,
  lastDrTestResult: true,
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const records = await prisma.iTBackupRecord.findMany({
    where: { mineId },
    select: backupSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(records);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = backupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const record = await prisma.iTBackupRecord.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: backupSelect,
  });
  res.status(201).json(record);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = backupSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTBackupRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Backup record not found" });
  const record = await prisma.iTBackupRecord.update({ where: { id: existing.id }, data: parsed.data, select: backupSelect });
  res.json(record);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTBackupRecord.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Backup record not found" });
  await prisma.iTBackupRecord.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
