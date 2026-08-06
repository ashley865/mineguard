import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const auditFindingSchema = z.object({
  siteId: z.string().min(1),
  findingNumber: z.string().min(1),
  requirementViolated: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(1),
  evidence: z.string().optional().nullable(),
  responsiblePersonId: z.string().optional().nullable(),
  correctiveAction: z.string().min(1),
  dueDate: z.coerce.date(),
  status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_VERIFICATION", "VERIFIED", "CLOSED", "OVERDUE"]).optional(),
  verificationNotes: z.string().optional().nullable(),
  closureDate: z.coerce.date().optional().nullable(),
});

const auditFindingSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  findingNumber: true,
  requirementViolated: true,
  severity: true,
  description: true,
  evidence: true,
  responsiblePersonId: true,
  responsiblePerson: { select: { id: true, name: true } },
  correctiveAction: true,
  dueDate: true,
  status: true,
  verificationNotes: true,
  verifiedBy: { select: { id: true, name: true } },
  verifiedAt: true,
  closureDate: true,
  closedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/responsible-people", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const people = await prisma.user.findMany({
    where: { mineId, role: { in: ["ADMIN", "SUPERVISOR", "EXECUTIVE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(people);
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await prisma.auditFinding.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: auditFindingSelect,
    orderBy: { dueDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = auditFindingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }
  const item = await prisma.auditFinding.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: auditFindingSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = auditFindingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.auditFinding.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Finding not found" });
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }

  // Verification and closure are accountability steps in their own right, so stamp who
  // performed them and when the moment status actually reaches that stage, rather than
  // trusting the client to send a timestamp/actor along with the rest of the form.
  const extra: { verifiedById?: string; verifiedAt?: Date; closedById?: string; closureDate?: Date } = {};
  if (parsed.data.status === "VERIFIED" && existing.status !== "VERIFIED") {
    extra.verifiedById = req.auth!.userId;
    extra.verifiedAt = new Date();
  }
  if (parsed.data.status === "CLOSED" && existing.status !== "CLOSED") {
    extra.closedById = req.auth!.userId;
    if (!parsed.data.closureDate) extra.closureDate = new Date();
  }

  const item = await prisma.auditFinding.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...extra },
    select: auditFindingSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.auditFinding.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Finding not found" });
  await prisma.auditFinding.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
