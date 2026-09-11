import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const licenceSchema = z.object({
  siteId: z.string().min(1),
  licenceNumber: z.string().min(1),
  issuingAuthority: z.string().optional(),
  issueDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "UNDER_REVIEW"]).optional(),
  conditionsSummary: z.string().optional(),
  notes: z.string().optional(),
});

const stackTestSchema = z.object({
  testDate: z.coerce.date(),
  stackName: z.string().min(1),
  pollutant: z.string().min(1),
  measuredValue: z.number(),
  unit: z.string().min(1),
  licensedLimit: z.number().optional().nullable(),
  compliant: z.boolean().optional(),
  testingAuthority: z.string().optional(),
  certificateNumber: z.string().optional(),
  nextTestDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const dustReadingSchema = z.object({
  siteId: z.string().min(1),
  monitoringPoint: z.string().min(1),
  readingMonth: z.coerce.date(),
  dustFalloutRate: z.number().nonnegative(),
  thresholdMgM2Day: z.number().nonnegative().optional().nullable(),
  withinLimit: z.boolean().optional(),
  notes: z.string().optional(),
});

const licenceSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  licenceNumber: true,
  issuingAuthority: true,
  issueDate: true,
  expiryDate: true,
  status: true,
  conditionsSummary: true,
  notes: true,
  stackTests: {
    select: {
      id: true,
      testDate: true,
      stackName: true,
      pollutant: true,
      measuredValue: true,
      unit: true,
      licensedLimit: true,
      compliant: true,
      testingAuthority: true,
      certificateNumber: true,
      nextTestDue: true,
      notes: true,
    },
    orderBy: { testDate: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

// --- Emission licences -----------------------------------------------------

router.get("/licences", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const licences = await prisma.emissionLicence.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: licenceSelect,
    orderBy: { licenceNumber: "asc" },
  });
  res.json(licences);
});

router.post("/licences", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = licenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const licence = await prisma.emissionLicence.create({ data: parsed.data, select: licenceSelect });
  res.status(201).json(licence);
});

router.put("/licences/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = licenceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.emissionLicence.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Emission licence not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const licence = await prisma.emissionLicence.update({ where: { id: existing.id }, data: parsed.data, select: licenceSelect });
  res.json(licence);
});

router.delete("/licences/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.emissionLicence.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Emission licence not found" });
  await prisma.emissionLicence.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/licences/:id/stack-tests", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const licence = await prisma.emissionLicence.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!licence) return res.status(404).json({ error: "Emission licence not found" });
  const tests = await prisma.stackEmissionTest.findMany({ where: { emissionLicenceId: licence.id }, orderBy: { testDate: "desc" } });
  res.json(tests);
});

router.post("/licences/:id/stack-tests", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = stackTestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const licence = await prisma.emissionLicence.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!licence) return res.status(404).json({ error: "Emission licence not found" });

  const d = parsed.data;
  // Compliance is derived when a licensed limit is on record rather than trusted
  // blindly from the submitted flag — the whole point of storing the limit
  // alongside the measurement is that the two can be checked against each other.
  const compliant = d.licensedLimit != null ? d.measuredValue <= d.licensedLimit : d.compliant ?? true;
  const test = await prisma.stackEmissionTest.create({ data: { ...d, compliant, emissionLicenceId: licence.id } });
  res.status(201).json(test);
});

router.delete("/stack-tests/:testId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.stackEmissionTest.findFirst({
    where: { id: req.params.testId, emissionLicence: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Stack test not found" });
  await prisma.stackEmissionTest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// --- Dust fallout ------------------------------------------------------------

router.get("/dust-fallout", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const readings = await prisma.dustFalloutReading.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { readingMonth: "desc" },
    take: 500,
  });
  res.json(readings);
});

router.post("/dust-fallout", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = dustReadingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const d = parsed.data;
  const withinLimit = d.thresholdMgM2Day != null ? d.dustFalloutRate <= d.thresholdMgM2Day : d.withinLimit ?? true;
  const reading = await prisma.dustFalloutReading.create({ data: { ...d, withinLimit } });
  res.status(201).json(reading);
});

router.delete("/dust-fallout/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.dustFalloutReading.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Reading not found" });
  await prisma.dustFalloutReading.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
