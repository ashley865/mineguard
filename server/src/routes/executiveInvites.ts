import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { signAuthToken } from "../lib/jwt";
import { authLimiter } from "../middleware/rateLimit";

const router = Router();

// "OTHER" is intentionally excluded here: every invited executive must be given a defined
// position so their dashboard access can be scoped correctly.
const executiveTitleEnum = z.enum([
  "GENERAL_MANAGER",
  "CFO",
  "COO",
  "HR_MANAGER",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
]);

const createInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  title: executiveTitleEnum,
});

const acceptInviteSchema = z.object({
  key: z.string().min(1),
  password: z.string().min(8),
});

const inviteSelect = {
  id: true,
  name: true,
  email: true,
  title: true,
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
  res.json({ name: invite.name, email: invite.email, title: invite.title, mine: invite.mine });
});

router.post("/:id/accept", authLimiter, async (req, res) => {
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

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: invite.email,
      passwordHash,
      name: invite.name,
      role: "EXECUTIVE",
      title: invite.title,
      mineId: invite.mineId,
    },
  });
  await prisma.executiveInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedUserId: user.id },
  });

  const token = signAuthToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, mineId: user.mineId },
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
  const keyHash = await bcrypt.hash(key, 12);
  const invite = await prisma.executiveInvite.create({
    data: {
      mineId: admin.mineId,
      name: parsed.data.name,
      email: parsed.data.email,
      title: parsed.data.title,
      keyHash,
      invitedById: admin.id,
    },
    select: inviteSelect,
  });
  res.status(201).json({ invite, key });
});

router.post("/:id/revoke", async (req, res) => {
  const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!admin?.mineId) return res.status(404).json({ error: "Not a member of a mine" });
  const invite = await prisma.executiveInvite.findFirst({ where: { id: req.params.id, mineId: admin.mineId } });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.status !== "PENDING") return res.status(409).json({ error: "Only pending invites can be revoked" });
  const updated = await prisma.executiveInvite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" },
    select: inviteSelect,
  });
  res.json(updated);
});

export default router;
