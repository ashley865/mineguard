import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const siteId = req.query.siteId as string | undefined;
  const alerts = await prisma.alert.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(siteId ? { siteId } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      sensor: { select: { id: true, name: true, type: true } },
      acknowledgedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(alerts);
});

router.post("/:id/acknowledge", async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: req.auth!.userId,
      },
    });
    const io = req.app.get("io");
    io?.emit("alert:updated", alert);
    res.json(alert);
  } catch {
    res.status(404).json({ error: "Alert not found" });
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    const io = req.app.get("io");
    io?.emit("alert:updated", alert);
    res.json(alert);
  } catch {
    res.status(404).json({ error: "Alert not found" });
  }
});

export default router;
