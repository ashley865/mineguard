import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const ppeTypeEnum = z.enum([
  "HARD_HAT",
  "SAFETY_BOOTS",
  "HI_VIS_VEST",
  "SAFETY_GLASSES",
  "HEARING_PROTECTION",
  "RESPIRATOR",
  "GLOVES",
  "FALL_PROTECTION_HARNESS",
  "FACE_SHIELD",
  "DUST_MASK",
  "OTHER",
]);

const ppeSchema = z.object({
  workerId: z.string().min(1),
  ppeType: ppeTypeEnum,
  isRequired: z.coerce.boolean().optional(),
  isIssued: z.coerce.boolean().optional(),
  issuedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ppeSelect = {
  id: true,
  workerId: true,
  ppeType: true,
  isRequired: true,
  isIssued: true,
  issuedDate: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/ppe", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.workerPpeRequirement.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    select: ppeSelect,
    orderBy: { ppeType: "asc" },
  });
  res.json(items);
});

// One row per worker+PPE type: re-recording an existing type updates it in place
// (e.g. marking it issued) instead of creating a duplicate checklist entry.
router.post("/ppe", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ppeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const { workerId, ppeType, ...rest } = parsed.data;
  const item = await prisma.workerPpeRequirement.upsert({
    where: { workerId_ppeType: { workerId, ppeType } },
    create: { workerId, ppeType, ...rest, createdById: req.auth!.userId },
    update: rest,
    select: ppeSelect,
  });
  res.status(201).json(item);
});

router.put("/ppe/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ppeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.workerPpeRequirement.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "PPE requirement not found" });
  const { workerId, ppeType, ...rest } = parsed.data;
  const item = await prisma.workerPpeRequirement.update({ where: { id: existing.id }, data: rest, select: ppeSelect });
  res.json(item);
});

router.delete("/ppe/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.workerPpeRequirement.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "PPE requirement not found" });
  await prisma.workerPpeRequirement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Connects safety to the workforce module: one row per worker pulling together training,
// certifications, the latest compliance check, PPE issuance, and (deliberately minimal —
// fitness result and next exam date only, not restrictions/practitioner) medical fitness,
// so expired/expiring items and gaps are visible at a glance instead of siloed across tabs.
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;

  const workers = await prisma.worker.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: { id: true, name: true, employeeId: true, category: true, siteId: true },
    orderBy: { name: "asc" },
  });
  const workerIds = workers.map((w) => w.id);

  const [certificates, trainingRecords, complianceChecks, medicalRecords, ppeRequirements] = await Promise.all([
    prisma.certificate.findMany({
      where: { workerId: { in: workerIds } },
      select: { workerId: true, expiryDate: true },
    }),
    prisma.trainingRecord.findMany({
      where: { workerId: { in: workerIds } },
      select: { workerId: true, expiryDate: true },
    }),
    prisma.employeeComplianceCheck.findMany({
      where: { workerId: { in: workerIds } },
      select: {
        workerId: true,
        isProperlyTrained: true,
        isCompetent: true,
        isCertified: true,
        isAuthorised: true,
        medicalFitness: true,
        isAssignedPermittedTasks: true,
        isTrainingUpToDate: true,
        assessmentDate: true,
      },
      orderBy: { assessmentDate: "desc" },
    }),
    prisma.medicalSurveillance.findMany({
      where: { workerId: { in: workerIds } },
      select: { workerId: true, result: true, nextExamDue: true, examDate: true },
      orderBy: { examDate: "desc" },
    }),
    prisma.workerPpeRequirement.findMany({ where: { workerId: { in: workerIds } }, select: ppeSelect }),
  ]);

  function bucket<T extends { workerId: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const arr = map.get(r.workerId) ?? [];
      arr.push(r);
      map.set(r.workerId, arr);
    }
    return map;
  }

  const certByWorker = bucket(certificates);
  const trainByWorker = bucket(trainingRecords);
  const complianceByWorker = bucket(complianceChecks);
  const medicalByWorker = bucket(medicalRecords);
  const ppeByWorker = bucket(ppeRequirements);

  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = (d: Date | null) => !!d && d.getTime() < now.getTime();
  const isExpiringSoon = (d: Date | null) => !!d && d.getTime() >= now.getTime() && d.getTime() <= soon.getTime();

  const summary = workers.map((w) => {
    const certs = certByWorker.get(w.id) ?? [];
    const training = trainByWorker.get(w.id) ?? [];
    const ppe = ppeByWorker.get(w.id) ?? [];
    return {
      worker: w,
      certificates: {
        total: certs.length,
        expired: certs.filter((c) => isExpired(c.expiryDate)).length,
        expiringSoon: certs.filter((c) => isExpiringSoon(c.expiryDate)).length,
      },
      training: {
        total: training.length,
        expired: training.filter((t) => isExpired(t.expiryDate)).length,
        expiringSoon: training.filter((t) => isExpiringSoon(t.expiryDate)).length,
      },
      compliance: (complianceByWorker.get(w.id) ?? [])[0] ?? null,
      medical: (medicalByWorker.get(w.id) ?? [])[0] ?? null,
      ppe: {
        total: ppe.length,
        missing: ppe.filter((p) => p.isRequired && !p.isIssued).length,
      },
    };
  });

  res.json(summary);
});

export default router;
