import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { documentFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const submissionSchema = z.object({
  regulator: z.string().min(1),
  subject: z.string().min(1),
  referenceNumber: z.string().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  submittedDate: z.coerce.date().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "OVERDUE"]).optional(),
  notes: z.string().optional(),
});

const submissionSelect = {
  id: true,
  regulator: true,
  subject: true,
  referenceNumber: true,
  dueDate: true,
  submittedDate: true,
  status: true,
  notes: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const submissions = await prisma.regulatorySubmission.findMany({
    where: { mineId },
    select: submissionSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(submissions);
});

router.post("/", requireRole("ADMIN", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const submission = await prisma.regulatorySubmission.create({
    data: {
      ...parsed.data,
      mineId,
      createdById: req.auth!.userId,
      ...(req.file
        ? {
            fileName: req.file.originalname,
            fileMimeType: req.file.mimetype,
            fileSize: req.file.size,
            fileData: Uint8Array.from(req.file.buffer),
          }
        : {}),
    },
    select: submissionSelect,
  });
  res.status(201).json(submission);
});

router.put("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = submissionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.regulatorySubmission.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Submission not found" });
  const submission = await prisma.regulatorySubmission.update({
    where: { id: existing.id },
    data: parsed.data,
    select: submissionSelect,
  });
  res.json(submission);
});

router.get("/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const submission = await prisma.regulatorySubmission.findFirst({
    where: { id: req.params.id, mineId },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!submission?.fileData || !submission.fileMimeType) return res.status(404).json({ error: "No attachment on this submission" });
  res.setHeader("Content-Type", submission.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${submission.fileName}"`);
  res.send(Buffer.from(submission.fileData));
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.regulatorySubmission.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Submission not found" });
  await prisma.regulatorySubmission.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
