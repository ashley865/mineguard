import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { imageFileFilter } from "../lib/uploadFilters";
import { signAuthToken } from "../lib/jwt";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimit";

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
});

const updateProfileSchema = z.object({
  name: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
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

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "ADMIN", mineId: mine.id },
  });

  const token = signAuthToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, mineId: user.mineId },
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signAuthToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, mineId: user.mineId },
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
    role: user.role,
    title: user.title,
    mineId: user.mineId,
    hasPhoto: !!user.photoData,
  });
});

router.put("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data: { name: parsed.data.name },
  });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    title: user.title,
    mineId: user.mineId,
    hasPhoto: !!user.photoData,
  });
});

router.post("/change-password", requireAuth, passwordChangeLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
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

export default router;
