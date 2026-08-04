import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { documentFileFilter } from "../lib/uploadFilters";
import { verifyAdminPassword } from "../lib/verifyPassword";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const documentSelect = {
  id: true,
  docType: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

const permitDocTypeEnum = z.enum([
  "PERMIT_CERTIFICATE",
  "RENEWAL_APPROVAL",
  "INSPECTION_REPORT",
  "CORRESPONDENCE",
  "OTHER",
]);

const permitSchema = z.object({
  permitNumber: z.string().min(1),
  type: z.enum([
    "MINING_RIGHT",
    "MINING_PERMIT",
    "PROSPECTING_RIGHT",
    "WATER_USE_LICENSE",
    "ENVIRONMENTAL_AUTHORISATION",
    "SOCIAL_LABOUR_PLAN",
    "EXPLOSIVES_LICENSE",
    "MINE_WORKS_PROGRAMME",
    "OTHER",
  ]),
  issuingAuthority: z.string().min(1),
  holderName: z.string().min(1),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "PENDING_RENEWAL", "EXPIRED", "SUSPENDED", "WITHDRAWN"]).optional(),
  conditions: z.string().optional(),
  siteId: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.permit.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } }, documents: { select: documentSelect, orderBy: { createdAt: "desc" } } },
    orderBy: { expiryDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = permitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.permit.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = permitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.permit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Permit not found" });
  const item = await prisma.permit.update({ where: { id: existing.id }, data: parsed.data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.permit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Permit not found" });
  await prisma.permit.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/documents", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const permit = await prisma.permit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!permit) return res.status(404).json({ error: "Permit not found" });
  const docTypeParsed = permitDocTypeEnum.safeParse(req.body?.docType);
  const document = await prisma.permitDocument.create({
    data: {
      permitId: permit.id,
      docType: docTypeParsed.success ? docTypeParsed.data : "OTHER",
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: Uint8Array.from(req.file.buffer),
    },
    select: documentSelect,
  });
  res.status(201).json(document);
});

router.get("/:id/documents/:docId/download", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const doc = await prisma.permitDocument.findFirst({
    where: { id: req.params.docId, permitId: req.params.id, permit: { site: { mineId } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

// Deleting a permit document is irreversible, so it requires the ADMIN role plus
// re-confirming their password, not just a valid session token.
router.delete("/:id/documents/:docId", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  const doc = await prisma.permitDocument.findFirst({
    where: { id: req.params.docId, permitId: req.params.id, permit: { site: { mineId } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  await prisma.permitDocument.delete({ where: { id: doc.id } });
  res.status(204).send();
});

export default router;
