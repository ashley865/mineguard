import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireBuyerAuth } from "../middleware/buyerAuth";
import { signBuyerAuthToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";
import { isGlobalIpBlocked } from "../lib/ipBlocklist";
import { autoBlockGlobalIpIfBruteForced } from "../lib/autoBlock";
import { resolveBooleanSetting } from "../lib/systemSettings";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Excludes reviewedBy (internal staff identity — not the buyer's business) but keeps
// reviewNote, since that's specifically feedback on the buyer's own application.
const buyerSelfSelect = {
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
  createdAt: true,
  documents: {
    select: { id: true, docType: true, fileName: true, fileMimeType: true, fileSize: true, createdAt: true },
  },
} as const;

const bidSelect = {
  id: true,
  listingId: true,
  listing: { select: { id: true, mineralType: true, unit: true, site: { select: { id: true, name: true } } } },
  buyerId: true,
  quantity: true,
  offerPrice: true,
  notes: true,
  status: true,
  createdAt: true,
} as const;

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];

  const buyer = await prisma.buyer.findUnique({ where: { contactEmail: email } });
  if (!buyer || !buyer.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Buyer login has no single mine to scope a block to (see requireBuyerAuth), so this
  // checks the shared, marketplace-wide list instead — logged against the real account
  // since the email did resolve to one.
  if (await isGlobalIpBlocked(ipAddress)) {
    await prisma.buyerLoginEvent
      .create({ data: { buyerId: buyer.id, eventType: "BLOCKED", ipAddress, userAgent, flagged: true } })
      .catch(() => {});
    return res.status(403).json({ error: "Access blocked from this network" });
  }

  // Buyers have no privileged bypass (unlike staff) — maintenance mode blocks every
  // buyer login, since only an Owner/IT Manager can turn it back off.
  if (await resolveBooleanSetting("MAINTENANCE_MODE", false)) {
    return res.status(503).json({ error: "MineGuard is temporarily down for maintenance. Please try again shortly.", maintenance: true });
  }

  const valid = await bcrypt.compare(password, buyer.passwordHash);
  if (!valid) {
    // Feeds the marketplace-wide "buyer threats" view every mine's Cyber Command Center
    // can see, the same way a failed staff login feeds that mine's own threat detection.
    await prisma.buyerLoginEvent
      .create({ data: { buyerId: buyer.id, eventType: "LOGIN_FAILED", ipAddress, userAgent, flagged: true } })
      .catch(() => {});
    await autoBlockGlobalIpIfBruteForced(ipAddress);
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (buyer.status === "SUSPENDED") {
    return res.status(403).json({ error: "This buyer account has been suspended" });
  }

  await prisma.buyerLoginEvent
    .create({ data: { buyerId: buyer.id, eventType: "LOGIN_SUCCESS", ipAddress, userAgent } })
    .catch(() => {});
  // Feeds the Cyber Command Center's Identity & Access view (buyers are shown there
  // alongside staff and visitors), the same way User.lastLoginAt does for staff.
  await prisma.buyer.update({ where: { id: buyer.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const token = signBuyerAuthToken(buyer.id);
  const full = await prisma.buyer.findUnique({ where: { id: buyer.id }, select: buyerSelfSelect });
  res.json({ token, buyer: full });
});

router.get("/me", requireBuyerAuth, async (req, res) => {
  const buyer = await prisma.buyer.findUnique({ where: { id: req.buyerAuth!.buyerId }, select: buyerSelfSelect });
  if (!buyer) return res.status(404).json({ error: "Buyer not found" });
  res.json(buyer);
});

router.get("/me/bids", requireBuyerAuth, async (req, res) => {
  const bids = await prisma.mineralBid.findMany({
    where: { buyerId: req.buyerAuth!.buyerId },
    select: bidSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(bids);
});

router.get("/me/documents/:docId/download", requireBuyerAuth, async (req, res) => {
  const doc = await prisma.buyerDocument.findFirst({
    where: { id: req.params.docId, buyerId: req.buyerAuth!.buyerId },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

router.post("/change-password", requireBuyerAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const buyer = await prisma.buyer.findUnique({ where: { id: req.buyerAuth!.buyerId } });
  if (!buyer?.passwordHash) return res.status(404).json({ error: "Buyer not found" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, buyer.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.buyer.update({ where: { id: buyer.id }, data: { passwordHash } });
  res.status(204).send();
});

export default router;
