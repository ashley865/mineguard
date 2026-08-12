import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const itemSchema = z.object({
  siteId: z.string().optional().nullable(),
  category: z.enum(["MINING_RIGHT", "ENVIRONMENTAL", "WATER_USE", "LABOUR", "HEALTH_SAFETY", "TAX_LEVY", "OTHER"]),
  title: z.string().min(1),
  legislativeReference: z.string().optional(),
  dueDate: z.coerce.date(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(["UPCOMING", "DUE", "OVERDUE", "COMPLETED"]).optional(),
  notes: z.string().optional(),
});

const itemSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  category: true,
  title: true,
  legislativeReference: true,
  dueDate: true,
  owner: { select: { id: true, name: true } },
  status: true,
  completedAt: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/items", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const items = await prisma.legalComplianceItem.findMany({
    where: { mineId },
    select: itemSelect,
    orderBy: { dueDate: "asc" },
  });
  res.json(items);
});

router.post("/items", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const item = await prisma.legalComplianceItem.create({ data: { ...parsed.data, mineId }, select: itemSelect });
  res.status(201).json(item);
});

router.put("/items/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.legalComplianceItem.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Item not found" });
  const data = { ...parsed.data, completedAt: parsed.data.status === "COMPLETED" ? new Date() : existing.completedAt };
  const item = await prisma.legalComplianceItem.update({ where: { id: existing.id }, data, select: itemSelect });
  res.json(item);
});

router.delete("/items/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.legalComplianceItem.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Item not found" });
  await prisma.legalComplianceItem.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// The single-source-of-truth compliance calendar: merges manually-tracked LegalComplianceItem
// deadlines with expiry dates already captured on Permit, Certificate, MedicalSurveillance and
// ExplosivesMagazine, so nobody has to check five different modules to see what's coming due.
router.get("/calendar", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const withinDays = Math.min(Number(req.query.withinDays) || 90, 730);
  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

  const [items, permits, certificates, medicals, magazines] = await Promise.all([
    prisma.legalComplianceItem.findMany({
      where: { mineId, status: { not: "COMPLETED" }, dueDate: { lte: horizon } },
      select: itemSelect,
    }),
    prisma.permit.findMany({
      where: { site: { mineId }, expiryDate: { lte: horizon }, status: { not: "WITHDRAWN" } },
      select: { id: true, permitNumber: true, type: true, expiryDate: true, site: { select: { id: true, name: true } } },
    }),
    prisma.certificate.findMany({
      where: { worker: { site: { mineId } }, expiryDate: { lte: horizon }, status: "ACTIVE" },
      select: { id: true, type: true, certificateNumber: true, expiryDate: true, worker: { select: { id: true, name: true } } },
    }),
    prisma.medicalSurveillance.findMany({
      where: { worker: { site: { mineId } }, nextExamDue: { lte: horizon } },
      select: { id: true, examType: true, nextExamDue: true, worker: { select: { id: true, name: true } } },
    }),
    prisma.explosivesMagazine.findMany({
      where: { site: { mineId }, licenseExpiry: { lte: horizon }, status: { not: "EXPIRED" } },
      select: { id: true, magazineNumber: true, licenseExpiry: true, site: { select: { id: true, name: true } } },
    }),
  ]);

  const now = Date.now();
  const entries = [
    ...items.map((i) => ({
      source: "LEGAL_ITEM" as const,
      id: i.id,
      title: i.title,
      category: i.category,
      dueDate: i.dueDate,
      relatedTo: i.site?.name ?? "Mine-wide",
      overdue: i.dueDate.getTime() < now,
    })),
    ...permits.map((p) => ({
      source: "PERMIT" as const,
      id: p.id,
      title: `${p.type.replace(/_/g, " ")} — ${p.permitNumber}`,
      category: "MINING_RIGHT" as const,
      dueDate: p.expiryDate,
      relatedTo: p.site.name,
      overdue: p.expiryDate.getTime() < now,
    })),
    ...certificates.map((c) => ({
      source: "CERTIFICATE" as const,
      id: c.id,
      title: `${c.type.replace(/_/g, " ")} certificate — ${c.worker.name}`,
      category: "HEALTH_SAFETY" as const,
      dueDate: c.expiryDate as Date,
      relatedTo: c.worker.name,
      overdue: (c.expiryDate as Date).getTime() < now,
    })),
    ...medicals.map((m) => ({
      source: "MEDICAL_SURVEILLANCE" as const,
      id: m.id,
      title: `${m.examType.replace(/_/g, " ")} medical due — ${m.worker.name}`,
      category: "HEALTH_SAFETY" as const,
      dueDate: m.nextExamDue,
      relatedTo: m.worker.name,
      overdue: m.nextExamDue.getTime() < now,
    })),
    ...magazines.map((mg) => ({
      source: "EXPLOSIVES_MAGAZINE" as const,
      id: mg.id,
      title: `Explosives magazine licence — ${mg.magazineNumber}`,
      category: "HEALTH_SAFETY" as const,
      dueDate: mg.licenseExpiry,
      relatedTo: mg.site.name,
      overdue: mg.licenseExpiry.getTime() < now,
    })),
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  res.json({ withinDays, entries });
});

export default router;
