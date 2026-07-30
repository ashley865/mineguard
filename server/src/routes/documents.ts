import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const documentTypeEnum = z.enum([
  "POLICY",
  "CODE_OF_PRACTICE",
  "PERMIT",
  "CERTIFICATE",
  "REPORT",
  "PROCEDURE",
  "DRAWING",
  "CONTRACT",
  "OTHER",
]);
const documentStatusEnum = z.enum(["DRAFT", "ACTIVE", "UNDER_REVIEW", "ARCHIVED", "WITHDRAWN"]);

const metadataSchema = z.object({
  title: z.string().min(1),
  type: documentTypeEnum,
  version: z.string().min(1),
  status: documentStatusEnum.optional(),
  description: z.string().optional(),
  reviewDate: z.coerce.date().optional().nullable(),
  siteId: z.string().optional().nullable(),
});

const documentSelect = {
  id: true,
  title: true,
  type: true,
  version: true,
  status: true,
  description: true,
  reviewDate: true,
  siteId: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  uploadedById: true,
  createdAt: true,
  site: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, name: true } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.document.findMany({
    where: siteId ? { siteId } : undefined,
    select: documentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.get("/:id/download", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await prisma.document.create({
    data: {
      ...parsed.data,
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: Uint8Array.from(req.file.buffer),
      uploadedById: req.auth!.userId,
    },
    select: documentSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = metadataSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.document.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: documentSelect,
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
});

export default router;
