import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageFileFilter } from "../lib/uploadFilters";
import { signAuthToken } from "../lib/jwt";
import { authLimiter } from "../middleware/rateLimit";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const mineDetailsSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  registrationNumber: z.string().optional().nullable(),
  miningRightNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const registerMineSchema = z.object({
  mineName: z.string().min(1),
  location: z.string().min(1),
  registrationNumber: z.string().optional(),
  miningRightNumber: z.string().optional(),
  description: z.string().optional(),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

router.get("/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json([]);
  const mines = await prisma.mine.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, location: true },
    take: 10,
  });
  res.json(mines);
});

router.get("/mine", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.mineId) return res.status(404).json({ error: "Not a member of a mine" });
  const mine = await prisma.mine.findUnique({ where: { id: user.mineId } });
  if (!mine) return res.status(404).json({ error: "Mine not found" });
  res.json({
    id: mine.id,
    name: mine.name,
    location: mine.location,
    registrationNumber: mine.registrationNumber,
    miningRightNumber: mine.miningRightNumber,
    description: mine.description,
    hasLogo: !!mine.logoData,
  });
});

router.put("/mine", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = mineDetailsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.mineId) return res.status(404).json({ error: "Not a member of a mine" });
  const mine = await prisma.mine.update({
    where: { id: user.mineId },
    data: {
      name: parsed.data.name,
      location: parsed.data.location,
      registrationNumber: parsed.data.registrationNumber || null,
      miningRightNumber: parsed.data.miningRightNumber || null,
      description: parsed.data.description || null,
    },
  });
  res.json({
    id: mine.id,
    name: mine.name,
    location: mine.location,
    registrationNumber: mine.registrationNumber,
    miningRightNumber: mine.miningRightNumber,
    description: mine.description,
    hasLogo: !!mine.logoData,
  });
});

router.post("/mine/logo", requireAuth, requireRole("ADMIN"), upload.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A logo file is required" });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.mineId) return res.status(404).json({ error: "Not a member of a mine" });
  await prisma.mine.update({
    where: { id: user.mineId },
    data: {
      logoData: Uint8Array.from(req.file.buffer),
      logoMimeType: req.file.mimetype,
      logoFileName: req.file.originalname,
    },
  });
  res.status(204).send();
});

router.get("/:id/logo", async (req, res) => {
  const mine = await prisma.mine.findUnique({
    where: { id: req.params.id },
    select: { logoData: true, logoMimeType: true },
  });
  if (!mine?.logoData || !mine.logoMimeType) return res.status(404).json({ error: "No logo set" });
  res.setHeader("Content-Type", mine.logoMimeType);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(Buffer.from(mine.logoData));
});

router.get("/:id", async (req, res) => {
  const mine = await prisma.mine.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, location: true, logoData: true },
  });
  if (!mine) return res.status(404).json({ error: "Mine not found" });
  res.json({ id: mine.id, name: mine.name, location: mine.location, hasLogo: !!mine.logoData });
});

router.post("/register", authLimiter, async (req, res) => {
  const parsed = registerMineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { mineName, location, registrationNumber, miningRightNumber, description, adminName, adminEmail, adminPassword } =
    parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passkey = crypto.randomBytes(20).toString("hex");
  const passkeyHash = await bcrypt.hash(passkey, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const mine = await prisma.mine.create({
    data: {
      name: mineName,
      location,
      registrationNumber: registrationNumber || undefined,
      miningRightNumber: miningRightNumber || undefined,
      description: description || undefined,
      passkeyHash,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: adminName,
      role: "ADMIN",
      mineId: mine.id,
    },
  });

  const token = signAuthToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mineId: mine.id },
    mine: { id: mine.id, name: mine.name, location: mine.location },
    passkey,
  });
});

export default router;
