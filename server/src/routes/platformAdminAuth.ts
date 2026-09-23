import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requirePlatformAdminAuth } from "../middleware/platformAdminAuth";
import { signPlatformAdminToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";
import { generatePlatformAdminAccessKey, verifyPlatformAdminAccessKey } from "../lib/platformAdminKeys";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const keyLoginSchema = z.object({
  accessKey: z.string().min(1),
});

const bootstrapSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const selfSelect = { id: true, name: true, email: true, createdAt: true, accessKeyIssuedAt: true } as const;

/**
 * Creates the very first platform admin, with a generated access key rather than a
 * password: this exists specifically because there is otherwise no way to create that
 * first account without already having direct database access, which defeats the point of
 * an admin tool. Self-disables the moment any admin exists — from then on, only an
 * authenticated admin can create more (see routes/platformAdminAuth.ts's future admin
 * creation, or rotate-key below for replacing a lost key).
 */
router.post("/bootstrap", authLimiter, async (req, res) => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existingCount = await prisma.platformAdmin.count();
  if (existingCount > 0) {
    return res.status(403).json({ error: "A platform admin already exists. Ask an existing admin for access, or use rotate-key if you are one." });
  }

  const { key, hash } = await generatePlatformAdminAccessKey();
  const admin = await prisma.platformAdmin.create({
    data: { name: parsed.data.name, email: parsed.data.email, accessKeyHash: hash, accessKeyIssuedAt: new Date() },
  });
  res.status(201).json({ accessKey: key, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });
  if (!admin?.passwordHash || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signPlatformAdminToken(admin.id);
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

/**
 * Access-key login takes no email — the key alone identifies the admin, the same reasoning
 * as authenticateAgent in routes/sensorAgentApi.ts: platform admins are few, so scanning
 * them and comparing the bcrypt hash of each is cheap and bounded, and there's nothing to
 * look an admin up by directly since a bcrypt hash isn't derivable from its plaintext.
 */
router.post("/login-with-key", authLimiter, async (req, res) => {
  const parsed = keyLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const candidates = await prisma.platformAdmin.findMany({ where: { accessKeyHash: { not: null } } });
  for (const admin of candidates) {
    if (admin.accessKeyHash && (await verifyPlatformAdminAccessKey(parsed.data.accessKey, admin.accessKeyHash))) {
      const token = signPlatformAdminToken(admin.id);
      return res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
    }
  }
  res.status(401).json({ error: "Invalid access key" });
});

router.get("/me", requirePlatformAdminAuth, async (req, res) => {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdminAuth!.platformAdminId }, select: selfSelect });
  if (!admin) return res.status(404).json({ error: "Not found" });
  res.json(admin);
});

// Rotating immediately invalidates the previous key — how a leaked or lost key is dealt
// with, mirroring routes/sensors.ts's device-key rotation.
router.post("/rotate-key", requirePlatformAdminAuth, passwordChangeLimiter, async (req, res) => {
  const { key, hash } = await generatePlatformAdminAccessKey();
  await prisma.platformAdmin.update({
    where: { id: req.platformAdminAuth!.platformAdminId },
    data: { accessKeyHash: hash, accessKeyIssuedAt: new Date() },
  });
  res.status(201).json({ accessKey: key });
});

router.post("/change-password", requirePlatformAdminAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdminAuth!.platformAdminId } });
  if (!admin) return res.status(404).json({ error: "Not found" });
  if (!admin.passwordHash) {
    return res.status(400).json({ error: "This account has no password set. Use rotate-key to get a new access key instead." });
  }
  const valid = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
  res.status(204).send();
});

export default router;
