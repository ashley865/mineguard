import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const magazineSchema = z.object({
  siteId: z.string().min(1),
  magazineNumber: z.string().min(1),
  licenseNumber: z.string().min(1),
  licenseExpiry: z.coerce.date(),
  capacity: z.coerce.number().positive(),
  unit: z.string().min(1),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED"]).optional(),
});

const transactionSchema = z.object({
  magazineId: z.string().min(1),
  transactionType: z.enum(["RECEIPT", "ISSUE", "RETURN", "DESTRUCTION"]),
  explosiveType: z.string().min(1),
  quantity: z.coerce.number().positive(),
  issuedTo: z.string().optional(),
  transactionDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const magazineSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  magazineNumber: true,
  licenseNumber: true,
  licenseExpiry: true,
  capacity: true,
  unit: true,
  currentStock: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  status: true,
  createdAt: true,
} as const;

const transactionSelect = {
  id: true,
  magazineId: true,
  magazine: { select: { id: true, magazineNumber: true, unit: true } },
  transactionType: true,
  explosiveType: true,
  quantity: true,
  issuedTo: true,
  authorizedBy: { select: { id: true, name: true } },
  transactionDate: true,
  notes: true,
  createdAt: true,
} as const;

const blastLogSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  magazineId: z.string().optional().nullable(),
  shotFirerId: z.string().optional().nullable(),
  blastDate: z.coerce.date(),
  explosiveType: z.string().min(1),
  quantityUsed: z.coerce.number().positive(),
  unit: z.string().min(1),
  numberOfHoles: z.coerce.number().int().optional().nullable(),
  misfireOccurred: z.coerce.boolean().optional(),
  misfireResolution: z.string().optional(),
  sapsNotified: z.coerce.boolean().optional(),
  status: z.enum(["PLANNED", "FIRED", "MISFIRE", "CANCELLED"]).optional(),
  notes: z.string().optional(),
});

const blastLogSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  magazineId: true,
  magazine: { select: { id: true, magazineNumber: true } },
  shotFirerId: true,
  shotFirer: { select: { id: true, name: true } },
  blastDate: true,
  explosiveType: true,
  quantityUsed: true,
  unit: true,
  numberOfHoles: true,
  misfireOccurred: true,
  misfireResolution: true,
  clearanceGivenBy: { select: { id: true, name: true } },
  clearanceTime: true,
  sapsNotified: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/magazines", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const magazines = await prisma.explosivesMagazine.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: magazineSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(magazines);
});

router.post("/magazines", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = magazineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const magazine = await prisma.explosivesMagazine.create({ data: parsed.data, select: magazineSelect });
  res.status(201).json(magazine);
});

router.put("/magazines/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = magazineSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.explosivesMagazine.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Magazine not found" });
  const magazine = await prisma.explosivesMagazine.update({ where: { id: existing.id }, data: parsed.data, select: magazineSelect });
  res.json(magazine);
});

router.delete("/magazines/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.explosivesMagazine.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Magazine not found" });
  await prisma.explosivesMagazine.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/transactions", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const magazineId = req.query.magazineId as string | undefined;
  const transactions = await prisma.explosivesTransaction.findMany({
    where: { magazine: { site: { mineId } }, magazineId: magazineId || undefined },
    select: transactionSelect,
    orderBy: { transactionDate: "desc" },
  });
  res.json(transactions);
});

router.post("/transactions", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const magazine = await prisma.explosivesMagazine.findFirst({ where: { id: parsed.data.magazineId, site: { mineId } } });
  if (!magazine) return res.status(404).json({ error: "Magazine not found" });

  const increases = parsed.data.transactionType === "RECEIPT" || parsed.data.transactionType === "RETURN";
  const delta = increases ? parsed.data.quantity : -parsed.data.quantity;
  if (!increases && magazine.currentStock < parsed.data.quantity) {
    return res.status(409).json({ error: "Not enough stock in this magazine for this transaction" });
  }
  if (increases && magazine.currentStock + parsed.data.quantity > magazine.capacity) {
    return res.status(409).json({ error: "This transaction would exceed the magazine's licensed capacity" });
  }

  const [transaction] = await prisma.$transaction([
    prisma.explosivesTransaction.create({
      data: { ...parsed.data, authorizedById: req.auth!.userId },
      select: transactionSelect,
    }),
    prisma.explosivesMagazine.update({ where: { id: magazine.id }, data: { currentStock: { increment: delta } } }),
  ]);
  res.status(201).json(transaction);
});

router.get("/blast-logs", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const logs = await prisma.blastLog.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: blastLogSelect,
    orderBy: { blastDate: "desc" },
  });
  res.json(logs);
});

router.post("/blast-logs", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = blastLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  // A blast may only be logged against a worker holding an active blasting certificate of
  // competence (MHSA blasting regulations) — this is the one place the module enforces that.
  if (parsed.data.shotFirerId) {
    const shotFirerCert = await prisma.certificate.findFirst({
      where: { workerId: parsed.data.shotFirerId, type: "BLASTING", status: "ACTIVE" },
    });
    if (!shotFirerCert) {
      return res.status(409).json({ error: "The nominated shot-firer has no active blasting certificate of competence on file" });
    }
  }

  const log = await prisma.blastLog.create({ data: parsed.data, select: blastLogSelect });
  res.status(201).json(log);
});

router.put("/blast-logs/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = blastLogSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.blastLog.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Blast log not found" });
  const log = await prisma.blastLog.update({ where: { id: existing.id }, data: parsed.data, select: blastLogSelect });
  res.json(log);
});

router.post("/blast-logs/:id/clearance", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.blastLog.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Blast log not found" });
  const log = await prisma.blastLog.update({
    where: { id: existing.id },
    data: { clearanceGivenById: req.auth!.userId, clearanceTime: new Date() },
    select: blastLogSelect,
  });
  res.json(log);
});

router.delete("/blast-logs/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.blastLog.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Blast log not found" });
  await prisma.blastLog.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
