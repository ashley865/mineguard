import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageFileFilter } from "../lib/uploadFilters";
import { signAuthToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";
import { verifyAdminPassword } from "../lib/verifyPassword";
import { isIpBlocked } from "../lib/ipBlocklist";
import { autoBlockMineIpIfBruteForced } from "../lib/autoBlock";
import { buildOtpAuthUrl, generateMfaSecret, verifyMfaToken } from "../lib/totp";
import { resolveBooleanSetting } from "../lib/systemSettings";
import { isCyberPrivilegedUser } from "../lib/cyberAccess";
import { verifyAndConsumeBackupCode } from "../lib/mfaBackupCodes";
import { notifySecurityWebhook } from "../lib/securityWebhook";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  mineId: z.string().min(1),
  passkey: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().trim().max(32).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const removeExecutiveSchema = z.object({
  password: z.string().min(1),
});

router.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name, mineId, passkey } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const mine = await prisma.mine.findUnique({ where: { id: mineId } });
  if (!mine) {
    return res.status(404).json({ error: "Mine not found" });
  }
  const passkeyValid = await bcrypt.compare(passkey, mine.passkeyHash);
  if (!passkeyValid) {
    return res.status(401).json({ error: "Invalid mine passkey" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "ADMIN", mineId: mine.id },
  });

  const token = signAuthToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, mineId: user.mineId, mfaEnabled: user.mfaEnabled },
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, mfaCode } = parsed.data;
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.mineId && (await isIpBlocked(user.mineId, ipAddress))) {
    await prisma.cyberLoginEvent
      .create({ data: { mineId: user.mineId, userId: user.id, eventType: "BLOCKED", ipAddress, userAgent, flagged: true } })
      .catch(() => {});
    return res.status(403).json({ error: "Access blocked from this network" });
  }
  // Owners and IT Managers can always log in during maintenance — they're the only
  // roles that can turn it back off from Cyber Command Center, so blocking them too
  // would be a self-lockout.
  if (!isCyberPrivilegedUser(user.role, user.title) && (await resolveBooleanSetting("MAINTENANCE_MODE", false))) {
    return res.status(503).json({ error: "MineGuard is temporarily down for maintenance. Please try again shortly.", maintenance: true });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    // Feeds Identity & Access Security's "access violations" view — logged against the
    // real account since the email did resolve to one, unlike a nonexistent-email
    // attempt (which the rate limiter already covers and this table doesn't need to
    // retain arbitrary attacker-supplied strings for).
    if (user.mineId) {
      await prisma.cyberLoginEvent
        .create({ data: { mineId: user.mineId, userId: user.id, eventType: "LOGIN_FAILED", ipAddress, userAgent, flagged: true } })
        .catch(() => {});
      await autoBlockMineIpIfBruteForced(user.mineId, ipAddress);
    }
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: "This account has been deactivated. Contact your mine owner for access." });
  }

  // A correct password alone is not enough once MFA is on: the client resubmits this
  // same request with an added mfaCode once it sees mfaRequired, rather than a separate
  // pre-auth token/session — the password has already been verified above either way, so
  // there's nothing sensitive being repeated, just a second field.
  let usedBackupCode = false;
  if (user.mfaEnabled) {
    if (!mfaCode) {
      return res.status(401).json({ error: "MFA code required", mfaRequired: true });
    }
    const totpValid = !!user.mfaSecret && verifyMfaToken(user.mfaSecret, mfaCode);
    // A backup code is only ever checked once the real TOTP code has already failed —
    // it's a fallback for a lost authenticator, not an alternate everyday path, and every
    // use consumes it (lib/mfaBackupCodes.ts) so it can never be replayed.
    if (!totpValid) usedBackupCode = await verifyAndConsumeBackupCode(user.id, mfaCode, ipAddress, userAgent);
    if (!totpValid && !usedBackupCode) {
      if (user.mineId) {
        await prisma.cyberLoginEvent
          .create({ data: { mineId: user.mineId, userId: user.id, eventType: "LOGIN_FAILED", ipAddress, userAgent, flagged: true } })
          .catch(() => {});
        await autoBlockMineIpIfBruteForced(user.mineId, ipAddress);
      }
      return res.status(401).json({ error: "Invalid MFA code", mfaRequired: true });
    }
  }

  if (user.mineId) {
    await prisma.cyberLoginEvent
      .create({ data: { mineId: user.mineId, userId: user.id, eventType: "LOGIN_SUCCESS", ipAddress, userAgent, flagged: usedBackupCode } })
      .catch(() => {});
  }
  if (usedBackupCode) {
    void notifySecurityWebhook({
      severity: "HIGH",
      title: "MFA backup code used to log in",
      detail: `${user.name} (${user.email}) logged in using a backup code instead of their authenticator app, from ${ipAddress ?? "an unknown IP"}.`,
    });
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  // Executives are clocked in automatically the moment they log in, rather than
  // relying on them to remember to use the header clock-in widget themselves.
  if (user.role === "EXECUTIVE") {
    const openRecord = await prisma.userAttendance.findFirst({ where: { userId: user.id, checkOutAt: null } });
    if (!openRecord) {
      await prisma.userAttendance.create({ data: { userId: user.id } });
    }
  }

  const token = signAuthToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, mineId: user.mineId, mfaEnabled: user.mfaEnabled },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    title: user.title,
    mineId: user.mineId,
    hasPhoto: !!user.photoData,
    mfaEnabled: user.mfaEnabled,
  });
});

