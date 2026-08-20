import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { documentFileFilter } from "../lib/uploadFilters";
import { verifyAdminPassword } from "../lib/verifyPassword";
import { signContractorAuthToken } from "../lib/jwt";
import { authLimiter } from "../middleware/rateLimit";

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

// passwordHash is selected only so hasPortalAccess can be derived from it (see
// withPortalAccess below) — it must never itself reach the response.
const contractorSelect = {
  id: true,
  companyName: true,
  registrationNumber: true,
  scopeOfWork: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  contractStartDate: true,
  contractEndDate: true,
  goodStandingExpiry: true,
  insuranceExpiry: true,
  status: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  passwordHash: true,
  lastLoginAt: true,
  createdAt: true,
  documents: { select: documentSelect, orderBy: { createdAt: "desc" as const } },
} as const;

function withPortalAccess<T extends { passwordHash: string | null }>({ passwordHash, ...rest }: T) {
  return { ...rest, hasPortalAccess: !!passwordHash };
}

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

// Contact email and a password are optional on the base schema (staff can register a
// contractor by phone without either), but required for public self-registration, since
// that's the only way this contractor will ever be able to log in to their own portal.
const publicRegisterSchema = contractorSchema.omit({ status: true, siteId: true }).extend({
  contactEmail: z.string().email(),
  password: z.string().min(8),
});

// Public: lets a contractor self-register via a link or QR code shared for a specific site.
router.get("/site/:siteId/info", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    select: { id: true, name: true, location: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/register/:siteId", authLimiter, upload.array("documents", 6), async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const parsed = publicRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.contractor.findFirst({ where: { contactEmail: parsed.data.contactEmail } });
  if (existing) return res.status(409).json({ error: "A contractor with this email is already registered" });

  const { password, ...contractorData } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const item = await prisma.contractor.create({
    data: {
      ...contractorData,
      passwordHash,
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
  const token = signContractorAuthToken(item.id);
  const { passwordHash: _passwordHash, ...safeContractor } = item;
  res.status(201).json({ token, contractor: safeContractor });
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.contractor.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    select: contractorSelect,
    orderBy: { contractEndDate: "asc" },
  });
  res.json(items.map(withPortalAccess));
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.create({ data, select: contractorSelect });
  res.status(201).json(withPortalAccess(item));
});

// Staff-onboarded contractors (POST / above) have no password until staff hands them one,
// matching the identical pattern already used for staff-onboarded buyers (see
// POST /buyers/:id/set-password) — e.g. after verifying identity over the phone.
router.post("/:id/set-password", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.contractor.update({ where: { id: existing.id }, data: { passwordHash } });
  res.status(204).send();
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.update({ where: { id: existing.id }, data, select: contractorSelect });
  res.json(withPortalAccess(item));
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
