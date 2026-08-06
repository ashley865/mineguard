import { Router, Request } from "express";
import multer from "multer";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyAdminPassword } from "../lib/verifyPassword";
import { controlledDocumentFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// POPIA: personal information about a specific worker or buyer (ID copies, certificates,
// FICA/KYC files) is only shown to the executive titles whose department has a genuine
// need for it — not to every executive who happens to have Document Vault access.
const WORKER_SENSITIVE_AUDIENCE: ExecutiveTitle[] = ["HR_MANAGER", "COMPLIANCE_OFFICER", "GENERAL_MANAGER", "COO"];
const BUYER_SENSITIVE_AUDIENCE: ExecutiveTitle[] = ["COMPLIANCE_OFFICER", "CFO", "GENERAL_MANAGER", "COO"];
const VISITOR_SENSITIVE_AUDIENCE: ExecutiveTitle[] = ["SECURITY_MANAGER", "COMPLIANCE_OFFICER", "GENERAL_MANAGER", "COO"];

async function getRequesterTitle(req: Request): Promise<ExecutiveTitle | null> {
  if (req.auth!.role !== "EXECUTIVE") return null;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  return me?.title ?? null;
}

function inAudience(role: string, title: ExecutiveTitle | null, audience: ExecutiveTitle[]): boolean {
  return role === "ADMIN" || (role === "EXECUTIVE" && !!title && audience.includes(title));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: controlledDocumentFileFilter,
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
  "INVOICE",
  "EXPENSE_RECEIPT",
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
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const title = await getRequesterTitle(req);
  const canSeeSensitive = inAudience(req.auth!.role, title, WORKER_SENSITIVE_AUDIENCE);
  const items = await prisma.document.findMany({
    where: {
      mineId,
      siteId: siteId || undefined,
      type: canSeeSensitive ? undefined : { not: "CERTIFICATE" },
    },
    select: documentSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.get("/:id/download", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const doc = await prisma.document.findFirst({ where: { id: req.params.id, mineId } });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (doc.type === "CERTIFICATE") {
    const title = await getRequesterTitle(req);
    if (!inAudience(req.auth!.role, title, WORKER_SENSITIVE_AUDIENCE)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
  }
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }

  const item = await prisma.document.create({
    data: {
      ...parsed.data,
      mineId,
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
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = metadataSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.document.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Document not found" });
  if (parsed.data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
    if (!site) return res.status(404).json({ error: "Site not found" });
  }
  const item = await prisma.document.update({
    where: { id: existing.id },
    data: parsed.data,
    select: documentSelect,
  });
  res.json(item);
});

// Deleting a controlled document is irreversible, so it requires the ADMIN role plus
// re-confirming their password, not just a valid session token.
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  const existing = await prisma.document.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Document not found" });
  await prisma.document.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Aggregates every document ever uploaded anywhere in the system — controlled documents,
// visitor check-in uploads, and buyer FICA/KYC uploads — into one organised, searchable view.
router.get("/vault/all", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const title = await getRequesterTitle(req);
  const canSeeWorkerSensitive = inAudience(req.auth!.role, title, WORKER_SENSITIVE_AUDIENCE);
  const canSeeBuyerDocs = inAudience(req.auth!.role, title, BUYER_SENSITIVE_AUDIENCE);
  const canSeeVisitorDocs = inAudience(req.auth!.role, title, VISITOR_SENSITIVE_AUDIENCE);

  const [documents, visitorDocs, buyerDocs, permitDocs, contractorDocs] = await Promise.all([
    prisma.document.findMany({
      where: { mineId, type: canSeeWorkerSensitive ? undefined : { not: "CERTIFICATE" } },
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
    canSeeVisitorDocs
      ? prisma.visitorDocument.findMany({
          where: { visitor: { site: { mineId } } },
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
        })
      : Promise.resolve([]),
    canSeeBuyerDocs
      ? prisma.buyerDocument.findMany({
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
        })
      : Promise.resolve([]),
    prisma.permitDocument.findMany({
      where: { permit: { site: { mineId } } },
      select: {
        id: true,
        permitId: true,
        docType: true,
        fileName: true,
        fileMimeType: true,
        fileSize: true,
        permit: { select: { permitNumber: true, site: { select: { id: true, name: true } } } },
        createdAt: true,
      },
    }),
    prisma.contractorDocument.findMany({
      where: { contractor: { site: { mineId } } },
      select: {
        id: true,
        contractorId: true,
        docType: true,
        fileName: true,
        fileMimeType: true,
        fileSize: true,
        contractor: { select: { companyName: true, site: { select: { id: true, name: true } } } },
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
    ...permitDocs.map((d) => ({
      id: d.id,
      source: "PERMIT" as const,
      parentId: d.permitId,
      title: d.fileName,
      category: d.docType,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      fileSize: d.fileSize,
      relatedTo: `${d.permit.permitNumber} · ${d.permit.site.name}`,
      uploadedBy: null,
      createdAt: d.createdAt,
    })),
    ...contractorDocs.map((d) => ({
      id: d.id,
      source: "CONTRACTOR" as const,
      parentId: d.contractorId,
      title: d.fileName,
      category: d.docType,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      fileSize: d.fileSize,
      relatedTo: `${d.contractor.companyName} · ${d.contractor.site.name}`,
      uploadedBy: null,
      createdAt: d.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(items);
});

export default router;
