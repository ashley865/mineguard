import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requirePlatformAdminAuth } from "../middleware/platformAdminAuth";
import { signPlatformAdminToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const selfSelect = { id: true, name: true, email: true, createdAt: true } as const;

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signPlatformAdminToken(admin.id);
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

router.get("/me", requirePlatformAdminAuth, async (req, res) => {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdminAuth!.platformAdminId }, select: selfSelect });
  if (!admin) return res.status(404).json({ error: "Not found" });
  res.json(admin);
});

router.post("/change-password", requirePlatformAdminAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdminAuth!.platformAdminId } });
  if (!admin) return res.status(404).json({ error: "Not found" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
  res.status(204).send();
});

export default router;
