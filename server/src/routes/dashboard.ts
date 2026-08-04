import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { computeComplianceScore } from "../services/complianceScore";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

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
    prisma.site.count({ where: { mineId } }),
    prisma.sensor.count({ where: { zone: { site: { mineId } } } }),
    prisma.alert.count({ where: { status: "OPEN", site: { mineId } } }),
    prisma.alert.count({ where: { status: "OPEN", severity: "CRITICAL", site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.incident.count({ where: { status: { not: "RESOLVED" }, site: { mineId } } }),
    prisma.equipment.count({ where: { status: "DOWN", site: { mineId } } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.worker.groupBy({ by: ["status"], _count: true, where: { site: { mineId } } }),
    prisma.equipment.groupBy({ by: ["status"], _count: true, where: { site: { mineId } } }),
    computeComplianceScore(mineId),
  ]);

  const workforceStatus = { ON_SHIFT: 0, OFF_SHIFT: 0, EMERGENCY: 0 } as Record<string, number>;
  for (const row of workersByStatus) workforceStatus[row.status] = row._count;

  const equipmentStatus = { OPERATIONAL: 0, MAINTENANCE: 0, DOWN: 0 } as Record<string, number>;
  for (const row of equipmentByStatus) equipmentStatus[row.status] = row._count;

  const recentAlerts = await prisma.alert.findMany({
    where: { status: "OPEN", site: { mineId } },
    include: {
      site: { select: { name: true } },
      zone: { select: { name: true } },
      sensor: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const sites = await prisma.site.findMany({
    where: { mineId },
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
