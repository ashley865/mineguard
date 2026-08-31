import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const tenureTypeEnum = z.enum(["SURFACE_RIGHTS_LEASE", "SERVITUDE", "PERMISSION_TO_OCCUPY", "RESETTLEMENT_AGREEMENT", "OTHER"]);
const agreementStatusEnum = z.enum(["DRAFT", "NEGOTIATING", "SIGNED", "EXPIRED", "TERMINATED"]);
const resettlementStatusEnum = z.enum(["IDENTIFIED", "CONSULTATION", "COMPENSATION_AGREED", "RELOCATED", "LIVELIHOOD_RESTORED", "CLOSED"]);

const agreementSchema = z.object({
  siteId: z.string().optional().nullable(),
  parcelReference: z.string().optional(),
  counterpartyName: z.string().min(1),
  tenureType: tenureTypeEnum,
  areaHectares: z.coerce.number().min(0).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  annualPaymentAmount: z.coerce.number().min(0).optional().nullable(),
  status: agreementStatusEnum.optional(),
  notes: z.string().optional(),
});

const resettlementSchema = z.object({
  landAgreementId: z.string().optional().nullable(),
  householdName: z.string().min(1),
  householdSize: z.coerce.number().int().min(0).optional().nullable(),
  status: resettlementStatusEnum.optional(),
  compensationAmount: z.coerce.number().min(0).optional().nullable(),
  compensationPaidAt: z.coerce.date().optional().nullable(),
  relocationDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const agreementSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  parcelReference: true,
  counterpartyName: true,
  tenureType: true,
  areaHectares: true,
  startDate: true,
  expiryDate: true,
  annualPaymentAmount: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const resettlementSelect = {
  id: true,
  landAgreementId: true,
  landAgreement: { select: { id: true, counterpartyName: true, parcelReference: true } },
  householdName: true,
  householdSize: true,
  status: true,
  compensationAmount: true,
  compensationPaidAt: true,
  relocationDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

router.use(requireAuth);

router.get("/agreements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const agreements = await prisma.landAgreement.findMany({
    where: { mineId },
    select: agreementSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(agreements);
});

router.post("/agreements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = agreementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const agreement = await prisma.landAgreement.create({ data: { ...parsed.data, mineId }, select: agreementSelect });
  res.status(201).json(agreement);
});

router.put("/agreements/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = agreementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.landAgreement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agreement not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const agreement = await prisma.landAgreement.update({ where: { id: existing.id }, data: parsed.data, select: agreementSelect });
  res.json(agreement);
});

router.delete("/agreements/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.landAgreement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agreement not found" });
  await prisma.landAgreement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/resettlement-cases", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const cases = await prisma.resettlementCase.findMany({
    where: { mineId },
    select: resettlementSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(cases);
});

router.post("/resettlement-cases", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = resettlementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.landAgreementId) {
    const agreement = await prisma.landAgreement.findFirst({ where: { id: parsed.data.landAgreementId, mineId } });
    if (!agreement) return res.status(404).json({ error: "Land agreement not found" });
  }
  const resettlementCase = await prisma.resettlementCase.create({ data: { ...parsed.data, mineId }, select: resettlementSelect });
  res.status(201).json(resettlementCase);
});

router.put("/resettlement-cases/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = resettlementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.resettlementCase.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Resettlement case not found" });
  if (parsed.data.landAgreementId) {
    const agreement = await prisma.landAgreement.findFirst({ where: { id: parsed.data.landAgreementId, mineId } });
    if (!agreement) return res.status(404).json({ error: "Land agreement not found" });
  }
  const resettlementCase = await prisma.resettlementCase.update({ where: { id: existing.id }, data: parsed.data, select: resettlementSelect });
  res.json(resettlementCase);
});

router.delete("/resettlement-cases/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.resettlementCase.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Resettlement case not found" });
  await prisma.resettlementCase.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
