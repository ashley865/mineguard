import { Router } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

const EXPIRY_WARNING_DAYS = 30;

// Executive titles whose department owns worker certification/training compliance.
const CERTIFICATION_AUDIENCE: ExecutiveTitle[] = ["HR_MANAGER"];
// Executive titles whose department owns contractor/vendor contract terms.
const CONTRACT_AUDIENCE: ExecutiveTitle[] = ["GENERAL_MANAGER", "COO", "OPERATIONS_MANAGER", "COMPLIANCE_OFFICER"];

function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const role = req.auth!.role;
  let title: ExecutiveTitle | null = null;
  if (role === "EXECUTIVE") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    title = me?.title ?? null;
  }

  const seesCertifications = role === "ADMIN" || (role === "EXECUTIVE" && !!title && CERTIFICATION_AUDIENCE.includes(title));
  const seesContracts = role === "ADMIN" || (role === "EXECUTIVE" && !!title && CONTRACT_AUDIENCE.includes(title));

  const [reviewedAlerts, reviewedIncidents, certificates, trainingRecords, contractors] = await Promise.all([
    prisma.alert.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] }, site: { mineId } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    prisma.incident.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] }, site: { mineId } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    seesCertifications
      ? prisma.certificate.findMany({
          where: { status: "ACTIVE", expiryDate: { not: null }, worker: { site: { mineId } } },
          include: { worker: { select: { name: true, site: { select: { id: true, name: true } } } } },
        })
      : Promise.resolve([]),
    seesCertifications
      ? prisma.trainingRecord.findMany({
          where: { expiryDate: { not: null }, worker: { site: { mineId } } },
          include: { worker: { select: { name: true, site: { select: { id: true, name: true } } } } },
        })
      : Promise.resolve([]),
    seesContracts
      ? prisma.contractor.findMany({
          where: { status: "ACTIVE", site: { mineId } },
          include: { site: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const certificationItems = [
    ...certificates
      .filter((c) => c.expiryDate && daysFromNow(c.expiryDate) <= EXPIRY_WARNING_DAYS)
      .map((c) => {
        const days = daysFromNow(c.expiryDate!);
        return {
          id: `certificate-${c.id}`,
          kind: "certification" as const,
          title: `${c.type.replace(/_/g, " ")} Certificate of Competency — ${c.worker.name}`,
          severity: (days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: c.expiryDate!,
          site: c.worker.site,
        };
      }),
    ...trainingRecords
      .filter((tr) => tr.expiryDate && daysFromNow(tr.expiryDate) <= EXPIRY_WARNING_DAYS)
      .map((tr) => {
        const days = daysFromNow(tr.expiryDate!);
        return {
          id: `training-${tr.id}`,
          kind: "certification" as const,
          title: `${tr.courseName} training — ${tr.worker.name}`,
          severity: (days < 0 ? "MEDIUM" : "LOW") as "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: tr.expiryDate!,
          site: tr.worker.site,
        };
      }),
  ];

  const contractItems = contractors.flatMap((contractor) => {
    const checks: { date: Date; label: string }[] = [{ date: contractor.contractEndDate, label: "Contract" }];
    if (contractor.goodStandingExpiry) checks.push({ date: contractor.goodStandingExpiry, label: "Letter of Good Standing" });
    if (contractor.insuranceExpiry) checks.push({ date: contractor.insuranceExpiry, label: "Public liability insurance" });
    return checks
      .filter((check) => daysFromNow(check.date) <= EXPIRY_WARNING_DAYS)
      .map((check) => {
        const days = daysFromNow(check.date);
        return {
          id: `contract-${contractor.id}-${check.label}`,
          kind: "contract" as const,
          title: `${check.label} — ${contractor.companyName}`,
          severity: (days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
          reviewStatus: (days < 0 ? "OVERDUE" : "SCHEDULED") as "OVERDUE" | "SCHEDULED",
          reviewedAt: check.date,
          site: contractor.site,
        };
      });
  });

  const items = [
    ...reviewedAlerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: "alert" as const,
      title: a.message,
      severity: a.severity,
      reviewStatus: a.reviewStatus,
      reviewNote: a.reviewNote,
      reviewedAt: a.reviewedAt,
      reviewedBy: a.reviewedBy,
      site: a.site,
    })),
    ...reviewedIncidents.map((i) => ({
      id: `incident-${i.id}`,
      kind: "incident" as const,
      title: i.title,
      severity: i.severity,
      reviewStatus: i.reviewStatus,
      reviewNote: i.reviewNote,
      reviewedAt: i.reviewedAt,
      reviewedBy: i.reviewedBy,
      site: i.site,
    })),
    ...certificationItems,
    ...contractItems,
  ]
    .filter((item) => item.reviewedAt)
    .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
    .slice(0, 30);

  res.json(items);
});

export default router;
