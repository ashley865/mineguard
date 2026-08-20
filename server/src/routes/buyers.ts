import { Router, Request, Response } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyAdminPassword } from "../lib/verifyPassword";
import { isValidIdOrPassport } from "../lib/saId";
import { documentFileFilter } from "../lib/uploadFilters";
import { signBuyerAuthToken } from "../lib/jwt";
import { authLimiter } from "../middleware/rateLimit";

const router = Router();

// POPIA: buyer FICA/KYC documents (ID copies, proof of address) are only downloadable by
// the executive titles whose department has a genuine compliance/financial need for them.
const BUYER_DOCUMENT_AUDIENCE: ExecutiveTitle[] = ["COMPLIANCE_OFFICER", "CFO", "GENERAL_MANAGER", "COO"];

async function requireBuyerDocumentAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !BUYER_DOCUMENT_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const registerSchema = z.object({
  buyerType: z.enum(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"]),
  legalName: z.string().min(1),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  idNumber: z.string().optional(),
  taxNumber: z.string().min(1),
  vatNumber: z.string().optional(),
  dealerLicenseNumber: z.string().optional(),
  dealerLicenseAuthority: z.string().optional(),
  dealerLicenseExpiry: z.coerce.date().optional(),
  physicalAddress: z.string().min(1),
  postalAddress: z.string().optional(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email(),
  bankName: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranchCode: z.string().optional(),
  bbbeeLevel: z.string().optional(),
  sourceOfFunds: z.string().min(1),
  popiaConsentAccepted: z.coerce.boolean(),
  ficaDeclarationAccepted: z.coerce.boolean(),
  amlDeclarationAccepted: z.coerce.boolean(),
})
  .refine((d) => d.buyerType === "INDIVIDUAL" || !!d.registrationNumber, {
    message: "Registration number is required for companies, trusts, and partnerships",
    path: ["registrationNumber"],
  })
  .refine((d) => d.buyerType !== "INDIVIDUAL" || !!d.idNumber, {
    message: "ID or passport number is required for individuals",
    path: ["idNumber"],
  })
  .refine((d) => !d.idNumber || isValidIdOrPassport(d.idNumber), {
    message: "This does not look like a valid South African ID number or passport number",
    path: ["idNumber"],
  });

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

const buyerDocTypeEnum = z.enum(["ID_OR_REGISTRATION", "PROOF_OF_ADDRESS", "DEALER_LICENSE", "TAX_CLEARANCE", "OTHER"]);

const buyerSelect = {
  id: true,
  buyerType: true,
  legalName: true,
  tradingName: true,
  registrationNumber: true,
  idNumber: true,
  taxNumber: true,
  vatNumber: true,
  dealerLicenseNumber: true,
  dealerLicenseAuthority: true,
  dealerLicenseExpiry: true,
  physicalAddress: true,
  postalAddress: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  bankName: true,
  bankAccountHolder: true,
  bankAccountNumber: true,
  bankBranchCode: true,
  bbbeeLevel: true,
  sourceOfFunds: true,
  popiaConsentAccepted: true,
  ficaDeclarationAccepted: true,
  amlDeclarationAccepted: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  reviewedBy: { select: { id: true, name: true } },
  createdAt: true,
  documents: {
    select: { id: true, docType: true, fileName: true, fileMimeType: true, fileSize: true, createdAt: true },
  },
} as const;

// Public: strict FICA-style buyer registration. Requires the three compliance declarations
// and, if applicable, an ID/registration number appropriate to the buyer type. Also sets
// the buyer's own login password — unlike the staff-initiated route below, there is no
// other party who could set this on the buyer's behalf, so it's mandatory here.
router.post("/register", authLimiter, upload.array("documents", 6), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { popiaConsentAccepted, ficaDeclarationAccepted, amlDeclarationAccepted } = parsed.data;
  if (!popiaConsentAccepted || !ficaDeclarationAccepted || !amlDeclarationAccepted) {
    return res.status(400).json({
      error: "The POPIA consent, FICA, and anti-money-laundering declarations must all be accepted",
    });
  }
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await prisma.buyer.findUnique({ where: { contactEmail: parsed.data.contactEmail } });
  if (existing) return res.status(409).json({ error: "A buyer with this email is already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const buyer = await prisma.buyer.create({
    data: {
      ...parsed.data,
      passwordHash,
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
    select: buyerSelect,
  });
  const token = signBuyerAuthToken(buyer.id);
  res.status(201).json({ token, buyer });
});

// Public: lets a buyer check their own approval status without exposing anyone else's data.
router.get("/status", async (req, res) => {
  const email = (req.query.email as string | undefined)?.trim();
  if (!email) return res.status(400).json({ error: "email is required" });
  const buyer = await prisma.buyer.findUnique({ where: { contactEmail: email }, select: { status: true, legalName: true } });
  if (!buyer) return res.status(404).json({ error: "No buyer registration found for this email" });
  res.json(buyer);
});

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

// Staff-initiated registration, e.g. when a buyer is onboarded in person or over the
// phone rather than through the public self-service form. Same FICA-style declarations
// and validation apply — staff cannot skip the compliance requirements on a buyer's behalf.
router.post("/", upload.array("documents", 6), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { popiaConsentAccepted, ficaDeclarationAccepted, amlDeclarationAccepted } = parsed.data;
  if (!popiaConsentAccepted || !ficaDeclarationAccepted || !amlDeclarationAccepted) {
    return res.status(400).json({
      error: "The POPIA consent, FICA, and anti-money-laundering declarations must all be accepted",
    });
  }

  const existing = await prisma.buyer.findUnique({ where: { contactEmail: parsed.data.contactEmail } });
  if (existing) return res.status(409).json({ error: "A buyer with this email is already registered" });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const buyer = await prisma.buyer.create({
    data: {
      ...parsed.data,
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
    select: buyerSelect,
  });
  res.status(201).json(buyer);
});

// Staff-created buyers (see POST / above) have no password until staff hands them one —
// e.g. after verifying identity over the phone, matching how mine passkeys and executive
// invites are already communicated out-of-band in this app. Also lets staff reset a
// self-registered buyer's forgotten password, since there is no automated email flow.
router.post("/:id/set-password", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const buyer = await prisma.buyer.findUnique({ where: { id: req.params.id } });
  if (!buyer) return res.status(404).json({ error: "Buyer not found" });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.buyer.update({ where: { id: buyer.id }, data: { passwordHash } });
  res.status(204).send();
});

router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const buyers = await prisma.buyer.findMany({
    where: status ? { status: status as any } : undefined,
    select: buyerSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(buyers);
});

router.post("/:id/review", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const buyer = await prisma.buyer.update({
      where: { id: req.params.id },
      data: {
        status: parsed.data.decision,
        reviewNote: parsed.data.note || undefined,
        reviewedAt: new Date(),
        reviewedById: req.auth!.userId,
      },
      select: buyerSelect,
    });
    res.json(buyer);
  } catch {
    res.status(404).json({ error: "Buyer not found" });
  }
});

