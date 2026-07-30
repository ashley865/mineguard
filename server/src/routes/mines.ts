import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

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

function signToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

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

router.post("/register", async (req, res) => {
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

  const token = signToken(user.id, user.role);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mineId: mine.id },
    mine: { id: mine.id, name: mine.name, location: mine.location },
    passkey,
  });
});

export default router;
