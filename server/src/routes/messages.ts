import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const sendSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().min(1).max(4000),
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
  body: true,
  readAt: true,
  createdAt: true,
  sender: { select: contactSelect },
  recipient: { select: contactSelect },
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/contacts", async (req, res) => {
  const contacts = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "EXECUTIVE"] }, id: { not: req.auth!.userId } },
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

router.get("/thread/:userId", async (req, res) => {
  const otherId = req.params.userId;
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
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const recipient = await prisma.user.findUnique({ where: { id: parsed.data.recipientId } });
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

  const io = req.app.get("io");
  if (io) io.emit("message:new", message);

  res.status(201).json(message);
});

export default router;
