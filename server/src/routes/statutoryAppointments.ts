import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { controlledDocumentFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: controlledDocumentFileFilter,
});

const appointmentTypeEnum = z.enum([
  "MINE_MANAGER",
  "MINE_OVERSEER",
  "ENGINEER",
  "SURVEYOR",
  "VENTILATION_OFFICER",
  "HEALTH_SAFETY_OFFICER",
  "BLASTING_OFFICER",
  "ROCK_ENGINEER",
  "ELECTRICAL_ENGINEER",
  "MECHANICAL_ENGINEER",
  "ASSISTANT_MANAGER",
  "ENVIRONMENTAL_CONTROL_OFFICER",
  "OCCUPATIONAL_HYGIENIST",
  "OTHER",
]);

const appointmentSchema = z.object({
  siteId: z.string().min(1),
  appointmentType: appointmentTypeEnum,
  customTitle: z.string().optional(),
  legislativeReference: z.string().optional(),
  workerId: z.string().optional().nullable(),
  appointeeName: z.string().min(1),
  certificateId: z.string().optional().nullable(),
  appointedDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "VACANT", "SUSPENDED", "EXPIRED", "REVOKED"]).optional(),
  scopeOfAppointment: z.string().optional(),
  notes: z.string().optional(),
});

const appointmentSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  appointmentType: true,
  customTitle: true,
  legislativeReference: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  appointeeName: true,
  certificateId: true,
  certificate: { select: { id: true, type: true, certificateNumber: true, expiryDate: true, status: true } },
  appointedDate: true,
  status: true,
  scopeOfAppointment: true,
  notes: true,
  letterFileName: true,
  letterFileMimeType: true,
  letterFileSize: true,
  appointedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const appointments = await prisma.statutoryAppointment.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: appointmentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(appointments);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const appointment = await prisma.statutoryAppointment.create({
    data: { ...parsed.data, appointedById: req.auth!.userId },
    select: appointmentSelect,
  });
  res.status(201).json(appointment);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = appointmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.statutoryAppointment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Appointment not found" });
  const appointment = await prisma.statutoryAppointment.update({
    where: { id: existing.id },
    data: parsed.data,
    select: appointmentSelect,
  });
  res.json(appointment);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.statutoryAppointment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Appointment not found" });
  await prisma.statutoryAppointment.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/letter", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const existing = await prisma.statutoryAppointment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Appointment not found" });
  const appointment = await prisma.statutoryAppointment.update({
    where: { id: existing.id },
    data: {
      letterFileName: req.file.originalname,
      letterFileMimeType: req.file.mimetype,
      letterFileSize: req.file.size,
      letterFileData: Uint8Array.from(req.file.buffer),
    },
    select: appointmentSelect,
  });
  res.status(201).json(appointment);
});

router.get("/:id/letter", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const appointment = await prisma.statutoryAppointment.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!appointment || !appointment.letterFileData) return res.status(404).json({ error: "No appointment letter on file" });
  res.setHeader("Content-Type", appointment.letterFileMimeType ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(appointment.letterFileName ?? "appointment-letter")}"`);
  res.send(Buffer.from(appointment.letterFileData));
});

export default router;
