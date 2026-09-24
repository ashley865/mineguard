import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireContractorAuth } from "../middleware/contractorAuth";
import { signContractorAuthToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";
import { isIpBlocked } from "../lib/ipBlocklist";
import { autoBlockMineIpIfBruteForced } from "../lib/autoBlock";
import { resolveBooleanSetting } from "../lib/systemSettings";
import { sendContractorVerificationEmail, verifyContractorEmailToken } from "../lib/emailVerification";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({ token: z.string().min(1) });
const resendSchema = z.object({ email: z.string().email() });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const contractorSelfSelect = {
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
  createdAt: true,
  documents: {
    select: { id: true, docType: true, fileName: true, fileMimeType: true, fileSize: true, createdAt: true },
  },
} as const;

const permitSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  workDescription: true,
  workArea: true,
  hazardsIdentified: true,
  controlMeasures: true,
  startDate: true,
  endDate: true,
  requestedByName: true,
  status: true,
  supervisorNote: true,
  executiveNote: true,
  createdAt: true,
} as const;

// Same login/threat-tracking shape as staff (see auth.ts) — reused here because, unlike
// a Buyer, a Contractor belongs to exactly one site/mine, so its login attempts fit the
// same mine-scoped CyberLoginEvent table and the IP blocklist directly applies.
router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];

  const contractor = await prisma.contractor.findFirst({
    where: { contactEmail: email },
    include: { site: { select: { mineId: true } } },
  });
  if (!contractor || !contractor.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const mineId = contractor.site.mineId;

  if (await isIpBlocked(mineId, ipAddress)) {
    await prisma.cyberLoginEvent
      .create({ data: { mineId, contractorId: contractor.id, eventType: "BLOCKED", ipAddress, userAgent, flagged: true } })
      .catch(() => {});
    return res.status(403).json({ error: "Access blocked from this network" });
  }

  // Contractors have no privileged bypass (unlike staff) — maintenance mode blocks every
  // contractor login, since only an Owner/IT Manager can turn it back off.
  if (await resolveBooleanSetting("MAINTENANCE_MODE", false)) {
    return res.status(503).json({ error: "MineGuard is temporarily down for maintenance. Please try again shortly.", maintenance: true });
  }

  const valid = await bcrypt.compare(password, contractor.passwordHash);
  if (!valid) {
    await prisma.cyberLoginEvent
      .create({ data: { mineId, contractorId: contractor.id, eventType: "LOGIN_FAILED", ipAddress, userAgent, flagged: true } })
      .catch(() => {});
    await autoBlockMineIpIfBruteForced(mineId, ipAddress);
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (contractor.status === "SUSPENDED" || contractor.status === "TERMINATED") {
    return res.status(403).json({ error: "This contractor account is no longer active" });
  }
  if (!contractor.emailVerifiedAt) {
    return res.status(403).json({ error: "Please verify your email before signing in. Check your inbox for the verification link.", emailUnverified: true });
  }

  await prisma.cyberLoginEvent
    .create({ data: { mineId, contractorId: contractor.id, eventType: "LOGIN_SUCCESS", ipAddress, userAgent } })
    .catch(() => {});
  await prisma.contractor.update({ where: { id: contractor.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const token = signContractorAuthToken(contractor.id);
  const full = await prisma.contractor.findUnique({ where: { id: contractor.id }, select: contractorSelfSelect });
  res.json({ token, contractor: full });
});

router.post("/verify-email", authLimiter, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await verifyContractorEmailToken(parsed.data.token));
});

// Lets someone who mistyped their email at registration, or whose verification email
// never arrived, get a fresh link without needing staff to intervene.
router.post("/resend-verification", authLimiter, async (req, res) => {
  const parsed = resendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const contractor = await prisma.contractor.findFirst({ where: { contactEmail: parsed.data.email } });
  // Same response whether or not the email exists — confirming which emails are
  // registered contractors would itself be a data leak.
  if (contractor && contractor.contactEmail && !contractor.emailVerifiedAt) {
    await sendContractorVerificationEmail(contractor.id, contractor.contactEmail, contractor.contactName);
  }
  res.json({ message: "If that email is registered and not yet verified, a new verification link has been sent." });
});

router.get("/me", requireContractorAuth, async (req, res) => {
  const contractor = await prisma.contractor.findUnique({ where: { id: req.contractorAuth!.contractorId }, select: contractorSelfSelect });
  if (!contractor) return res.status(404).json({ error: "Contractor not found" });
  res.json(contractor);
});

router.get("/me/permits", requireContractorAuth, async (req, res) => {
  const permits = await prisma.permitToWork.findMany({
    where: { contractorId: req.contractorAuth!.contractorId },
    select: permitSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(permits);
});

router.get("/me/documents/:docId/download", requireContractorAuth, async (req, res) => {
  const doc = await prisma.contractorDocument.findFirst({
    where: { id: req.params.docId, contractorId: req.contractorAuth!.contractorId },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.send(Buffer.from(doc.fileData));
});

router.post("/change-password", requireContractorAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const contractor = await prisma.contractor.findUnique({ where: { id: req.contractorAuth!.contractorId } });
  if (!contractor?.passwordHash) return res.status(404).json({ error: "Contractor not found" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, contractor.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.contractor.update({ where: { id: contractor.id }, data: { passwordHash } });
  res.status(204).send();
});

export default router;
