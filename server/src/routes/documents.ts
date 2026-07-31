import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyAdminPassword } from "../lib/verifyPassword";

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

// Deleting a controlled document is irreversible, so it requires the ADMIN role plus
// re-confirming their password, not just a valid session token.
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
});

// Aggregates every document ever uploaded anywhere in the system — controlled documents,
// visitor check-in uploads, and buyer FICA/KYC uploads — into one organised, searchable view.
router.get("/vault/all", async (_req, res) => {
  const [documents, visitorDocs, buyerDocs] = await Promise.all([
    prisma.document.findMany({
      select: {
        id: true,
        title: true,
        type: true,
        fileName: true,
        fileMimeType: true,
        fileSize: true,
        site: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        createdAt: true,
      },
    }),
    prisma.visitorDocument.findMany({
      select: {
        id: true,
        visitorId: true,
        docType: true,
        fileName: true,
        fileMimeType: true,
        fileSize: true,
        visitor: { select: { fullName: true, site: { select: { id: true, name: true } } } },
        createdAt: true,
      },
    }),
    prisma.buyerDocument.findMany({
      select: {
        id: true,
        buyerId: true,
        docType: true,
        fileName: true,
        fileMimeType: true,
        fileSize: true,
        buyer: { select: { legalName: true } },
        createdAt: true,
      },
    }),
  ]);

  const items = [
    ...documents.map((d) => ({
      id: d.id,
      source: "DOCUMENT" as const,
      parentId: d.id,
      title: d.title,
      category: d.type,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      fileSize: d.fileSize,
      relatedTo: d.site?.name ?? "Company-wide",
      uploadedBy: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt,
    })),
    ...visitorDocs.map((d) => ({
      id: d.id,
      source: "VISITOR" as const,
      parentId: d.visitorId,
      title: d.fileName,
      category: d.docType,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      fileSize: d.fileSize,
      relatedTo: `${d.visitor.fullName} · ${d.visitor.site.name}`,
      uploadedBy: null,
      createdAt: d.createdAt,
    })),
    ...buyerDocs.map((d) => ({
      id: d.id,
      source: "BUYER" as const,
      parentId: d.buyerId,
      title: d.fileName,
      category: d.docType,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      fileSize: d.fileSize,
      relatedTo: d.buyer.legalName,
      uploadedBy: null,
      createdAt: d.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(items);
});

export default router;