router.put("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { name: parsed.data.name, phone: parsed.data.phone !== undefined ? parsed.data.phone || null : undefined },
  });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    title: user.title,
    mineId: user.mineId,
    hasPhoto: !!user.photoData,
    mfaEnabled: user.mfaEnabled,
  });
});

router.post("/change-password", requireAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.status(204).send();
});

const mfaVerifySchema = z.object({ token: z.string().min(1) });
const mfaDisableSchema = z.object({ password: z.string().min(1) });

// Generates a fresh secret and stores it, but does NOT enable MFA yet — mfaEnabled only
// flips to true once the user proves they actually captured it (POST /mfa/verify), so a
// half-finished setup (secret saved, QR never scanned) can't silently lock nothing in but
// also can't be mistaken for MFA actually being active.
router.post("/mfa/setup", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const secret = generateMfaSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret, mfaEnabled: false } });
  res.json({ secret, otpauthUrl: buildOtpAuthUrl(secret, user.email) });
});

router.post("/mfa/verify", requireAuth, async (req, res) => {
  const parsed = mfaVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.mfaSecret) return res.status(400).json({ error: "Start MFA setup first" });
  if (!verifyMfaToken(user.mfaSecret, parsed.data.token)) {
    return res.status(401).json({ error: "Invalid code. Check your authenticator app and try again." });
  }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  res.status(204).send();
});

// Requires re-confirming the password, matching the pattern used for other
// security-sensitive self-service actions (change-password).
router.post("/mfa/disable", requireAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = mfaDisableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Incorrect password" });
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
  res.status(204).send();
});

router.post("/me/photo", requireAuth, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A photo file is required" });
  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { photoData: Uint8Array.from(req.file.buffer), photoMimeType: req.file.mimetype },
  });
  res.status(204).send();
});

router.get("/users/:id/photo", requireAuth, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, mineId: req.auth!.mineId ?? undefined },
    select: { photoData: true, photoMimeType: true },
  });
  if (!user?.photoData || !user.photoMimeType) return res.status(404).json({ error: "No photo set" });
  res.setHeader("Content-Type", user.photoMimeType);
  res.send(Buffer.from(user.photoData));
});

router.get("/team", requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { mineId: req.auth!.mineId ?? undefined, role: { in: ["ADMIN", "EXECUTIVE"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      photoMimeType: true,
      createdAt: true,
      _count: { select: { reviewedAlerts: true, reviewedIncidents: true, sentMessages: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      title: u.title,
      hasPhoto: !!u.photoMimeType,
      createdAt: u.createdAt,
      stats: {
        alertsReviewed: u._count.reviewedAlerts,
        incidentsReviewed: u._count.reviewedIncidents,
        messagesSent: u._count.sentMessages,
      },
    }))
  );
});

// Revokes an executive's access AND bans the account from logging back in at all —
// not even as a viewer. Their historical records (reviewed alerts, incidents, messages,
// etc.) stay intact since the account isn't deleted, just deactivated. Requires
// re-confirming the admin's own password, matching the pattern used for other
// irreversible admin actions.
router.post("/team/:id/remove-executive", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = removeExecutiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const passwordOk = await verifyAdminPassword(req.auth!.userId, parsed.data.password);
  if (!passwordOk) return res.status(401).json({ error: "Incorrect password" });

  const target = await prisma.user.findFirst({
    where: { id: req.params.id, mineId: req.auth!.mineId ?? undefined, role: "EXECUTIVE" },
  });
  if (!target) return res.status(404).json({ error: "Executive not found" });

  await prisma.$transaction([
    prisma.executiveSiteAssignment.deleteMany({ where: { userId: target.id } }),
    prisma.user.update({ where: { id: target.id }, data: { role: "VIEWER", title: null, isActive: false } }),
  ]);
  res.status(204).send();
});

export default router;
