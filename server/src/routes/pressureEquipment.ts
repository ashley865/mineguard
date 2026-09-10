import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const equipmentSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  equipmentType: z.enum(["AIR_RECEIVER", "BOILER", "PRESSURE_VESSEL", "AUTOCLAVE", "ACCUMULATOR", "STEAM_PIPING", "OTHER"]),
  description: z.string().optional(),
  location: z.string().optional(),
  designPressureKpa: z.number().nonnegative().optional().nullable(),
  operatingPressureKpa: z.number().nonnegative().optional().nullable(),
  capacityLitres: z.number().nonnegative().optional().nullable(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  yearBuilt: z.number().int().min(1800).max(2200).optional().nullable(),
  inspectionAuthority: z.string().optional(),
  certificateNumber: z.string().optional(),
  certificateExpiry: z.coerce.date().optional().nullable(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  safetyValveLastTested: z.coerce.date().optional().nullable(),
  safetyValveNextDue: z.coerce.date().optional().nullable(),
  status: z.enum(["IN_SERVICE", "AWAITING_INSPECTION", "OUT_OF_SERVICE", "DECOMMISSIONED"]).optional(),
  notes: z.string().optional(),
});

const inspectionSchema = z.object({
  inspectionDate: z.coerce.date(),
  inspectionType: z.enum(["EXTERNAL", "INTERNAL", "HYDROSTATIC", "SAFETY_VALVE", "ULTRASONIC_THICKNESS"]),
  inspectorName: z.string().min(1),
  inspectionAuthority: z.string().optional(),
  passed: z.boolean().optional(),
  findings: z.string().optional(),
  certificateNumber: z.string().optional(),
  certificateExpiry: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const equipmentSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  identifier: true,
  equipmentType: true,
  description: true,
  location: true,
  designPressureKpa: true,
  operatingPressureKpa: true,
  capacityLitres: true,
  manufacturer: true,
  serialNumber: true,
  yearBuilt: true,
  inspectionAuthority: true,
  certificateNumber: true,
  certificateExpiry: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  safetyValveLastTested: true,
  safetyValveNextDue: true,
  status: true,
  notes: true,
  inspections: {
    select: {
      id: true,
      inspectionDate: true,
      inspectionType: true,
      inspectorName: true,
      inspectionAuthority: true,
      passed: true,
      findings: true,
      certificateNumber: true,
      certificateExpiry: true,
      nextInspectionDue: true,
      notes: true,
    },
    orderBy: { inspectionDate: "desc" as const },
    take: 10,
  },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.pressureEquipment.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: equipmentSelect,
    orderBy: { identifier: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.pressureEquipment.create({ data: parsed.data, select: equipmentSelect });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.pressureEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Pressure equipment not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const item = await prisma.pressureEquipment.update({ where: { id: existing.id }, data: parsed.data, select: equipmentSelect });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.pressureEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Pressure equipment not found" });
  await prisma.pressureEquipment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/:id/inspections", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const item = await prisma.pressureEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Pressure equipment not found" });
  const inspections = await prisma.pressureEquipmentInspection.findMany({
    where: { equipmentId: item.id },
    orderBy: { inspectionDate: "desc" },
  });
  res.json(inspections);
});

/**
 * A safety valve test rolls the valve dates rather than the vessel's inspection
 * dates — they run on different intervals and conflating them would make a
 * vessel look inspected when only its valve was popped. A failed inspection puts
 * the vessel out of service: an uncertified vessel under pressure is the failure
 * mode this register exists to prevent.
 */
router.post("/:id/inspections", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = inspectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.pressureEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Pressure equipment not found" });

  const d = parsed.data;
  const passed = d.passed ?? true;
  const inspection = await prisma.pressureEquipmentInspection.create({
    data: { ...d, passed, equipmentId: item.id },
  });

  const isValveTest = d.inspectionType === "SAFETY_VALVE";
  await prisma.pressureEquipment.update({
    where: { id: item.id },
    data: isValveTest
      ? {
          safetyValveLastTested: d.inspectionDate,
          safetyValveNextDue: d.nextInspectionDue ?? item.safetyValveNextDue,
          ...(passed ? {} : { status: "OUT_OF_SERVICE" as const }),
        }
      : {
          lastInspectionDate: d.inspectionDate,
          nextInspectionDue: d.nextInspectionDue ?? item.nextInspectionDue,
          ...(d.certificateNumber ? { certificateNumber: d.certificateNumber } : {}),
          ...(d.certificateExpiry ? { certificateExpiry: d.certificateExpiry } : {}),
          ...(d.inspectionAuthority ? { inspectionAuthority: d.inspectionAuthority } : {}),
          ...(passed ? {} : { status: "OUT_OF_SERVICE" as const }),
        },
  });
  res.status(201).json(inspection);
});

router.delete("/inspections/:inspectionId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.pressureEquipmentInspection.findFirst({
    where: { id: req.params.inspectionId, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Inspection not found" });
  await prisma.pressureEquipmentInspection.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
