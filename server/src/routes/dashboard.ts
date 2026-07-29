import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/summary", async (_req, res) => {
  const [siteCount, sensorCount, openAlerts, criticalAlerts, onShiftWorkers, openIncidents, equipmentDown] =
    await Promise.all([
      prisma.site.count(),
      prisma.sensor.count(),
      prisma.alert.count({ where: { status: "OPEN" } }),
      prisma.alert.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
      prisma.worker.count({ where: { status: "ON_SHIFT" } }),
      prisma.incident.count({ where: { status: { not: "RESOLVED" } } }),
      prisma.equipment.count({ where: { status: "DOWN" } }),
    ]);

  const recentAlerts = await prisma.alert.findMany({
    where: { status: "OPEN" },
    include: {
      site: { select: { name: true } },
      zone: { select: { name: true } },
      sensor: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const sites = await prisma.site.findMany({
    include: {
      _count: { select: { workers: true, alerts: true } },
      zones: {
        include: {
          sensors: {
            include: { readings: { orderBy: { recordedAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  res.json({
    counts: {
      siteCount,
      sensorCount,
      openAlerts,
      criticalAlerts,
      onShiftWorkers,
      openIncidents,
      equipmentDown,
    },
    recentAlerts,
    sites,
  });
});

export default router;
