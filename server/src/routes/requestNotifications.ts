import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Only ever the caller's own rows — recipientId is never taken from the request, so
// there's no way to read another user's notifications by guessing an id.
router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.auth!.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(notifications);
});

router.post("/:id/read", async (req, res) => {
  const existing = await prisma.notification.findFirst({ where: { id: req.params.id, recipientId: req.auth!.userId } });
  if (!existing) return res.status(404).json({ error: "Notification not found" });
  const updated = await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
  res.json(updated);
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.auth!.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).send();
});

export default router;
