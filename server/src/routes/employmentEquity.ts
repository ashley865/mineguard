import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const targetSchema = z.object({
  reportingYear: z.coerce.number().int(),
  occupationalLevel: z.enum([
    "TOP_MANAGEMENT",
    "SENIOR_MANAGEMENT",
    "PROFESSIONALLY_QUALIFIED",
    "SKILLED_TECHNICAL",
    "SEMI_SKILLED",
    "UNSKILLED",
  ]),
  designatedGroup: z.enum(["AFRICAN", "COLOURED", "INDIAN", "WHITE", "FOREIGN_NATIONAL"]),
  gender: z.string().min(1),
  targetPercent: z.coerce.number().min(0).max(100),
  actualHeadcount: z.coerce.number().int().min(0).optional(),
  totalHeadcountAtLevel: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const charterElementSchema = z.object({
  reportingYear: z.coerce.number().int(),
  elementName: z.string().min(1),
  targetPercent: z.coerce.number().optional().nullable(),
  actualPercent: z.coerce.number().optional().nullable(),
  status: z.enum(["ON_TRACK", "AT_RISK", "NOT_MET", "MET"]).optional(),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.get("/targets", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const reportingYear = req.query.reportingYear as string | undefined;
  const targets = await prisma.employmentEquityTarget.findMany({
    where: { mineId, reportingYear: reportingYear ? Number(reportingYear) : undefined },
    orderBy: [{ reportingYear: "desc" }, { occupationalLevel: "asc" }],
  });
  res.json(targets);
});

router.post("/targets", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = targetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const target = await prisma.employmentEquityTarget.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(target);
});

router.put("/targets/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = targetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.employmentEquityTarget.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Target not found" });
  const target = await prisma.employmentEquityTarget.update({ where: { id: existing.id }, data: parsed.data });
  res.json(target);
});

router.delete("/targets/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.employmentEquityTarget.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Target not found" });
  await prisma.employmentEquityTarget.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/charter-elements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const reportingYear = req.query.reportingYear as string | undefined;
  const elements = await prisma.miningCharterElement.findMany({
    where: { mineId, reportingYear: reportingYear ? Number(reportingYear) : undefined },
    orderBy: [{ reportingYear: "desc" }, { elementName: "asc" }],
  });
  res.json(elements);
});

router.post("/charter-elements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = charterElementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const element = await prisma.miningCharterElement.create({ data: { ...parsed.data, mineId } });
  res.status(201).json(element);
});

router.put("/charter-elements/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = charterElementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.miningCharterElement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Element not found" });
  const element = await prisma.miningCharterElement.update({ where: { id: existing.id }, data: parsed.data });
  res.json(element);
});

router.delete("/charter-elements/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.miningCharterElement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Element not found" });
  await prisma.miningCharterElement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// HDSA/BEE procurement spend, computed live from the existing Supplier.bbbeeLevel field
// and PurchaseOrder totals rather than duplicating that data into a new table.
router.get("/procurement-spend", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const orders = await prisma.purchaseOrder.findMany({
    where: { site: { mineId }, status: { in: ["APPROVED", "ORDERED", "RECEIVED"] } },
    select: { totalAmount: true, supplier: { select: { bbbeeLevel: true } } },
  });
  const totalSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const bbbeeSpend = orders
    .filter((o) => o.supplier?.bbbeeLevel && o.supplier.bbbeeLevel !== "")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  res.json({
    totalSpend,
    bbbeeRatedSpend: bbbeeSpend,
    bbbeeRatedSpendPercent: totalSpend > 0 ? (bbbeeSpend / totalSpend) * 100 : 0,
  });
});

export default router;
