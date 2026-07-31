import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyAdminPassword } from "../lib/verifyPassword";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
  });

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

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
// and, if applicable, an ID/registration number appropriate to the buyer type.
router.post("/register", upload.array("documents", 6), async (req, res) => {
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

// Public: lets a buyer check their own approval status without exposing anyone else's data.
router.get("/status", async (req, res) => {
  const email = (req.query.email as string | undefined)?.trim();
  if (!email) return res.status(400).json({ error: "email is required" });
  const buyer = await prisma.buyer.findUnique({ where: { contactEmail: email }, select: { status: true, legalName: true } });
  if (!buyer) return res.status(404).json({ error: "No buyer registration found for this email" });
  res.json(buyer);
});

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

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

router.get("/:id/documents/:docId/download", async (req, res) => {
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
