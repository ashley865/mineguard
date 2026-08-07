import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { imageOrVideoFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: imageOrVideoFileFilter,
});

const hazardTypeEnum = z.enum([
  "GEOTECHNICAL_ROCKFALL",
  "ELECTRICAL",
  "FIRE_EXPLOSION",
  "CHEMICAL_SPILL",
  "MACHINERY_EQUIPMENT",
  "VENTILATION_AIR_QUALITY",
  "DUST_NOISE",
  "SLIP_TRIP_FALL",
  "WORKING_AT_HEIGHT",
  "CONFINED_SPACE",
  "VEHICLE_TRAFFIC",
  "STRUCTURAL",
  "ERGONOMIC",
  "ENVIRONMENTAL",
  "OTHER",
]);

const hazardSchema = z.object({
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
  hazardType: hazardTypeEnum,
  location: z.string().min(1),
  description: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  immediateAction: z.string().optional().nullable(),
  responsiblePersonId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "OVERDUE"]).optional(),
  closureEvidence: z.string().optional().nullable(),
  closureDate: z.coerce.date().optional().nullable(),
});

const mediaSelect = {
  id: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

const hazardSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  zoneId: true,
  zone: { select: { id: true, name: true } },
  hazardType: true,
  location: true,
  description: true,
  reportedBy: { select: { id: true, name: true } },
  riskLevel: true,
  immediateAction: true,
  responsiblePersonId: true,
  responsiblePerson: { select: { id: true, name: true } },
  dueDate: true,
  status: true,
  closureEvidence: true,
  closedBy: { select: { id: true, name: true } },
  closureDate: true,
  media: { select: mediaSelect, orderBy: { createdAt: "asc" } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/responsible-people", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const people = await prisma.user.findMany({
    where: { mineId, role: { in: ["ADMIN", "SUPERVISOR", "EXECUTIVE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(people);
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await prisma.hazardReport.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: hazardSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

// Every worker or supervisor with a login can report "HAZARD FOUND" the moment they spot
// one — no ADMIN/EXECUTIVE gate here, unlike most other create endpoints in this app.
router.post("/", upload.array("media", 6), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = hazardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, siteId: parsed.data.siteId } });
    if (!zone) return res.status(404).json({ error: "Zone not found" });
  }
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const item = await prisma.hazardReport.create({
    data: {
      ...parsed.data,
      reportedById: req.auth!.userId,
      media: {
        create: files.map((f) => ({
          fileName: f.originalname,
          fileMimeType: f.mimetype,
          fileSize: f.size,
          fileData: Uint8Array.from(f.buffer),
        })),
      },
    },
    select: hazardSelect,
  });
  res.status(201).json(item);
});

// Editing/closing a hazard (assigning a responsible person, confirming closure evidence)
// is a follow-up management action, unlike the initial report — restricted the same way
// as every other register's edit endpoint.
router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = hazardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.hazardReport.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Hazard report not found" });
  if (parsed.data.responsiblePersonId) {
    const person = await prisma.user.findFirst({ where: { id: parsed.data.responsiblePersonId, mineId } });
    if (!person) return res.status(404).json({ error: "Responsible person not found" });
  }

  // Closure is an accountability step, so stamp who closed it and when the moment
  // status actually reaches CLOSED, rather than trusting a client-supplied timestamp.
  const extra: { closedById?: string; closureDate?: Date } = {};
  if (parsed.data.status === "CLOSED" && existing.status !== "CLOSED") {
    extra.closedById = req.auth!.userId;
    if (!parsed.data.closureDate) extra.closureDate = new Date();
  }

  const item = await prisma.hazardReport.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...extra },
    select: hazardSelect,
  });
  res.json(item);
});

// Attach further evidence after the initial report — most commonly closure evidence
// photos, but also useful if more hazard evidence turns up mid-investigation.
router.post("/:id/media", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.array("media", 6), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.hazardReport.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Hazard report not found" });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "At least one file is required" });

  await prisma.hazardMedia.createMany({
    data: files.map((f) => ({
      hazardReportId: existing.id,
      fileName: f.originalname,
      fileMimeType: f.mimetype,
      fileSize: f.size,
      fileData: Uint8Array.from(f.buffer),
    })),
  });
  const item = await prisma.hazardReport.findUnique({ where: { id: existing.id }, select: hazardSelect });
  res.status(201).json(item);
});

router.get("/:id/media/:mediaId", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const media = await prisma.hazardMedia.findFirst({
    where: { id: req.params.mediaId, hazardReportId: req.params.id, hazardReport: { site: { mineId } } },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });
  res.setHeader("Content-Type", media.fileMimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);
  res.send(Buffer.from(media.fileData));
});

router.delete("/:id/media/:mediaId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const media = await prisma.hazardMedia.findFirst({
    where: { id: req.params.mediaId, hazardReportId: req.params.id, hazardReport: { site: { mineId } } },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });
  await prisma.hazardMedia.delete({ where: { id: media.id } });
  res.status(204).send();
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.hazardReport.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Hazard report not found" });
  await prisma.hazardReport.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
