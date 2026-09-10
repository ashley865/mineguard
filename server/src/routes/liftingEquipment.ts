import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const equipmentTypes = [
  "OVERHEAD_CRANE",
  "MOBILE_CRANE",
  "GANTRY",
  "CHAIN_BLOCK",
  "LEVER_HOIST",
  "WINCH",
  "WIRE_ROPE_SLING",
  "CHAIN_SLING",
  "WEBBING_SLING",
  "SHACKLE",
  "EYEBOLT",
  "SPREADER_BEAM",
  "LIFTING_MAGNET",
  "OTHER",
] as const;

const equipmentSchema = z.object({
  siteId: z.string().min(1),
  identifier: z.string().min(1),
  equipmentType: z.enum(equipmentTypes),
  description: z.string().optional(),
  safeWorkingLoadKg: z.number().nonnegative().optional().nullable(),
  location: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  colourCode: z.string().optional(),
  lastInspectionDate: z.coerce.date().optional().nullable(),
  nextInspectionDue: z.coerce.date().optional().nullable(),
  lastLoadTestDate: z.coerce.date().optional().nullable(),
  nextLoadTestDue: z.coerce.date().optional().nullable(),
  status: z.enum(["IN_SERVICE", "QUARANTINED", "UNDER_REPAIR", "CONDEMNED"]).optional(),
  notes: z.string().optional(),
});

const inspectionSchema = z.object({
  inspectionDate: z.coerce.date(),
  inspectionType: z.enum(["VISUAL", "THOROUGH_EXAMINATION", "LOAD_TEST"]),
  inspectorName: z.string().min(1),
  result: z.enum(["PASS", "PASS_WITH_DEFECTS", "FAIL"]),
  defectsFound: z.string().optional(),
  loadTestedKg: z.number().nonnegative().optional().nullable(),
  certificateNumber: z.string().optional(),
  colourCodeApplied: z.string().optional(),
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
  safeWorkingLoadKg: true,
  location: true,
  manufacturer: true,
  serialNumber: true,
  colourCode: true,
  lastInspectionDate: true,
  nextInspectionDue: true,
  lastLoadTestDate: true,
  nextLoadTestDue: true,
  status: true,
  notes: true,
  inspections: {
    select: {
      id: true,
      inspectionDate: true,
      inspectionType: true,
      inspectorName: true,
      result: true,
      defectsFound: true,
      loadTestedKg: true,
      certificateNumber: true,
      colourCodeApplied: true,
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
  const items = await prisma.liftingEquipment.findMany({
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
  const item = await prisma.liftingEquipment.create({ data: parsed.data, select: equipmentSelect });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.liftingEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Lifting equipment not found" });
  if (parsed.data.siteId && parsed.data.siteId !== existing.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const item = await prisma.liftingEquipment.update({ where: { id: existing.id }, data: parsed.data, select: equipmentSelect });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.liftingEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Lifting equipment not found" });
  await prisma.liftingEquipment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/:id/inspections", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const item = await prisma.liftingEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Lifting equipment not found" });
  const inspections = await prisma.liftingInspection.findMany({
    where: { equipmentId: item.id },
    orderBy: { inspectionDate: "desc" },
  });
  res.json(inspections);
});

/**
 * Logging an inspection also rolls the item's own currency forward, so the
 * register and the inspection history can't drift apart. A load test updates the
 * load-test dates; any inspection type updates the inspection dates. A FAIL
 * quarantines the item automatically — an item that failed examination must come
 * off the rack, and relying on someone to remember to change the status is how
 * condemned tackle stays in service.
 */
router.post("/:id/inspections", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = inspectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.liftingEquipment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!item) return res.status(404).json({ error: "Lifting equipment not found" });

  const d = parsed.data;
  const inspection = await prisma.liftingInspection.create({ data: { ...d, equipmentId: item.id } });
  await prisma.liftingEquipment.update({
    where: { id: item.id },
    data: {
      lastInspectionDate: d.inspectionDate,
      nextInspectionDue: d.nextInspectionDue ?? item.nextInspectionDue,
      ...(d.inspectionType === "LOAD_TEST"
        ? { lastLoadTestDate: d.inspectionDate, nextLoadTestDue: d.nextInspectionDue ?? item.nextLoadTestDue }
        : {}),
      ...(d.colourCodeApplied ? { colourCode: d.colourCodeApplied } : {}),
      ...(d.result === "FAIL" ? { status: "QUARANTINED" as const } : {}),
    },
  });
  res.status(201).json(inspection);
});

router.delete("/inspections/:inspectionId", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.liftingInspection.findFirst({
    where: { id: req.params.inspectionId, equipment: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Inspection not found" });
  await prisma.liftingInspection.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
