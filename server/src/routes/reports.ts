import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeComplianceScore } from "../services/complianceScore";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const escape = (value: any) => {
    if (value === null || value === undefined) return "";
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

router.get("/trends", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const days = Math.min(Number(req.query.days) || 90, 365);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const siteFilter = siteId ? { siteId, site: { mineId } } : { site: { mineId } };
  const workerSiteFilter = siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } };

  const [incidents, alerts, alertsBySeverity, permits, certificates, cops, medicalRecords, { score: complianceScore, breakdown }] =
    await Promise.all([
      prisma.incident.findMany({ where: { ...siteFilter, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.alert.findMany({ where: { ...siteFilter, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.alert.groupBy({ by: ["severity"], where: { ...siteFilter, createdAt: { gte: since } }, _count: true }),
      prisma.permit.findMany({ where: siteFilter, select: { expiryDate: true, status: true } }),
      prisma.certificate.findMany({ where: workerSiteFilter, select: { expiryDate: true, status: true } }),
      prisma.codeOfPractice.findMany({ where: { ...siteFilter, status: "ACTIVE" }, select: { reviewDate: true } }),
      prisma.medicalSurveillance.findMany({ where: workerSiteFilter, select: { nextExamDue: true } }),
      computeComplianceScore(mineId, siteId),
    ]);

  const dayBuckets = new Map<string, { incidents: number; alerts: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dayBuckets.set(d.toISOString().slice(0, 10), { incidents: 0, alerts: 0 });
  }
  for (const i of incidents) {
    const key = i.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) bucket.incidents += 1;
  }
  for (const a of alerts) {
    const key = a.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) bucket.alerts += 1;
  }

  const severity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of alertsBySeverity) severity[row.severity] = row._count;

  const ninetyDaysFromNow = Date.now() + 90 * 86400000;
  const expiringSoon = (rows: { expiryDate?: Date | null; status?: string }[], activeStatus = "ACTIVE") =>
    rows.filter(
      (r) => r.expiryDate && r.expiryDate.getTime() <= ninetyDaysFromNow && (!r.status || r.status === activeStatus)
    ).length;

  res.json({
    days,
    trend: Array.from(dayBuckets.entries()).map(([date, v]) => ({ date, ...v })),
    alertsBySeverity: severity,
    complianceScore,
    compliance: breakdown,
    expiryForecast: [
      { category: "permits", count: expiringSoon(permits) },
      { category: "certificates", count: expiringSoon(certificates) },
      { category: "codesOfPractice", count: cops.filter((c) => c.reviewDate.getTime() <= ninetyDaysFromNow).length },
      { category: "medicalSurveillance", count: medicalRecords.filter((m) => m.nextExamDue.getTime() <= ninetyDaysFromNow).length },
    ],
  });
});

const exportConfigs: Record<
  string,
  { columns: { key: string; label: string }[]; query: (mineId: string, siteId?: string) => Promise<any[]> }
> = {
  incidents: {
    columns: [
      { key: "title", label: "Title" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "zone", label: "Zone" },
      { key: "createdAt", label: "Created At" },
      { key: "resolvedAt", label: "Resolved At" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.incident.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } }, zone: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name, zone: r.zone?.name }));
    },
  },
  alerts: {
    columns: [
      { key: "message", label: "Message" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "zone", label: "Zone" },
      { key: "createdAt", label: "Created At" },
      { key: "resolvedAt", label: "Resolved At" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.alert.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } }, zone: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name, zone: r.zone?.name }));
    },
  },
  permits: {
    columns: [
      { key: "permitNumber", label: "Permit Number" },
      { key: "type", label: "Type" },
      { key: "issuingAuthority", label: "Issuing Authority" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "issueDate", label: "Issue Date" },
      { key: "expiryDate", label: "Expiry Date" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.permit.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { expiryDate: "asc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  certificates: {
    columns: [
      { key: "worker", label: "Worker" },
      { key: "type", label: "Type" },
      { key: "certificateNumber", label: "Certificate Number" },
      { key: "issuingBody", label: "Issuing Body" },
      { key: "status", label: "Status" },
      { key: "issueDate", label: "Issue Date" },
      { key: "expiryDate", label: "Expiry Date" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.certificate.findMany({
        where: siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } },
        include: { worker: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
      });
      return rows.map((r) => ({ ...r, worker: r.worker?.name }));
    },
  },
  trainingRecords: {
    columns: [
      { key: "worker", label: "Worker" },
      { key: "courseName", label: "Course" },
      { key: "trainingType", label: "Type" },
      { key: "provider", label: "Provider" },
      { key: "completionDate", label: "Completion Date" },
      { key: "expiryDate", label: "Refresher Due" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.trainingRecord.findMany({
        where: siteId ? { worker: { siteId, site: { mineId } } } : { worker: { site: { mineId } } },
        include: { worker: { select: { name: true } } },
        orderBy: { completionDate: "desc" },
      });
      return rows.map((r) => ({ ...r, worker: r.worker?.name }));
    },
  },
  safetyInspections: {
    columns: [
      { key: "title", label: "Title" },
      { key: "inspectionType", label: "Type" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "scheduledDate", label: "Scheduled Date" },
      { key: "completedDate", label: "Completed Date" },
      { key: "inspector", label: "Inspector" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.safetyInspection.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { scheduledDate: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  regulatoryNotices: {
    columns: [
      { key: "noticeNumber", label: "Notice Number" },
      { key: "section", label: "Section" },
      { key: "issuedBy", label: "Issued By" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "issuedDate", label: "Issued Date" },
      { key: "complianceDeadline", label: "Compliance Deadline" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.regulatoryNotice.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { issuedDate: "desc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
  contractors: {
    columns: [
      { key: "companyName", label: "Company Name" },
      { key: "scopeOfWork", label: "Scope of Work" },
      { key: "status", label: "Status" },
      { key: "site", label: "Site" },
      { key: "contractStartDate", label: "Contract Start" },
      { key: "contractEndDate", label: "Contract End" },
      { key: "goodStandingExpiry", label: "Good Standing Expiry" },
      { key: "insuranceExpiry", label: "Insurance Expiry" },
    ],
    query: async (mineId, siteId) => {
      const rows = await prisma.contractor.findMany({
        where: siteId ? { siteId, site: { mineId } } : { site: { mineId } },
        include: { site: { select: { name: true } } },
        orderBy: { contractEndDate: "asc" },
      });
      return rows.map((r) => ({ ...r, site: r.site?.name }));
    },
  },
};

router.get("/export/:entity", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const config = exportConfigs[req.params.entity];
  if (!config) return res.status(404).json({ error: "Unknown export entity" });
  const siteId = req.query.siteId as string | undefined;
  const rows = await config.query(mineId, siteId);
  const csv = toCsv(rows, config.columns);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.entity}.csv"`);
  res.send(csv);
});

export default router;
