import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// The engineering appointee owns this view; GM and COO carry accountability for plant
// availability too. Operations Manager is deliberately excluded — they have their own
// dashboard covering the production side of the same equipment, and this one is scoped to
// the engineering accountability (asset integrity, maintenance discipline, statutory
// inspections) rather than output.
const ENGINEERING_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["ENGINEERING_MANAGER", "GENERAL_MANAGER", "COO"];

async function requireEngineeringAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !ENGINEERING_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const DUE_SOON_DAYS = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * The engineering view of the same plant Operations reports on, scoped to what the 2.13.1
 * appointee is accountable for: is the asset base being maintained, and are the statutory
 * inspections current.
 *
 * The headline leads on maintenance discipline (planned share) rather than uptime, because
 * uptime is the symptom Operations already tracks — a fleet held up by emergency callouts
 * can show good uptime right up until it doesn't, and the planned/reactive split is what
 * says which of those two situations you're in.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireEngineeringAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const dueSoonHorizon = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS);
  const bySite = { site: { mineId } };

  const [
    equipment,
    maintenance,
    consumableParts,
    winders,
    ropes,
    shaftInspections,
    liftingEquipment,
    pressureEquipment,
    electricalInstallations,
    reliabilityProfiles,
    recentFailures,
  ] = await Promise.all([
    prisma.equipment.findMany({
      where: bySite,
      select: { id: true, name: true, type: true, status: true, lastMaintenance: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { equipment: bySite },
      select: {
        id: true,
        maintenanceType: true,
        scheduledDate: true,
        completedDate: true,
        status: true,
        cost: true,
        downtimeMinutes: true,
        equipment: { select: { id: true, name: true } },
      },
    }),
    prisma.equipmentConsumablePart.findMany({
      where: { equipment: bySite, status: "IN_SERVICE" },
      select: {
        id: true,
        partType: true,
        position: true,
        initialMeasurement: true,
        currentMeasurement: true,
        measurementUnit: true,
        equipment: { select: { name: true } },
      },
    }),
    prisma.winder.findMany({
      where: bySite,
      select: {
        id: true,
        name: true,
        shaftName: true,
        status: true,
        inspections: { orderBy: { inspectionDate: "desc" }, take: 1, select: { inspectionDate: true, nextInspectionDue: true, brakeTestResult: true } },
      },
    }),
    prisma.conveyanceRope.findMany({
      where: { winder: bySite, status: "IN_SERVICE" },
      select: { id: true, ropeIdentifier: true, discardDate: true, nextTestDue: true, winder: { select: { name: true } } },
    }),
    prisma.shaftInspection.findMany({
      where: bySite,
      select: { id: true, shaftName: true, inspectionDate: true, nextInspectionDue: true, findings: true },
      orderBy: { inspectionDate: "desc" },
    }),
    // Only items actually in service can be "overdue" — a quarantined sling or an
    // isolated board is already off the job, and counting it again would inflate
    // the number the appointee has to act on.
    prisma.liftingEquipment.findMany({
      where: { ...bySite, status: "IN_SERVICE" },
      select: { id: true, identifier: true, equipmentType: true, nextInspectionDue: true, nextLoadTestDue: true, safeWorkingLoadKg: true },
    }),
    prisma.pressureEquipment.findMany({
      where: { ...bySite, status: "IN_SERVICE" },
      select: { id: true, identifier: true, equipmentType: true, certificateExpiry: true, nextInspectionDue: true, safetyValveNextDue: true },
    }),
    prisma.electricalInstallation.findMany({
      where: { ...bySite, status: "IN_SERVICE" },
      select: { id: true, identifier: true, hazardousArea: true, exProtection: true, exCertificateExpiry: true, earthLeakageProtected: true, nextTestDue: true },
    }),
    prisma.assetReliabilityProfile.findMany({
      where: { equipment: bySite },
      select: { equipmentId: true, criticality: true, targetAvailabilityPct: true, equipment: { select: { name: true } } },
    }),
    prisma.equipmentFailure.findMany({
      where: { equipment: bySite, failureDate: { gte: trendStart } },
      select: { equipmentId: true, failureMode: true, downtimeHours: true, recurrencePrevented: true },
    }),
  ]);

  const countBy = <T, K extends string>(rows: T[], key: (row: T) => K): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const k = key(row);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  const openMaintenance = maintenance.filter((m) => m.status !== "COMPLETED" && m.status !== "CANCELLED");
  const overdueMaintenance = openMaintenance.filter((m) => m.scheduledDate < now);
  const completedLast30 = maintenance.filter((m) => m.completedDate && m.completedDate >= trendStart);

  // The maintenance-maturity ratio: PLANNED/PREVENTIVE/INSPECTION are work you chose to do,
  // CORRECTIVE/EMERGENCY is work the plant forced on you. Computed over completed work in
  // the window rather than the open backlog, since the backlog says what's outstanding, not
  // how the department has actually been operating.
  const proactiveTypes = ["PLANNED", "PREVENTIVE", "INSPECTION"];
  const proactiveCompleted = completedLast30.filter((m) => proactiveTypes.includes(m.maintenanceType));
  const plannedSharePct = completedLast30.length === 0 ? null : Math.round((proactiveCompleted.length / completedLast30.length) * 100);

  const maintenanceCostLast30 = completedLast30.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const maintenanceDowntimeHoursLast30 = completedLast30.reduce((sum, m) => sum + (m.downtimeMinutes ?? 0) / 60, 0);

  const completedByDay = new Map<string, { proactive: number; reactive: number }>();
  for (const m of completedLast30) {
    const key = dayKey(m.completedDate!);
    const bucket = completedByDay.get(key) ?? { proactive: 0, reactive: 0 };
    if (proactiveTypes.includes(m.maintenanceType)) bucket.proactive += 1;
    else bucket.reactive += 1;
    completedByDay.set(key, bucket);
  }
  const maintenanceSeries: { date: string; proactive: number; reactive: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    const bucket = completedByDay.get(key);
    maintenanceSeries.push({ date: key, proactive: bucket?.proactive ?? 0, reactive: bucket?.reactive ?? 0 });
  }

  // Statutory asset inspections, all of which carry a hard regulatory interval: winder
  // inspections, rope discard/test dates and shaft inspections. Grouped into one headline
  // number because to the appointee they're a single obligation — "is my statutory
  // inspection regime current" — even though they live in three tables.
  const windersInspectionDue = winders.filter((w) => {
    const next = w.inspections[0]?.nextInspectionDue;
    return !next || next <= dueSoonHorizon;
  });
  const ropesDue = ropes.filter((r) => (r.discardDate && r.discardDate <= dueSoonHorizon) || (r.nextTestDue && r.nextTestDue <= dueSoonHorizon));
  const ropesOverdue = ropes.filter((r) => (r.discardDate && r.discardDate < now) || (r.nextTestDue && r.nextTestDue < now));

  // One row per shaft — the newest inspection is the one that sets the next due date, so
  // older rows for the same shaft would otherwise each count as separately overdue.
  const latestByShaft = new Map<string, (typeof shaftInspections)[number]>();
  for (const s of shaftInspections) {
    if (!latestByShaft.has(s.shaftName)) latestByShaft.set(s.shaftName, s);
  }
  const shaftsDue = [...latestByShaft.values()].filter((s) => !s.nextInspectionDue || s.nextInspectionDue <= dueSoonHorizon);

  const statutoryInspectionsDue = windersInspectionDue.length + ropesDue.length + shaftsDue.length;

  // Wear is only meaningful where both an initial and current measurement exist; a part
  // with no readings isn't "0% worn", it's unmeasured, so it's excluded rather than
  // counted as healthy.
  const measuredParts = consumableParts.filter((p) => p.initialMeasurement != null && p.currentMeasurement != null && p.initialMeasurement > 0);
  const partsPastWearLimit = measuredParts.filter((p) => p.currentMeasurement! / p.initialMeasurement! <= 0.2);

  const equipmentDown = equipment.filter((e) => e.status === "DOWN");

  // --- Plant integrity registers -------------------------------------------
  // A missing due date counts as lapsed, not as compliant: on a register the mine
  // must produce on demand, "we never set a date" is the same finding as "the date
  // passed". The one exception is the load test, which not all tackle carries.
  const lapsed = (date: Date | null) => !date || date < now;

  const liftingOverdue = liftingEquipment.filter((i) => lapsed(i.nextInspectionDue));
  const liftingLoadTestOverdue = liftingEquipment.filter((i) => i.nextLoadTestDue != null && i.nextLoadTestDue < now);
  const liftingNoSwl = liftingEquipment.filter((i) => i.safeWorkingLoadKg == null).length;

  const pressureCertLapsed = pressureEquipment.filter((i) => lapsed(i.certificateExpiry));
  const pressureInspectionOverdue = pressureEquipment.filter((i) => lapsed(i.nextInspectionDue));
  const pressureValveOverdue = pressureEquipment.filter((i) => i.safetyValveNextDue != null && i.safetyValveNextDue < now).length;

  const hazardousInstallations = electricalInstallations.filter((i) => i.hazardousArea);
  const electricalUnprotected = hazardousInstallations.filter((i) => i.exProtection === "NONE");
  const electricalExLapsed = hazardousInstallations.filter((i) => i.exProtection !== "NONE" && lapsed(i.exCertificateExpiry)).length;
  const electricalTestOverdue = electricalInstallations.filter((i) => lapsed(i.nextTestDue)).length;
  const electricalNoElp = electricalInstallations.filter((i) => !i.earthLeakageProtected).length;

  // One number the appointee is judged on: everything in the three statutory plant
  // registers that is out of date right now.
  const plantRegisterLapsed =
    liftingOverdue.length +
    liftingLoadTestOverdue.length +
    pressureCertLapsed.length +
    pressureInspectionOverdue.length +
    pressureValveOverdue +
    electricalUnprotected.length +
    electricalExLapsed +
    electricalTestOverdue;

  // --- Reliability ---------------------------------------------------------
  const failureDowntimeByEquipment = new Map<string, number>();
  const failureCountByEquipment = new Map<string, number>();
  const downtimeByFailureMode: Record<string, number> = {};
  for (const f of recentFailures) {
    const hours = f.downtimeHours ?? 0;
    failureDowntimeByEquipment.set(f.equipmentId, (failureDowntimeByEquipment.get(f.equipmentId) ?? 0) + hours);
    failureCountByEquipment.set(f.equipmentId, (failureCountByEquipment.get(f.equipmentId) ?? 0) + 1);
    downtimeByFailureMode[f.failureMode] = (downtimeByFailureMode[f.failureMode] ?? 0) + hours;
  }
  const failureDowntimeHoursLast30 = recentFailures.reduce((sum, f) => sum + (f.downtimeHours ?? 0), 0);
  const rcaAddressed = recentFailures.filter((f) => f.recurrencePrevented).length;

  const windowHours = TREND_DAYS * 24;
  const criticalAssets = reliabilityProfiles.filter((p) => p.criticality === "CRITICAL");
  const assetsBelowTarget = reliabilityProfiles.filter((p) => {
    if (p.targetAvailabilityPct == null) return false;
    const downtime = failureDowntimeByEquipment.get(p.equipmentId) ?? 0;
    return ((windowHours - downtime) / windowHours) * 100 < p.targetAvailabilityPct;
  });

  res.json({
    headline: {
      overdueMaintenance: overdueMaintenance.length,
      openMaintenance: openMaintenance.length,
      plannedSharePct,
      completedLast30: completedLast30.length,
      statutoryInspectionsDue,
      ropesOverdue: ropesOverdue.length,
      maintenanceCostLast30: Math.round(maintenanceCostLast30 * 100) / 100,
      plantRegisterLapsed,
    },
    trends: { maintenance: maintenanceSeries },
    breakdowns: {
      maintenanceByType: countBy(completedLast30, (m) => m.maintenanceType as string),
      equipmentByStatus: countBy(equipment, (e) => e.status as string),
    },
    assetIntegrity: {
      winders: winders.length,
      windersInspectionDue: windersInspectionDue.length,
      ropesInService: ropes.length,
      ropesDue: ropesDue.length,
      shaftsTracked: latestByShaft.size,
      shaftsDue: shaftsDue.length,
    },
    consumables: {
      partsInService: consumableParts.length,
      partsMeasured: measuredParts.length,
      partsPastWearLimit: partsPastWearLimit.length,
    },
    maintenanceStats: {
      downtimeHoursLast30: Math.round(maintenanceDowntimeHoursLast30 * 10) / 10,
      equipmentDownNow: equipmentDown.length,
    },
    plantIntegrity: {
      lifting: {
        inService: liftingEquipment.length,
        overdue: liftingOverdue.length,
        loadTestOverdue: liftingLoadTestOverdue.length,
        noSwl: liftingNoSwl,
      },
      pressure: {
        inService: pressureEquipment.length,
        certLapsed: pressureCertLapsed.length,
        inspectionOverdue: pressureInspectionOverdue.length,
        valveOverdue: pressureValveOverdue,
      },
      electrical: {
        inService: electricalInstallations.length,
        hazardousArea: hazardousInstallations.length,
        unprotected: electricalUnprotected.length,
        exLapsed: electricalExLapsed,
        testOverdue: electricalTestOverdue,
        noEarthLeakageProtection: electricalNoElp,
      },
    },
    reliability: {
      profiledAssets: reliabilityProfiles.length,
      criticalAssets: criticalAssets.length,
      assetsBelowTarget: assetsBelowTarget.length,
      failuresLast30: recentFailures.length,
      failureDowntimeHoursLast30: Math.round(failureDowntimeHoursLast30 * 10) / 10,
      // Null when nothing failed — 0% would read as a broken RCA process rather
      // than an uneventful month.
      rcaCompletionPct: recentFailures.length > 0 ? Math.round((rcaAddressed / recentFailures.length) * 100) : null,
      downtimeByFailureMode,
    },
    actionQueue: {
      overdueMaintenance: overdueMaintenance.slice(0, 8).map((m) => ({
        id: m.id,
        equipmentName: m.equipment.name,
        maintenanceType: m.maintenanceType,
        scheduledDate: m.scheduledDate,
      })),
      ropesDue: ropesDue.slice(0, 8).map((r) => ({
        id: r.id,
        ropeIdentifier: r.ropeIdentifier,
        winderName: r.winder.name,
        discardDate: r.discardDate,
        nextTestDue: r.nextTestDue,
      })),
      windersDue: windersInspectionDue.slice(0, 8).map((w) => ({
        id: w.id,
        name: w.name,
        shaftName: w.shaftName,
        nextInspectionDue: w.inspections[0]?.nextInspectionDue ?? null,
      })),
      shaftsDue: shaftsDue.slice(0, 8).map((s) => ({ id: s.id, shaftName: s.shaftName, nextInspectionDue: s.nextInspectionDue })),
      partsPastWearLimit: partsPastWearLimit.slice(0, 8).map((p) => ({
        id: p.id,
        equipmentName: p.equipment.name,
        partType: p.partType,
        position: p.position,
        remainingPct: Math.round((p.currentMeasurement! / p.initialMeasurement!) * 100),
      })),
      // The three registers merged into one queue, because to the appointee they are
      // one obligation: what in my plant registers is out of date today.
      plantRegisterLapsed: [
        ...liftingOverdue.map((i) => ({ id: i.id, register: "LIFTING" as const, identifier: i.identifier, issue: "INSPECTION" as const, dueDate: i.nextInspectionDue })),
        ...liftingLoadTestOverdue.map((i) => ({ id: `${i.id}-lt`, register: "LIFTING" as const, identifier: i.identifier, issue: "LOAD_TEST" as const, dueDate: i.nextLoadTestDue })),
        ...pressureCertLapsed.map((i) => ({ id: `${i.id}-cert`, register: "PRESSURE" as const, identifier: i.identifier, issue: "CERTIFICATE" as const, dueDate: i.certificateExpiry })),
        ...pressureInspectionOverdue.map((i) => ({ id: i.id, register: "PRESSURE" as const, identifier: i.identifier, issue: "INSPECTION" as const, dueDate: i.nextInspectionDue })),
        ...electricalUnprotected.map((i) => ({ id: `${i.id}-ex`, register: "ELECTRICAL" as const, identifier: i.identifier, issue: "UNPROTECTED" as const, dueDate: null })),
      ]
        // Undated entries first: an item with no due date is the least visible and
        // the longest neglected, not the least urgent.
        .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
        .slice(0, 8),
      assetsBelowTarget: assetsBelowTarget.slice(0, 8).map((p) => ({
        equipmentId: p.equipmentId,
        equipmentName: p.equipment.name,
        criticality: p.criticality,
        targetAvailabilityPct: p.targetAvailabilityPct,
        downtimeHours: Math.round((failureDowntimeByEquipment.get(p.equipmentId) ?? 0) * 10) / 10,
        failureCount: failureCountByEquipment.get(p.equipmentId) ?? 0,
      })),
    },
  });
});

export default router;
