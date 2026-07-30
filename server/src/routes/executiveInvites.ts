import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const createInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const acceptInviteSchema = z.object({
  key: z.string().min(1),
  password: z.string().min(8),
});

function signToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

const inviteSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
  acceptedAt: true,
  invitedBy: { select: { id: true, name: true } },
  acceptedUser: { select: { id: true, name: true, email: true } },
} as const;

// Public: lets the invite landing page show who the invite is for before accepting.
router.get("/:id/info", async (req, res) => {
  const invite = await prisma.executiveInvite.findUnique({
    where: { id: req.params.id },
    include: { mine: { select: { id: true, name: true } } },
  });
  if (!invite || invite.status !== "PENDING") {
    return res.status(404).json({ error: "This invite is invalid, already used, or has been revoked" });
  }
  res.json({ name: invite.name, email: invite.email, mine: invite.mine });
});

router.post("/:id/accept", async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const invite = await prisma.executiveInvite.findUnique({ where: { id: req.params.id } });
  if (!invite || invite.status !== "PENDING") {
    return res.status(404).json({ error: "This invite is invalid, already used, or has been revoked" });
  }
  const keyValid = await bcrypt.compare(parsed.data.key, invite.keyHash);
  if (!keyValid) return res.status(401).json({ error: "Invalid invite key" });

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { email: invite.email, passwordHash, name: invite.name, role: "EXECUTIVE", mineId: invite.mineId },
  });
  await prisma.executiveInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedUserId: user.id },
  });

  const token = signToken(user.id, user.role);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mineId: user.mineId },
  });
});

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user?.mineId) return res.status(404).json({ error: "Not a member of a mine" });
  const invites = await prisma.executiveInvite.findMany({
    where: { mineId: user.mineId },
    select: inviteSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

router.post("/", async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!admin?.mineId) return res.status(404).json({ error: "Not a member of a mine" });

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) return res.status(409).json({ error: "Email already registered" });

  const key = crypto.randomBytes(20).toString("hex");
  const keyHash = await bcrypt.hash(key, 10);
  const invite = await prisma.executiveInvite.create({
    data: {
      mineId: admin.mineId,
      name: parsed.data.name,
      email: parsed.data.email,
      keyHash,
      invitedById: admin.id,
    },
    select: inviteSelect,
  });
  res.status(201).json({ invite, key });
});

router.post("/:id/revoke", async (req, res) => {
  const invite = await prisma.executiveInvite.findUnique({ where: { id: req.params.id } });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.status !== "PENDING") return res.status(409).json({ error: "Only pending invites can be revoked" });
  const updated = await prisma.executiveInvite.update({
    where: { id: req.params.id },
    data: { status: "REVOKED" },
    select: inviteSelect,
  });
  res.json(updated);
});

export default router;
