import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const claimSchema = z.object({
  incidentId: z.string().optional().nullable(),
  workerId: z.string().min(1),
  claimNumber: z.string().optional(),
  dateOfInjury: z.coerce.date(),
  natureOfInjury: z.string().min(1),
  wclForm2Filed: z.coerce.boolean().optional(),
  wclForm2FiledAt: z.coerce.date().optional().nullable(),
  firstMedicalReport: z.string().optional(),
  finalMedicalReport: z.string().optional(),
  status: z.enum(["REPORTED", "SUBMITTED", "UNDER_ASSESSMENT", "ACCEPTED", "REJECTED", "CLOSED"]).optional(),
  compensationAmount: z.coerce.number().optional().nullable(),
  payoutDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const claimSelect = {
  id: true,
  incidentId: true,
  incident: { select: { id: true, title: true, severity: true } },
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  claimNumber: true,
  dateOfInjury: true,
  natureOfInjury: true,
  wclForm2Filed: true,
  wclForm2FiledAt: true,
  firstMedicalReport: true,
  finalMedicalReport: true,
  status: true,
  compensationAmount: true,
  payoutDate: true,
  notes: true,
  reportedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const claims = await prisma.iodClaim.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    select: claimSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(claims);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  if (parsed.data.incidentId) {
    const incident = await prisma.incident.findFirst({ where: { id: parsed.data.incidentId, site: { mineId } } });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
  }
  const claim = await prisma.iodClaim.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
    select: claimSelect,
  });
  res.status(201).json(claim);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = claimSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iodClaim.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Claim not found" });
  const claim = await prisma.iodClaim.update({ where: { id: existing.id }, data: parsed.data, select: claimSelect });
  res.json(claim);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iodClaim.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Claim not found" });
  await prisma.iodClaim.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
