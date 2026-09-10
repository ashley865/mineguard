import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const installationSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  identifier: z.string().min(1),
  installationType: z.enum([
    "SUBSTATION",
    "TRANSFORMER",
    "SWITCHGEAR",
    "DISTRIBUTION_BOARD",
    "MOTOR_CONTROL_CENTRE",
    "CABLE_RETICULATION",
    "EARTH_LEAKAGE_UNIT",
    "GENERATOR",
    "OTHER",
  ]),
  description: z.string().optional(),
  location: z.string().optional(),
  voltageRating: z.string().optional(),
  hazardousArea: z.boolean().optional(),
  exProtection: z
    .enum([
      "NONE",
      "FLAMEPROOF_D",
      "INCREASED_SAFETY_E",
      "INTRINSICALLY_SAFE_I",
      "PRESSURIZED_P",
      "ENCAPSULATION_M",
      "NON_SPARKING_N",
      "DUST_PROTECTION_T",
      "OTHER",
    ])
    .optional(),
  exCertificateNumber: z.string().optional(),
  exCertificateExpiry: z.coerce.date().optional().nullable(),
  earthLeakageProtected: z.boolean().optional(),
  cocNumber: z.string().optional(),
  cocIssuedDate: z.coerce.date().optional().nullable(),
  lastTestDate: z.coerce.date().optional().nullable(),
  nextTestDue: z.coerce.date().optional().nullable(),
  status: z.enum(["IN_SERVICE", "ISOLATED", "UNDER_REPAIR", "DECOMMISSIONED"]).optional(),
  notes: z.string().optional(),
});

const testSchema = z.object({
  testDate: z.coerce.date(),
  testType: z.enum(["EARTH_CONTINUITY", "EARTH_LEAKAGE", "INSULATION_RESISTANCE", "POLARITY", "EX_INSPECTION", "THERMOGRAPHIC"]),
  testedByName: z.string().min(1),
  result: z.enum(["PASS", "MARGINAL", "FAIL"]),
  measuredValue: z.number().optional().nullable(),
  unit: z.string().optional(),
  findings: z.string().optional(),
  nextTestDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const installationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  identifier: true,
  installationType: true,
  description: true,
  location: true,
  voltageRating: true,
  hazardousArea: true,
  exProtection: true,
  exCertificateNumber: true,
  exCertificateExpiry: true,
  earthLeakageProtected: true,
  cocNumber: true,
  cocIssuedDate: true,
  lastTestDate: true,
  nextTestDue: true,
  status: true,
  notes: true,
  tests: {
    select: {
      id: true,
      testDate: true,
      testType: true,
      testedByName: true,
      result: true,
      measuredValue: true,
      unit: true,
      findings: true,
      nextTestDue: true,
      notes: true,
    },
    orderBy: { testDate: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/installations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.electricalInstallation.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: installationSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(items);
});

router.post("/installations", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = installationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: site.id } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const item = await prisma.electricalInstallation.create({ data: parsed.data, select: installationSelect });
  res.status(201).json(item);
});

router.put("/installations/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = installationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.electricalInstallation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Installation not found" });
  const siteId = parsed.data.siteId ?? existing.siteId;
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found on this site" });
  }
  const item = await prisma.electricalInstallation.update({ where: { id: existing.id }, data: parsed.data, select: installationSelect });
  res.json(item);
});

router.delete("/installations/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.electricalInstallation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Installation not found" });
  await prisma.electricalInstallation.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/installations/:id/tests", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const item = await prisma.electricalInstallation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Installation not found" });
  const tests = await prisma.electricalTest.findMany({ where: { installationId: item.id }, orderBy: { testDate: "desc" } });
  res.json(tests);
});

/**
 * An Ex inspection rolls the Ex certificate rather than the general test dates —
 * explosion protection is certified on its own cycle and a routine earth test
 * says nothing about whether a flameproof enclosure's flame path is still intact.
 * A FAIL isolates the installation; MARGINAL is recorded but left in service,
 * because a reading drifting towards the limit is a maintenance signal, not a trip.
 */
router.post("/installations/:id/tests", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.electricalInstallation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Installation not found" });

  const d = parsed.data;
  const test = await prisma.electricalTest.create({ data: { ...d, installationId: item.id } });
  await prisma.electricalInstallation.update({
    where: { id: item.id },
    data:
      d.testType === "EX_INSPECTION"
        ? {
            ...(d.nextTestDue ? { exCertificateExpiry: d.nextTestDue } : {}),
            ...(d.result === "FAIL" ? { status: "ISOLATED" as const } : {}),
          }
        : {
            lastTestDate: d.testDate,
            nextTestDue: d.nextTestDue ?? item.nextTestDue,
            ...(d.result === "FAIL" ? { status: "ISOLATED" as const } : {}),
          },
  });
  res.status(201).json(test);
});

router.delete("/tests/:testId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.electricalTest.findFirst({
    where: { id: req.params.testId, installation: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Test not found" });
  await prisma.electricalTest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