router.post("/:id/suspend", async (req, res) => {
  try {
    const buyer = await prisma.buyer.update({
      where: { id: req.params.id },
      data: { status: "SUSPENDED", reviewedAt: new Date(), reviewedById: req.auth!.userId },
      select: buyerSelect,
    });
    res.json(buyer);
  } catch {
    res.status(404).json({ error: "Buyer not found" });
  }
});

router.post("/:id/documents", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const buyer = await prisma.buyer.findUnique({ where: { id: req.params.id } });
  if (!buyer) return res.status(404).json({ error: "Buyer not found" });
  const docTypeParsed = buyerDocTypeEnum.safeParse(req.body?.docType);
  const document = await prisma.buyerDocument.create({
    data: {
      buyerId: buyer.id,
      docType: docTypeParsed.success ? docTypeParsed.data : "OTHER",
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: Uint8Array.from(req.file.buffer),
    },
    select: { id: true, docType: true, fileName: true, fileMimeType: true, fileSize: true, createdAt: true },
  });
  res.status(201).json(document);
});

router.get("/:id/documents/:docId/download", async (req, res) => {
  if (!(await requireBuyerDocumentAccess(req, res))) return;
  const doc = await prisma.buyerDocument.findUnique({ where: { id: req.params.docId } });
  if (!doc || doc.buyerId !== req.params.id) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

// Deleting a compliance document is irreversible, so it requires the ADMIN role plus
// re-confirming their password, not just a valid session token.
router.delete("/:id/documents/:docId", requireRole("ADMIN"), async (req, res) => {
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  const doc = await prisma.buyerDocument.findUnique({ where: { id: req.params.docId } });
  if (!doc || doc.buyerId !== req.params.id) return res.status(404).json({ error: "Document not found" });
  await prisma.buyerDocument.delete({ where: { id: req.params.docId } });
  res.status(204).send();
});

export default router;
