import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

const OPEN_ALERT_STATUSES = ["NEW", "INVESTIGATING", "CONTAINED"] as const;
const OPEN_INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED"] as const;
const OPEN_VULN_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

// A transparent, explainable point-deduction score rather than an opaque number —
// every deduction below is returned in the breakdown too, so both the UI and the AI
// Security Analyst can say exactly *why* the score is what it is, per the "clear
// severity levels, explain threats" requirement this module is built around.
function scoreDeductions(input: {
  openAlertsBySeverity: Record<string, number>;
  openIncidentsBySeverity: Record<string, number>;
  compromisedEndpoints: number;
  unprotectedEndpoints: number;
  overduePatchEndpoints: number;
  overdueCriticalVulns: number;
  overdueHighVulns: number;
  nonCompliantPolicies: number;
}) {
  const items = [
    { label: "Open critical alerts/incidents", count: input.openAlertsBySeverity.CRITICAL + input.openIncidentsBySeverity.CRITICAL, weight: 15 },
    { label: "Open high-severity alerts/incidents", count: input.openAlertsBySeverity.HIGH + input.openIncidentsBySeverity.HIGH, weight: 8 },
    { label: "Open medium-severity alerts/incidents", count: input.openAlertsBySeverity.MEDIUM + input.openIncidentsBySeverity.MEDIUM, weight: 3 },
    { label: "Compromised endpoints", count: input.compromisedEndpoints, weight: 10 },
    { label: "Endpoints without active AV/EDR", count: input.unprotectedEndpoints, weight: 5 },
    { label: "Endpoints with overdue patches", count: input.overduePatchEndpoints, weight: 4 },
    { label: "Overdue critical vulnerabilities", count: input.overdueCriticalVulns, weight: 10 },
    { label: "Overdue high vulnerabilities", count: input.overdueHighVulns, weight: 6 },
    { label: "Non-compliant security policies", count: input.nonCompliantPolicies, weight: 5 },
  ];
  const breakdown = items.filter((i) => i.count > 0).map((i) => ({ label: i.label, count: i.count, pointsDeducted: i.count * i.weight }));
  const totalDeducted = breakdown.reduce((sum, i) => sum + i.pointsDeducted, 0);
  return { score: Math.max(0, Math.min(100, 100 - totalDeducted)), breakdown };
}

function todayUtcDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const now = new Date();

  const [
    alertsBySeverity,
    incidentsBySeverity,
    compromisedEndpoints,
    unprotectedEndpoints,
    overduePatchEndpoints,
    totalEndpoints,
    overdueCriticalVulns,
    overdueHighVulns,
    openVulnsBySeverity,
    totalVulnerabilities,
    nonCompliantPolicies,
    totalPolicies,
    openFindings,
    recentAlerts,
    recentIncidents,
    snapshots,
  ] = await Promise.all([
    prisma.cyberAlert.groupBy({ by: ["severity"], where: { mineId, status: { in: [...OPEN_ALERT_STATUSES] } }, _count: true }),
    prisma.cyberIncident.groupBy({ by: ["severity"], where: { mineId, status: { in: [...OPEN_INCIDENT_STATUSES] } }, _count: true }),
    prisma.cyberEndpoint.count({ where: { mineId, isCompromised: true } }),
    prisma.cyberEndpoint.count({ where: { mineId, avEdrStatus: { in: ["MISSING", "DISABLED"] } } }),
    prisma.cyberEndpoint.count({ where: { mineId, patchStatus: "OVERDUE" } }),
    prisma.cyberEndpoint.count({ where: { mineId } }),
    prisma.cyberVulnerability.count({
      where: { mineId, severity: "CRITICAL", status: { in: [...OPEN_VULN_STATUSES] }, remediationDeadline: { lt: now } },
    }),
    prisma.cyberVulnerability.count({
      where: { mineId, severity: "HIGH", status: { in: [...OPEN_VULN_STATUSES] }, remediationDeadline: { lt: now } },
    }),
    prisma.cyberVulnerability.groupBy({ by: ["severity"], where: { mineId, status: { in: [...OPEN_VULN_STATUSES] } }, _count: true }),
    prisma.cyberVulnerability.count({ where: { mineId } }),
    prisma.cyberCompliancePolicy.count({ where: { mineId, status: "NON_COMPLIANT" } }),
    prisma.cyberCompliancePolicy.count({ where: { mineId } }),
    prisma.cyberAuditFinding.count({ where: { mineId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.cyberAlert.findMany({
      where: { mineId, status: { in: [...OPEN_ALERT_STATUSES] } },
      select: { id: true, title: true, severity: true, domain: true, detectedAt: true },
      orderBy: { detectedAt: "desc" },
      take: 8,
    }),
    prisma.cyberIncident.findMany({
      where: { mineId, status: { in: [...OPEN_INCIDENT_STATUSES] } },
      select: { id: true, title: true, severity: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.cyberScoreSnapshot.findMany({
      where: { mineId },
      select: { score: true, capturedDate: true },
      orderBy: { capturedDate: "asc" },
      take: 90,
    }),
  ]);

  const severityCounts = (rows: { severity: string; _count: number }[]) => {
    const base: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 };
    for (const row of rows) base[row.severity] = row._count;
    return base;
  };

  const openAlertsBySeverity = severityCounts(alertsBySeverity as any);
  const openIncidentsBySeverity = severityCounts(incidentsBySeverity as any);

  const { score, breakdown } = scoreDeductions({
    openAlertsBySeverity,
    openIncidentsBySeverity,
    compromisedEndpoints,
    unprotectedEndpoints,
    overduePatchEndpoints,
    overdueCriticalVulns,
    overdueHighVulns,
    nonCompliantPolicies,
  });

  // Write-on-read snapshot: one upsert per mine per calendar day. No cron/scheduler
  // exists in this app, so the trend line builds itself organically from real usage
  // instead of needing scheduled infrastructure.
  const capturedDate = todayUtcDate();
  await prisma.cyberScoreSnapshot
    .upsert({
      where: { mineId_capturedDate: { mineId, capturedDate } },
      update: { score },
      create: { mineId, capturedDate, score },
    })
    .catch(() => {});

  const trend = [...snapshots.filter((s) => s.capturedDate.getTime() !== capturedDate.getTime()), { score, capturedDate }];
  const previousScore = snapshots.length > 0 ? snapshots[snapshots.length - 1].score : null;

  res.json({
    score,
    scoreBreakdown: breakdown,
    trend: trend.map((t) => ({ date: t.capturedDate.toISOString().slice(0, 10), score: t.score })),
    trendDirection: previousScore == null ? null : score > previousScore ? "up" : score < previousScore ? "down" : "flat",
    activeThreats: {
      openAlerts: Object.values(openAlertsBySeverity).reduce((a, b) => a + b, 0),
      openIncidents: Object.values(openIncidentsBySeverity).reduce((a, b) => a + b, 0),
      criticalCount: openAlertsBySeverity.CRITICAL + openIncidentsBySeverity.CRITICAL,
      byAlertSeverity: openAlertsBySeverity,
      byIncidentSeverity: openIncidentsBySeverity,
    },
    endpoints: {
      total: totalEndpoints,
      compromised: compromisedEndpoints,
      unprotected: unprotectedEndpoints,
      overduePatch: overduePatchEndpoints,
    },
    vulnerabilities: {
      total: totalVulnerabilities,
      openBySeverity: severityCounts(openVulnsBySeverity as any),
      overdueCritical: overdueCriticalVulns,
      overdueHigh: overdueHighVulns,
    },
    compliance: {
      totalPolicies,
      nonCompliantPolicies,
      openFindings,
    },
    recentAlerts,
    recentIncidents,
  });
});

export default router;
