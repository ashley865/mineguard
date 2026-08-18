import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { imageFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const incidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

const mediaSelect = {
  id: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

const incidentInclude = {
  site: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  media: { select: mediaSelect, orderBy: { createdAt: "asc" as const } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const incidents = await prisma.incident.findMany({
    where: {
      site: { mineId },
      ...(siteId ? { siteId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: incidentInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

// Any authenticated user — of any role — can report an incident the moment they see
// one, the same "report it immediately" principle as HazardReport, with optional photo
// evidence attached at creation time.
router.post("/", upload.array("media", 6), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const incident = await prisma.incident.create({
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
    include: incidentInclude,
  });
  res.status(201).json(incident);
});

router.put("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const data: any = { ...parsed.data };
  if (parsed.data.status === "RESOLVED") data.resolvedAt = new Date();
  const incident = await prisma.incident.update({ where: { id: existing.id }, data });
  res.json(incident);
});

// Attach further photo evidence after the initial report — e.g. once someone with a
// better vantage point or a follow-up inspection has more to add.
router.post("/:id/media", upload.array("media", 6), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "At least one file is required" });

  await prisma.incidentMedia.createMany({
    data: files.map((f) => ({
      incidentId: existing.id,
      fileName: f.originalname,
      fileMimeType: f.mimetype,
      fileSize: f.size,
      fileData: Uint8Array.from(f.buffer),
    })),
  });
  const incident = await prisma.incident.findUnique({ where: { id: existing.id }, include: incidentInclude });
  res.status(201).json(incident);
});

router.get("/:id/media/:mediaId", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const media = await prisma.incidentMedia.findFirst({
    where: { id: req.params.mediaId, incidentId: req.params.id, incident: { site: { mineId } } },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });
  res.setHeader("Content-Type", media.fileMimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);
  res.send(Buffer.from(media.fileData));
});

router.delete("/:id/media/:mediaId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const media = await prisma.incidentMedia.findFirst({
    where: { id: req.params.mediaId, incidentId: req.params.id, incident: { site: { mineId } } },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });
  await prisma.incidentMedia.delete({ where: { id: media.id } });
  res.status(204).send();
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  await prisma.incident.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/review", requireRole("EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.incident.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });
  const incident = await prisma.incident.update({
    where: { id: existing.id },
    data: {
      reviewStatus: parsed.data.decision,
      reviewNote: parsed.data.note,
      reviewedAt: new Date(),
      reviewedById: req.auth!.userId,
    },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });
  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("incident:updated", incident);
  res.json(incident);
});

export default router;
