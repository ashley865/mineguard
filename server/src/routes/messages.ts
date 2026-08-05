import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const sendSchema = z
  .object({
    recipientId: z.string().min(1).optional(),
    groupId: z.string().min(1).optional(),
    body: z.string().min(1).max(4000),
  })
  .refine((data) => !!data.recipientId !== !!data.groupId, {
    message: "Provide exactly one of recipientId or groupId",
  });

const groupSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1),
});

const contactSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  title: true,
} as const;

const messageSelect = {
  id: true,
  senderId: true,
  recipientId: true,
  groupId: true,
  body: true,
  readAt: true,
  createdAt: true,
  sender: { select: contactSelect },
  recipient: { select: contactSelect },
} as const;

const groupSelect = {
  id: true,
  name: true,
  createdById: true,
  createdAt: true,
  members: { select: { user: { select: contactSelect } } },
} as const;

function withGroupMembers<T extends { members: { user: unknown }[] }>(group: T) {
  const { members, ...rest } = group;
  return { ...rest, members: members.map((m) => m.user) };
}

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/contacts", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const contacts = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "EXECUTIVE"] }, mineId, id: { not: req.auth!.userId } },
    select: contactSelect,
    orderBy: { name: "asc" },
  });

  const unread = await prisma.message.groupBy({
    by: ["senderId"],
    where: { recipientId: req.auth!.userId, readAt: null },
    _count: true,
  });
  const unreadBySender = new Map(unread.map((row) => [row.senderId, row._count]));

  res.json(contacts.map((c) => ({ ...c, unreadCount: unreadBySender.get(c.id) ?? 0 })));
});

router.get("/unread-count", async (req, res) => {
  const count = await prisma.message.count({ where: { recipientId: req.auth!.userId, readAt: null } });
  res.json({ count });
});

router.get("/groups", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const groups = await prisma.messageGroup.findMany({
    where: { mineId, members: { some: { userId: req.auth!.userId } } },
    select: groupSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(groups.map(withGroupMembers));
});

router.post("/groups", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const memberIds = Array.from(new Set([...parsed.data.memberIds, req.auth!.userId]));
  const validMembers = await prisma.user.findMany({
    where: { id: { in: memberIds }, mineId, role: { in: ["ADMIN", "EXECUTIVE"] } },
    select: { id: true },
  });
  if (validMembers.length < 2) {
    return res.status(400).json({ error: "A group needs at least one other Admin or Executive member" });
  }

  const group = await prisma.messageGroup.create({
    data: {
      mineId,
      name: parsed.data.name,
      createdById: req.auth!.userId,
      members: { createMany: { data: validMembers.map((m) => ({ userId: m.id })) } },
    },
    select: groupSelect,
  });

  const io = req.app.get("io");
  if (io) for (const m of validMembers) io.to(`user:${m.id}`).emit("group:new", withGroupMembers(group));

  res.status(201).json(withGroupMembers(group));
});

router.get("/groups/:id/thread", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const membership = await prisma.messageGroupMember.findFirst({
    where: { groupId: req.params.id, userId: req.auth!.userId, group: { mineId } },
  });
  if (!membership) return res.status(404).json({ error: "Group not found" });

  const messages = await prisma.message.findMany({
    where: { groupId: req.params.id },
    select: messageSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json(messages);
});

router.get("/thread/:userId", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const otherId = req.params.userId;
  const other = await prisma.user.findFirst({ where: { id: otherId, mineId } });
  if (!other) return res.status(404).json({ error: "User not found" });

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.auth!.userId, recipientId: otherId },
        { senderId: otherId, recipientId: req.auth!.userId },
      ],
    },
    select: messageSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  await prisma.message.updateMany({
    where: { senderId: otherId, recipientId: req.auth!.userId, readAt: null },
    data: { readAt: new Date() },
  });

  res.json(messages);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const io = req.app.get("io");

  if (parsed.data.groupId) {
    const membership = await prisma.messageGroupMember.findFirst({
      where: { groupId: parsed.data.groupId, userId: req.auth!.userId, group: { mineId } },
      include: { group: { include: { members: true } } },
    });
    if (!membership) return res.status(404).json({ error: "Group not found" });

    const message = await prisma.message.create({
      data: { senderId: req.auth!.userId, groupId: parsed.data.groupId, body: parsed.data.body },
      select: messageSelect,
    });

    if (io) for (const m of membership.group.members) io.to(`user:${m.userId}`).emit("message:new", message);
    return res.status(201).json(message);
  }

  const recipient = await prisma.user.findFirst({ where: { id: parsed.data.recipientId, mineId } });
  if (!recipient || !["ADMIN", "EXECUTIVE"].includes(recipient.role)) {
    return res.status(400).json({ error: "Recipient must be an Admin or Executive" });
  }
  if (recipient.id === req.auth!.userId) {
    return res.status(400).json({ error: "You can't message yourself" });
  }

  const message = await prisma.message.create({
    data: { senderId: req.auth!.userId, recipientId: recipient.id, body: parsed.data.body },
    select: messageSelect,
  });

  if (io) io.to(`user:${recipient.id}`).to(`user:${req.auth!.userId}`).emit("message:new", message);

  res.status(201).json(message);
});

export default router;
