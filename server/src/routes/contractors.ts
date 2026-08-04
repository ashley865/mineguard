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

const contractorDocTypeEnum = z.enum([
  "INSURANCE_CERTIFICATE",
  "GOOD_STANDING_CERTIFICATE",
  "CONTRACT_AGREEMENT",
  "SAFETY_FILE",
  "OTHER",
]);

const contractorSchema = z.object({
  companyName: z.string().min(1),
  registrationNumber: z.string().optional(),
  scopeOfWork: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contractStartDate: z.coerce.date(),
  contractEndDate: z.coerce.date(),
  goodStandingExpiry: z.coerce.date().optional().nullable(),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"]).optional(),
  siteId: z.string().min(1),
});

const publicRegisterSchema = contractorSchema.omit({ status: true, siteId: true });

// Public: lets a contractor self-register via a link or QR code shared for a specific site.
router.get("/site/:siteId/info", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    select: { id: true, name: true, location: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/register/:siteId", upload.array("documents", 6), async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const parsed = publicRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const item = await prisma.contractor.create({
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || undefined,
      siteId: site.id,
      documents: {
        create: files.map((f) => ({
          docType: "OTHER" as const,
          fileName: f.originalname,
          fileMimeType: f.mimetype,
          fileSize: f.size,
          fileData: Uint8Array.from(f.buffer),
        })),
      },
    },
  });
  res.status(201).json(item);
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.contractor.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: {
      site: { select: { id: true, name: true } },
      documents: { select: documentSelect, orderBy: { createdAt: "desc" } },
    },
    orderBy: { contractEndDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.create({ data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.update({ where: { id: existing.id }, data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  await prisma.contractor.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/documents", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const contractor = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!contractor) return res.status(404).json({ error: "Contractor not found" });
  const docTypeParsed = contractorDocTypeEnum.safeParse(req.body?.docType);
  const document = await prisma.contractorDocument.create({
    data: {
      contractorId: contractor.id,
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
  const doc = await prisma.contractorDocument.findFirst({
    where: { id: req.params.docId, contractorId: req.params.id, contractor: { site: { mineId } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

// Deleting a contractor document is irreversible, so it requires the ADMIN role plus
// re-confirming their password, not just a valid session token.
router.delete("/:id/documents/:docId", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  const doc = await prisma.contractorDocument.findFirst({
    where: { id: req.params.docId, contractorId: req.params.id, contractor: { site: { mineId } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  await prisma.contractorDocument.delete({ where: { id: doc.id } });
  res.status(204).send();
});

export default router;
