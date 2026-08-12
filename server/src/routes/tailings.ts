import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const facilitySchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  facilityType: z.string().optional(),
  designCapacity: z.coerce.number().optional().nullable(),
  unit: z.string().optional(),
  engineerOfRecord: z.string().optional(),
  gistmClassification: z.string().optional(),
  status: z.string().optional(),
});

const inspectionSchema = z.object({
  facilityId: z.string().min(1),
  inspectionDate: z.coerce.date(),
  inspector: z.string().min(1),
  freeboardMeters: z.coerce.number().optional().nullable(),
  seepageObserved: z.coerce.boolean().optional(),
  seepageDescription: z.string().optional(),
  structuralRating: z.enum(["SATISFACTORY", "FAIR", "POOR", "UNSATISFACTORY", "UNKNOWN"]).optional(),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  engineerSignOff: z.coerce.boolean().optional(),
  engineerSignOffName: z.string().optional(),
  engineerSignOffDate: z.coerce.date().optional().nullable(),
});

const facilitySelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  name: true,
  facilityType: true,
  designCapacity: true,
  unit: true,
  engineerOfRecord: true,
  gistmClassification: true,
  status: true,
  inspections: {
    select: {
      id: true,
      inspectionDate: true,
      inspector: true,
      freeboardMeters: true,
      seepageObserved: true,
      structuralRating: true,
      engineerSignOff: true,
    },
    orderBy: { inspectionDate: "desc" as const },
    take: 5,
  },
  createdAt: true,
} as const;

const inspectionSelect = {
  id: true,
  facilityId: true,
  facility: { select: { id: true, name: true, site: { select: { id: true, name: true } } } },
  inspectionDate: true,
  inspector: true,
  freeboardMeters: true,
  seepageObserved: true,
  seepageDescription: true,
  structuralRating: true,
  findings: true,
  correctiveActions: true,
  engineerSignOff: true,
  engineerSignOffName: true,
  engineerSignOffDate: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/facilities", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const facilities = await prisma.tailingsFacility.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: facilitySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(facilities);
});

router.post("/facilities", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const facility = await prisma.tailingsFacility.create({ data: parsed.data, select: facilitySelect });
  res.status(201).json(facility);
});

router.put("/facilities/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = facilitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.tailingsFacility.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Facility not found" });
  const facility = await prisma.tailingsFacility.update({ where: { id: existing.id }, data: parsed.data, select: facilitySelect });
  res.json(facility);
});

router.delete("/facilities/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.tailingsFacility.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Facility not found" });
  await prisma.tailingsFacility.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/inspections", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const facilityId = req.query.facilityId as string | undefined;
  const inspections = await prisma.tailingsInspection.findMany({
    where: { facility: { site: { mineId } }, facilityId: facilityId || undefined },
    select: inspectionSelect,
    orderBy: { inspectionDate: "desc" },
  });
  res.json(inspections);
});

router.post("/inspections", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = inspectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const facility = await prisma.tailingsFacility.findFirst({ where: { id: parsed.data.facilityId, site: { mineId } } });
  if (!facility) return res.status(404).json({ error: "Facility not found" });
  const inspection = await prisma.tailingsInspection.create({ data: parsed.data, select: inspectionSelect });
  res.status(201).json(inspection);
});

router.delete("/inspections/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.tailingsInspection.findFirst({ where: { id: req.params.id, facility: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Inspection not found" });
  await prisma.tailingsInspection.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
