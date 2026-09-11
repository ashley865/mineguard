import { Router, Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// The environmental control officer owns this view; GM carries accountability for the
// mine's environmental authorisations. Compliance Officer is excluded — their dashboard
// already covers the regulatory-filing side, and this one is the operational environmental
// picture (monitoring, water balance, TSF integrity) rather than paperwork status.
const ENVIRONMENTAL_DASHBOARD_AUDIENCE: ExecutiveTitle[] = ["ENVIRONMENTAL_MANAGER", "GENERAL_MANAGER"];

async function requireEnvironmentalAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !ENVIRONMENTAL_DASHBOARD_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const DUE_SOON_DAYS = 30;
// A TSF inspection older than this counts as due. Regulators and the GISTM expect a
// routine cadence well inside a quarter; without a nextInspectionDue field on the model,
// the interval has to be assumed, and a conservative one is the safe direction to err.
const TSF_INSPECTION_INTERVAL_DAYS = 90;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.use(requireAuth);

/**
 * The operational environmental picture in one round trip: monitoring exceedances, tailings
 * integrity, water licence position, and the closure provision.
 *
 * Tailings leads the headline deliberately. A TSF is the highest-consequence structure on
 * most mines (see the TailingsFacility model's own note) — an exceedance is a compliance
 * problem, a dam wall is a catastrophe — so it outranks the metric with the bigger number.
 */
router.get("/summary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireEnvironmentalAccess(req, res))) return;

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const dueSoonHorizon = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS);
  const tsfStaleBefore = new Date(now.getTime() - TSF_INSPECTION_INTERVAL_DAYS * DAY_MS);
  const bySite = { site: { mineId } };

  const [
    readings,
    tailingsFacilities,
    waterRecords,
    energyRecords,
    ghgRecords,
    closurePlans,
    pollutionDams,
    wasteStreams,
    emissionLicences,
    dustExceedancesLast30,
    boreholes,
    environmentalIncidents,
  ] = await Promise.all([
    prisma.environmentalReading.findMany({
      where: { ...bySite, recordedAt: { gte: trendStart } },
      select: {
        id: true,
        monitoringPoint: true,
        parameterType: true,
        value: true,
        unit: true,
        thresholdMin: true,
        thresholdMax: true,
        withinLimits: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.tailingsFacility.findMany({
      where: bySite,
      select: {
        id: true,
        name: true,
        gistmClassification: true,
        status: true,
        engineerOfRecord: true,
        inspections: {
          orderBy: { inspectionDate: "desc" },
          take: 1,
          select: { inspectionDate: true, structuralRating: true, seepageObserved: true, freeboardMeters: true, engineerSignOff: true },
        },
      },
    }),
    prisma.waterBalanceRecord.findMany({
      where: { ...bySite, recordDate: { gte: trendStart } },
      select: { id: true, recordDate: true, abstractedVolume: true, dischargedVolume: true, recycledVolume: true, unit: true, licenseLimit: true, withinLimit: true },
    }),
    prisma.energyConsumptionRecord.findMany({
      where: { ...bySite, recordMonth: { gte: new Date(now.getTime() - 365 * DAY_MS) } },
      select: { recordMonth: true, gridConsumptionKwh: true, renewableConsumptionKwh: true, dieselConsumptionLiters: true },
      orderBy: { recordMonth: "desc" },
    }),
    // Mine-scoped rather than site-scoped: GHG is reported for the operation as a whole.
    prisma.ghgEmissionsRecord.findMany({
      where: { mineId },
      select: { reportingYear: true, scope1TonnesCO2e: true, scope2TonnesCO2e: true, carbonTaxLiability: true },
      orderBy: { reportingYear: "desc" },
      take: 1,
    }),
    prisma.closureRehabilitationPlan.findMany({
      where: bySite,
      select: { id: true, planReferenceNumber: true, financialProvisionAmount: true, nextAssessmentDue: true, status: true, site: { select: { name: true } } },
    }),
    prisma.pollutionControlDam.findMany({
      where: bySite,
      select: { id: true, name: true, capacity: true, currentLevel: true, status: true, lastInspectionDate: true },
    }),
    // Statutory environmental registers. Scoped to items actually active — a
    // decommissioned waste stream or borehole is already off the mine's obligations.
    prisma.wasteStream.findMany({
      where: { ...bySite, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        wasteType: true,
        storageStartDate: true,
        storageLimitMonths: true,
        manifests: { select: { id: true }, take: 1, orderBy: { dispatchDate: "desc" } },
      },
    }),
    prisma.emissionLicence.findMany({
      where: bySite,
      select: {
        id: true,
        licenceNumber: true,
        status: true,
        expiryDate: true,
        stackTests: { orderBy: { testDate: "desc" }, take: 1, select: { compliant: true, testDate: true } },
      },
    }),
    prisma.dustFalloutReading.count({ where: { ...bySite, readingMonth: { gte: trendStart }, withinLimit: false } }),
    prisma.monitoringBorehole.findMany({
      where: { ...bySite, status: "ACTIVE" },
      select: {
        id: true,
        identifier: true,
        staticWaterLevelBaselineM: true,
        readings: { orderBy: { readingDate: "desc" }, take: 1, select: { waterLevelMbgl: true, withinLimits: true, readingDate: true } },
      },
    }),
    prisma.environmentalIncident.findMany({
      where: { ...bySite, incidentDate: { gte: new Date(now.getTime() - 365 * DAY_MS) } },
      select: {
        id: true,
        category: true,
        severity: true,
        incidentDate: true,
        regulatorNotificationRequired: true,
        regulatorNotifiedAt: true,
        remediationStatus: true,
      },
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

  const exceedances = readings.filter((r) => !r.withinLimits);

  const readingsByDay = countBy(readings, (r) => dayKey(r.recordedAt) as string);
  const exceedancesByDay = countBy(exceedances, (r) => dayKey(r.recordedAt) as string);
  const monitoringSeries: { date: string; readings: number; exceedances: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    monitoringSeries.push({ date: key, readings: readingsByDay[key] ?? 0, exceedances: exceedancesByDay[key] ?? 0 });
  }

  // A facility is "at risk" if its structure was rated poorly, seepage was seen, or nobody
  // has inspected it inside the assumed interval. Never inspected counts as at risk rather
  // than unknown — an uninspected dam is precisely the case worth surfacing.
  const tailingsAtRisk = tailingsFacilities.filter((f) => {
    const latest = f.inspections[0];
    if (!latest) return true;
    if (["POOR", "UNSATISFACTORY"].includes(latest.structuralRating)) return true;
    if (latest.seepageObserved) return true;
    return latest.inspectionDate < tsfStaleBefore;
  });

  const waterAbstracted = waterRecords.reduce((sum, w) => sum + w.abstractedVolume, 0);
  const waterDischarged = waterRecords.reduce((sum, w) => sum + w.dischargedVolume, 0);
  const waterRecycled = waterRecords.reduce((sum, w) => sum + w.recycledVolume, 0);
  const waterBreaches = waterRecords.filter((w) => !w.withinLimit);
  // Licence limits are per-record, so the meaningful comparison is abstraction against the
  // sum of the limits that actually applied over the window rather than a single figure.
  const waterLimitTotal = waterRecords.reduce((sum, w) => sum + (w.licenseLimit ?? 0), 0);
  const waterLicenceUsedPct = waterLimitTotal > 0 ? Math.round((waterAbstracted / waterLimitTotal) * 100) : null;

  const latestEnergy = energyRecords[0] ?? null;
  const energyRenewablePct =
    latestEnergy && latestEnergy.gridConsumptionKwh + latestEnergy.renewableConsumptionKwh > 0
      ? Math.round((latestEnergy.renewableConsumptionKwh / (latestEnergy.gridConsumptionKwh + latestEnergy.renewableConsumptionKwh)) * 100)
      : null;

  const latestGhg = ghgRecords[0] ?? null;

  const closureDue = closurePlans.filter((p) => p.nextAssessmentDue && p.nextAssessmentDue <= dueSoonHorizon);
  const closureProvisionTotal = closurePlans.reduce((sum, p) => sum + (p.financialProvisionAmount ?? 0), 0);

  const damsNeedingInspection = pollutionDams.filter((d) => !d.lastInspectionDate || d.lastInspectionDate < tsfStaleBefore);

  // --- Statutory registers: waste, emissions, groundwater --------------------
  // A missing date counts as lapsed, not compliant — the same reasoning as the
  // engineering plant registers: an unset date is the least visible, longest
  // neglected case, and reporting it as clean would hide exactly that.
  const hazardousStreams = wasteStreams.filter((s) => s.wasteType === "HAZARDOUS");
  const hazardousOverStorageLimit = hazardousStreams.filter((s) => {
    if (s.storageLimitMonths == null) return false;
    if (!s.storageStartDate) return true;
    const monthsInStorage = (now.getTime() - s.storageStartDate.getTime()) / (30.44 * DAY_MS);
    return monthsInStorage > s.storageLimitMonths;
  });
  const wasteNeverManifested = wasteStreams.filter((s) => s.manifests.length === 0).length;

  const activeLicences = emissionLicences.filter((l) => l.status === "ACTIVE");
  const licencesLapsedOrUndated = activeLicences.filter((l) => !l.expiryDate || l.expiryDate < now);
  const nonCompliantStackTests = emissionLicences.filter((l) => l.stackTests[0] && !l.stackTests[0].compliant);

  const boreholesOutOfLimits = boreholes.filter((b) => b.readings[0] && !b.readings[0].withinLimits);
  const boreholesDrawingDown = boreholes.filter((b) => {
    const latest = b.readings[0]?.waterLevelMbgl;
    if (latest == null || b.staticWaterLevelBaselineM == null || b.staticWaterLevelBaselineM <= 0) return false;
    return latest > b.staticWaterLevelBaselineM * 1.1;
  });

  const registerLapsedCount =
    hazardousOverStorageLimit.length + licencesLapsedOrUndated.length + nonCompliantStackTests.length + boreholesOutOfLimits.length;

  // --- Incident notification & remediation -----------------------------------
  const notificationsRequired = environmentalIncidents.filter((i) => i.regulatorNotificationRequired);
  const notificationsOutstanding = notificationsRequired.filter((i) => !i.regulatorNotifiedAt);
  const notifiedHours = notificationsRequired
    .filter((i) => i.regulatorNotifiedAt)
    .map((i) => (i.regulatorNotifiedAt!.getTime() - i.incidentDate.getTime()) / 3_600_000);
  const avgNotificationHours = notifiedHours.length > 0 ? Math.round((notifiedHours.reduce((a, b) => a + b, 0) / notifiedHours.length) * 10) / 10 : null;
  const incidentsUnremediated = environmentalIncidents.filter(
    (i) => i.remediationStatus === "NOT_STARTED" || i.remediationStatus === "IN_PROGRESS"
  );

  res.json({
    headline: {
      tailingsFacilities: tailingsFacilities.length,
      tailingsAtRisk: tailingsAtRisk.length,
      exceedances: exceedances.length,
      readingsLast30: readings.length,
      waterLicenceUsedPct,
      waterBreaches: waterBreaches.length,
      closureDue: closureDue.length,
      closureProvisionTotal: Math.round(closureProvisionTotal * 100) / 100,
      // Everything in the waste, air quality and groundwater registers that is
      // out of date right now — what an inspector would find today.
      registerLapsed: registerLapsedCount,
    },
    trends: { monitoring: monitoringSeries },
    breakdowns: {
      exceedancesByParameter: countBy(exceedances, (r) => r.parameterType as string),
      tailingsByRating: countBy(
        tailingsFacilities.filter((f) => f.inspections[0]),
        (f) => f.inspections[0].structuralRating as string
      ),
    },
    waterEnergy: {
      abstracted: Math.round(waterAbstracted * 10) / 10,
      discharged: Math.round(waterDischarged * 10) / 10,
      recycled: Math.round(waterRecycled * 10) / 10,
      unit: waterRecords[0]?.unit ?? "kL",
      energyRenewablePct,
      gridKwh: latestEnergy?.gridConsumptionKwh ?? null,
      dieselLiters: latestEnergy?.dieselConsumptionLiters ?? null,
      ghgYear: latestGhg?.reportingYear ?? null,
      ghgScope1: latestGhg?.scope1TonnesCO2e ?? null,
      ghgScope2: latestGhg?.scope2TonnesCO2e ?? null,
      carbonTaxLiability: latestGhg?.carbonTaxLiability ?? null,
    },
    registers: {
      waste: {
        activeStreams: wasteStreams.length,
        hazardousStreams: hazardousStreams.length,
        hazardousOverStorageLimit: hazardousOverStorageLimit.length,
        neverManifested: wasteNeverManifested,
      },
      emissions: {
        activeLicences: activeLicences.length,
        licencesLapsedOrUndated: licencesLapsedOrUndated.length,
        nonCompliantStackTests: nonCompliantStackTests.length,
        dustExceedancesLast30: dustExceedancesLast30,
      },
      groundwater: {
        activeBoreholes: boreholes.length,
        outOfLimits: boreholesOutOfLimits.length,
        drawingDown: boreholesDrawingDown.length,
      },
    },
    incidentNotification: {
      totalLast365Days: environmentalIncidents.length,
      notificationsRequired: notificationsRequired.length,
      notificationsOutstanding: notificationsOutstanding.length,
      avgNotificationHours,
      unremediated: incidentsUnremediated.length,
    },
    actionQueue: {
      exceedances: exceedances.slice(0, 8).map((r) => ({
        id: r.id,
        monitoringPoint: r.monitoringPoint,
        parameterType: r.parameterType,
        value: r.value,
        unit: r.unit,
        thresholdMax: r.thresholdMax,
        recordedAt: r.recordedAt,
      })),
      tailingsAtRisk: tailingsAtRisk.slice(0, 8).map((f) => ({
        id: f.id,
        name: f.name,
        gistmClassification: f.gistmClassification,
        structuralRating: f.inspections[0]?.structuralRating ?? null,
        seepageObserved: f.inspections[0]?.seepageObserved ?? false,
        lastInspectionDate: f.inspections[0]?.inspectionDate ?? null,
      })),
      closureDue: closureDue.slice(0, 8).map((p) => ({
        id: p.id,
        planReferenceNumber: p.planReferenceNumber,
        siteName: p.site.name,
        nextAssessmentDue: p.nextAssessmentDue,
        status: p.status,
      })),
      damsNeedingInspection: damsNeedingInspection.slice(0, 8).map((d) => ({
        id: d.id,
        name: d.name,
        currentLevel: d.currentLevel,
        capacity: d.capacity,
        lastInspectionDate: d.lastInspectionDate,
      })),
      // The three statutory registers merged into one queue — to the officer they are
      // one obligation: what in my environmental registers is out of date today.
      registerLapsed: [
        ...hazardousOverStorageLimit.map((s) => ({ id: s.id, register: "WASTE" as const, identifier: s.name, issue: "STORAGE_LIMIT" as const, dueDate: null })),
        ...licencesLapsedOrUndated.map((l) => ({ id: l.id, register: "EMISSIONS" as const, identifier: l.licenceNumber, issue: "LICENCE_EXPIRY" as const, dueDate: l.expiryDate })),
        ...nonCompliantStackTests.map((l) => ({ id: `${l.id}-test`, register: "EMISSIONS" as const, identifier: l.licenceNumber, issue: "STACK_TEST" as const, dueDate: l.stackTests[0]?.testDate ?? null })),
        ...boreholesOutOfLimits.map((b) => ({ id: b.id, register: "GROUNDWATER" as const, identifier: b.identifier, issue: "QUALITY_EXCEEDANCE" as const, dueDate: b.readings[0]?.readingDate ?? null })),
      ]
        // Undated entries first — an item with no date is the least visible and the
        // longest neglected, not the least urgent.
        .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
        .slice(0, 8),
      incidentNotifications: [...notificationsOutstanding, ...incidentsUnremediated.filter((i) => !notificationsOutstanding.includes(i))]
        .slice(0, 8)
        .map((i) => ({
          id: i.id,
          category: i.category,
          severity: i.severity,
          incidentDate: i.incidentDate,
          notificationOutstanding: i.regulatorNotificationRequired && !i.regulatorNotifiedAt,
          remediationStatus: i.remediationStatus,
        })),
    },
  });
});

export default router;
