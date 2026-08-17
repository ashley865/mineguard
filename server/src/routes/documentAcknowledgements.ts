import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const ackSchema = z.object({
  documentId: z.string().min(1),
  workerId: z.string().min(1),
  acknowledgedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const ackSelect = {
  id: true,
  documentId: true,
  document: { select: { id: true, title: true, type: true, version: true } },
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  acknowledgedDate: true,
  notes: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const documentId = req.query.documentId as string | undefined;
  const acknowledgements = await prisma.documentAcknowledgement.findMany({
    where: { document: { mineId }, documentId: documentId || undefined },
    select: ackSelect,
    orderBy: { acknowledgedDate: "desc" },
  });
  res.json(acknowledgements);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [document, worker] = await Promise.all([
    prisma.document.findFirst({ where: { id: parsed.data.documentId, mineId } }),
    prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } }),
  ]);
  if (!document) return res.status(404).json({ error: "Document not found" });
  if (!worker) return res.status(404).json({ error: "Worker not found" });

  const existing = await prisma.documentAcknowledgement.findFirst({
    where: { documentId: parsed.data.documentId, workerId: parsed.data.workerId },
  });
  if (existing) return res.status(409).json({ error: "This worker has already acknowledged this document" });

  const ack = await prisma.documentAcknowledgement.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: ackSelect,
  });
  res.status(201).json(ack);
});

router.delete("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.documentAcknowledgement.findFirst({ where: { id: req.params.id, document: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Acknowledgement not found" });
  await prisma.documentAcknowledgement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
