import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAssignedSiteIds } from "../services/executiveSites";
import { verifyAdminPassword } from "../lib/verifyPassword";
import { isValidIdOrPassport } from "../lib/saId";
import { documentFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const checkinSchema = z.object({
  fullName: z.string().min(1),
  idNumber: z.string().min(1).refine(isValidIdOrPassport, {
    message: "This does not look like a valid ID or passport number",
  }),
  company: z.string().optional(),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email().optional().or(z.literal("")),
  hostName: z.string().min(1),
  purposeOfVisit: z.string().min(1),
  vehicleRegistration: z.string().optional(),
  inductionAcknowledged: z.coerce.boolean(),
  popiaConsentAccepted: z.coerce.boolean(),
  indemnityAccepted: z.coerce.boolean(),
});

const visitorSelect = {
  id: true,
  fullName: true,
  idNumber: true,
  company: true,
  contactPhone: true,
  contactEmail: true,
  hostName: true,
  purposeOfVisit: true,
  vehicleRegistration: true,
  siteId: true,
  status: true,
  checkInAt: true,
  checkOutAt: true,
  inductionAcknowledged: true,
  popiaConsentAccepted: true,
  indemnityAccepted: true,
  createdAt: true,
  site: { select: { id: true, name: true } },
  documents: {
    select: { id: true, docType: true, fileName: true, fileMimeType: true, fileSize: true, createdAt: true },
  },
} as const;

async function assertSiteAccess(req: any, res: any, siteId: string): Promise<boolean> {
  if (req.auth!.role === "EXECUTIVE") {
    const allowed = await getAssignedSiteIds(req.auth!.userId);
    if (!allowed.includes(siteId)) {
      res.status(403).json({ error: "You are not assigned to this site" });
      return false;
    }
  }
  return true;
}

// Public self-service check-in reached by scanning the site's QR code. No auth: this is the
// visitor-facing entry point, gated instead by the required RSA-law declarations below.
router.get("/site/:siteId/info", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    select: { id: true, name: true, location: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/checkin/:siteId", upload.array("documents", 5), async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { inductionAcknowledged, popiaConsentAccepted, indemnityAccepted } = parsed.data;
  if (!inductionAcknowledged || !popiaConsentAccepted || !indemnityAccepted) {
    return res.status(400).json({
      error: "Safety induction, POPIA consent, and indemnity acknowledgement are all required before check-in",
    });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const visitor = await prisma.visitor.create({
    data: {
      fullName: parsed.data.fullName,
      idNumber: parsed.data.idNumber,
      company: parsed.data.company || undefined,
      contactPhone: parsed.data.contactPhone,
      contactEmail: parsed.data.contactEmail || undefined,
      hostName: parsed.data.hostName,
      purposeOfVisit: parsed.data.purposeOfVisit,
      vehicleRegistration: parsed.data.vehicleRegistration || undefined,
      siteId: site.id,
      inductionAcknowledged,
      popiaConsentAccepted,
      indemnityAccepted,
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
    select: visitorSelect,
  });
  res.status(201).json(visitor);
});

router.use(requireAuth);

router.get("/", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  let allowedSiteIds: string[] | null = null;
  if (req.auth!.role === "EXECUTIVE") {
    allowedSiteIds = await getAssignedSiteIds(req.auth!.userId);
    if (siteId && !allowedSiteIds.includes(siteId)) {
      return res.status(403).json({ error: "You are not assigned to this site" });
    }
  }
  const items = await prisma.visitor.findMany({
    where: {
      site: { mineId },
      siteId: siteId ?? (allowedSiteIds ? { in: allowedSiteIds } : undefined),
    },
    select: visitorSelect,
    orderBy: { checkInAt: "desc" },
  });
  res.json(items);
});

router.post("/:id/checkout", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const visitor = await prisma.visitor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });
  if (!(await assertSiteAccess(req, res, visitor.siteId))) return;

  const updated = await prisma.visitor.update({
    where: { id: req.params.id },
    data: { status: "CHECKED_OUT", checkOutAt: new Date() },
    select: visitorSelect,
  });
  res.json(updated);
});

router.get("/:id/documents/:docId/download", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const doc = await prisma.visitorDocument.findUnique({
    where: { id: req.params.docId },
    include: { visitor: { select: { id: true, siteId: true, site: { select: { mineId: true } } } } },
  });
  if (!doc || doc.visitor.id !== req.params.id || doc.visitor.site.mineId !== mineId) {
    return res.status(404).json({ error: "Document not found" });
  }
  if (!(await assertSiteAccess(req, res, doc.visitor.siteId))) return;

  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.visitor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Visitor not found" });
  await prisma.visitor.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Deleting a visitor's uploaded document is irreversible, so it requires the ADMIN role
// plus re-confirming their password, not just a valid session token.
router.delete("/:id/documents/:docId", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const passwordOk = await verifyAdminPassword(req.auth!.userId, req.body?.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });
  const doc = await prisma.visitorDocument.findFirst({
    where: { id: req.params.docId, visitorId: req.params.id, visitor: { site: { mineId } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  await prisma.visitorDocument.delete({ where: { id: doc.id } });
  res.status(204).send();
});

export default router;
