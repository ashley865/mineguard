import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { computeComplianceScore } from "../services/complianceScore";

const router = Router();

router.use(requireAuth);

router.get("/summary", async (_req, res) => {
  const [
    siteCount,
    sensorCount,
    openAlerts,
    criticalAlerts,
    onShiftWorkers,
    openIncidents,
    equipmentDown,
    totalWorkers,
    totalEquipment,
    workersByStatus,
    equipmentByStatus,
    { score: complianceScore },
  ] = await Promise.all([
    prisma.site.count(),
    prisma.sensor.count(),
    prisma.alert.count({ where: { status: "OPEN" } }),
    prisma.alert.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
    prisma.worker.count({ where: { status: "ON_SHIFT" } }),
    prisma.incident.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.equipment.count({ where: { status: "DOWN" } }),
    prisma.worker.count(),
    prisma.equipment.count(),
    prisma.worker.groupBy({ by: ["status"], _count: true }),
    prisma.equipment.groupBy({ by: ["status"], _count: true }),
    computeComplianceScore(),
  ]);

  const workforceStatus = { ON_SHIFT: 0, OFF_SHIFT: 0, EMERGENCY: 0 } as Record<string, number>;
  for (const row of workersByStatus) workforceStatus[row.status] = row._count;

  const equipmentStatus = { OPERATIONAL: 0, MAINTENANCE: 0, DOWN: 0 } as Record<string, number>;
  for (const row of equipmentByStatus) equipmentStatus[row.status] = row._count;

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
    workforce: { total: totalWorkers, byStatus: workforceStatus },
    equipmentSummary: { total: totalEquipment, byStatus: equipmentStatus },
    complianceScore,
    recentAlerts,
    sites,
  });
});

export default router;
