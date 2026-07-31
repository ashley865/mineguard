import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeComplianceScore } from "../services/complianceScore";
import { getAssignedSiteIds } from "../services/executiveSites";

const router = Router();

router.use(requireAuth, requireRole("EXECUTIVE", "ADMIN"));

router.get("/summary", async (req, res) => {
  const [
    sitesByStatus,
    openAlertsBySeverity,
    openIncidents,
    investigatingIncidents,
    resolvedIncidents,
    totalWorkers,
    onShiftWorkers,
    totalEquipment,
    operationalEquipment,
    pendingAlerts,
    pendingIncidents,
  ] = await Promise.all([
    prisma.site.groupBy({ by: ["status"], _count: true }),
    prisma.alert.groupBy({ by: ["severity"], where: { status: "OPEN" }, _count: true }),
    prisma.incident.count({ where: { status: "OPEN" } }),
    prisma.incident.count({ where: { status: "INVESTIGATING" } }),
    prisma.incident.count({ where: { status: "RESOLVED" } }),
    prisma.worker.count(),
    prisma.worker.count({ where: { status: "ON_SHIFT" } }),
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "OPERATIONAL" } }),
    prisma.alert.findMany({
      where: { reviewStatus: "PENDING", severity: { in: ["HIGH", "CRITICAL"] } },
      include: { site: { select: { id: true, name: true } }, zone: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.incident.findMany({
      where: { reviewStatus: "PENDING" },
      include: { site: { select: { id: true, name: true } }, zone: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const recentIncidents = await prisma.incident.findMany({
    where: { createdAt: { gte: fourteenDaysAgo } },
    select: { createdAt: true },
  });

  const trendMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    trendMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const incident of recentIncidents) {
    const key = incident.createdAt.toISOString().slice(0, 10);
    if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }

  const siteStatus = { OPERATIONAL: 0, RESTRICTED: 0, SHUT_DOWN: 0 } as Record<string, number>;
  for (const row of sitesByStatus) siteStatus[row.status] = row._count;

  const alertSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openAlertsBySeverity) alertSeverity[row.severity] = row._count;

  const { score: complianceScore } = await computeComplianceScore();

  const assignedSiteIds = req.auth!.role === "EXECUTIVE" ? await getAssignedSiteIds(req.auth!.userId) : null;
  const siteFilter = assignedSiteIds ? { siteId: { in: assignedSiteIds } } : {};
  const [visitorsOnSite, pendingPermitsToWork, escalatedRisks, staffOnSite, truckDriversOnSite] = await Promise.all([
    prisma.visitor.count({ where: { status: "CHECKED_IN", ...siteFilter } }),
    prisma.permitToWork.count({ where: { status: "PENDING_EXECUTIVE", ...siteFilter } }),
    prisma.riskAssessment.count({ where: { escalated: true, mitigationStatus: { in: ["OPEN", "IN_PROGRESS"] }, ...siteFilter } }),
    prisma.workerAttendance.count({
      where: { checkOutAt: null, worker: assignedSiteIds ? { siteId: { in: assignedSiteIds } } : undefined },
    }),
    prisma.delivery.count({ where: { status: "CHECKED_IN", ...siteFilter } }),
  ]);

  res.json({
    siteStatus,
    alertSeverity,
    complianceScore,
    executiveOps: {
      hasSiteAccess: assignedSiteIds === null || assignedSiteIds.length > 0,
      visitorsOnSite,
      pendingPermitsToWork,
      escalatedRisks,
      peopleOnSite: {
        visitors: visitorsOnSite,
        staff: staffOnSite,
        truckDrivers: truckDriversOnSite,
        total: visitorsOnSite + staffOnSite + truckDriversOnSite,
      },
    },
    incidents: {
      open: openIncidents,
      investigating: investigatingIncidents,
      resolved: resolvedIncidents,
    },
    incidentTrend: Array.from(trendMap.entries()).map(([date, count]) => ({ date, count })),
    workers: { total: totalWorkers, onShift: onShiftWorkers },
    equipment: {
      total: totalEquipment,
      operational: operationalEquipment,
      uptimePct: totalEquipment === 0 ? 100 : Math.round((operationalEquipment / totalEquipment) * 1000) / 10,
    },
    pendingReviews: {
      alerts: pendingAlerts,
      incidents: pendingIncidents,
    },
  });
});

export default router;
