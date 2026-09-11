import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const instrumentSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  instrumentType: z.enum([
    "PORTABLE_MULTI_GAS",
    "METHANOMETER",
    "CO_DETECTOR",
    "OXYGEN_METER",
    "FLAME_SAFETY_LAMP",
    "ANEMOMETER",
    "DUST_PUMP",
    "OTHER",
  ]),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  assignedTo: z.string().optional(),
  lastCalibrationDate: z.coerce.date().optional().nullable(),
  nextCalibrationDue: z.coerce.date().optional().nullable(),
  lastBumpTestDate: z.coerce.date().optional().nullable(),
  nextBumpTestDue: z.coerce.date().optional().nullable(),
  status: z.enum(["IN_SERVICE", "OUT_OF_CALIBRATION", "UNDER_REPAIR", "WITHDRAWN"]).optional(),
  notes: z.string().optional(),
});

const calibrationSchema = z.object({
  calibrationDate: z.coerce.date(),
  calibrationType: z.enum(["FULL_CALIBRATION", "BUMP_TEST", "ZERO_CHECK", "SPAN_CHECK"]),
  performedByName: z.string().min(1),
  gasStandardUsed: z.string().optional(),
  result: z.enum(["PASS", "ADJUSTED", "FAIL"]).optional(),
  findings: z.string().optional(),
  nextDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const instrumentSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  identifier: true,
  instrumentType: true,
  manufacturer: true,
  serialNumber: true,
  assignedTo: true,
  lastCalibrationDate: true,
  nextCalibrationDue: true,
  lastBumpTestDate: true,
  nextBumpTestDue: true,
  status: true,
  notes: true,
  calibrations: {
    select: {
      id: true,
      calibrationDate: true,
      calibrationType: true,
      performedByName: true,
      gasStandardUsed: true,
      result: true,
      findings: true,
      nextDue: true,
      notes: true,
    },
    orderBy: { calibrationDate: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const instruments = await prisma.gasDetectionInstrument.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: instrumentSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(instruments);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = instrumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const instrument = await prisma.gasDetectionInstrument.create({ data: parsed.data, select: instrumentSelect });
  res.status(201).json(instrument);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = instrumentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.gasDetectionInstrument.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Instrument not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const instrument = await prisma.gasDetectionInstrument.update({
    where: { id: existing.id },
    data: parsed.data,
    select: instrumentSelect,
  });
  res.json(instrument);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.gasDetectionInstrument.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Instrument not found" });
  await prisma.gasDetectionInstrument.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/:id/calibrations", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const instrument = await prisma.gasDetectionInstrument.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!instrument) return res.status(404).json({ error: "Instrument not found" });
  const calibrations = await prisma.instrumentCalibration.findMany({
    where: { instrumentId: instrument.id },
    orderBy: { calibrationDate: "desc" },
  });
  res.json(calibrations);
});

/**
 * A bump test rolls the bump-test dates; a full calibration rolls the calibration
 * dates. They run on different intervals and conflating them would let a daily
 * bump test make an instrument look calibrated for the year. A FAIL takes the
 * instrument out of service immediately — a detector that failed its check is
 * not a detector, and leaving it in the lamp room is how it goes underground.
 */
router.post("/:id/calibrations", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = calibrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const instrument = await prisma.gasDetectionInstrument.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!instrument) return res.status(404).json({ error: "Instrument not found" });

  const d = parsed.data;
  const result = d.result ?? "PASS";
  const calibration = await prisma.instrumentCalibration.create({
    data: { ...d, result, instrumentId: instrument.id },
  });

  const isBumpTest = d.calibrationType === "BUMP_TEST";
  await prisma.gasDetectionInstrument.update({
    where: { id: instrument.id },
    data: {
      ...(isBumpTest
        ? { lastBumpTestDate: d.calibrationDate, nextBumpTestDue: d.nextDue ?? instrument.nextBumpTestDue }
        : { lastCalibrationDate: d.calibrationDate, nextCalibrationDue: d.nextDue ?? instrument.nextCalibrationDue }),
      ...(result === "FAIL" ? { status: "OUT_OF_CALIBRATION" as const } : {}),
    },
  });
  res.status(201).json(calibration);
});

router.delete("/calibrations/:calibrationId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.instrumentCalibration.findFirst({
    where: { id: req.params.calibrationId, instrument: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Calibration not found" });
  await prisma.instrumentCalibration.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
