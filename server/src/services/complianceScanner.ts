import { Server } from "socket.io";
import { AlertSeverity } from "@prisma/client";
import { prisma } from "../prisma";

const REVIEW_WARNING_DAYS = 30;
const NOTICE_WARNING_DAYS = 7;
const PERMIT_WARNING_DAYS = 90;

function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

async function raiseAlertIfMissing(params: {
  siteId: string;
  zoneId?: string | null;
  severity: AlertSeverity;
  message: string;
}) {
  const existing = await prisma.alert.findFirst({
    where: { siteId: params.siteId, status: "OPEN", message: params.message },
  });
  if (existing) return null;
  return prisma.alert.create({
    data: {
      siteId: params.siteId,
      zoneId: params.zoneId ?? null,
      severity: params.severity,
      message: params.message,
    },
  });
}

export async function scanCompliance(io?: Server) {
  const newAlerts = [];

  const cops = await prisma.codeOfPractice.findMany({ where: { status: "ACTIVE" } });
  for (const cop of cops) {
    const days = daysFromNow(cop.reviewDate);
    if (days > REVIEW_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW";
    const message =
      days < 0
        ? `Code of Practice "${cop.title}" review is overdue by ${Math.abs(days)} day(s)`
        : `Code of Practice "${cop.title}" review due in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({ siteId: cop.siteId, zoneId: cop.zoneId, severity, message });
    if (alert) newAlerts.push(alert);
  }

  const riskAssessments = await prisma.riskAssessment.findMany({ where: { status: "APPROVED" } });
  for (const ra of riskAssessments) {
    const days = daysFromNow(ra.reviewDate);
    if (days > REVIEW_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW";
    const message =
      days < 0
        ? `Risk assessment "${ra.title}" review is overdue by ${Math.abs(days)} day(s)`
        : `Risk assessment "${ra.title}" review due in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({ siteId: ra.siteId, zoneId: ra.zoneId, severity, message });
    if (alert) newAlerts.push(alert);
  }

  const notices = await prisma.regulatoryNotice.findMany({ where: { status: "OPEN" } });
  for (const notice of notices) {
    if (!notice.complianceDeadline) continue;
    const days = daysFromNow(notice.complianceDeadline);
    if (days > NOTICE_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "CRITICAL" : days <= 2 ? "HIGH" : "MEDIUM";
    const sectionLabel = notice.section.replace("_", " ");
    const message =
      days < 0
        ? `${sectionLabel} notice ${notice.noticeNumber} compliance deadline overdue by ${Math.abs(days)} day(s)`
        : `${sectionLabel} notice ${notice.noticeNumber} compliance deadline in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({ siteId: notice.siteId, zoneId: notice.zoneId, severity, message });
    if (alert) newAlerts.push(alert);
  }

  const medicalRecords = await prisma.medicalSurveillance.findMany({ include: { worker: true } });
  for (const med of medicalRecords) {
    const days = daysFromNow(med.nextExamDue);
    if (days > REVIEW_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW";
    const message =
      days < 0
        ? `Medical surveillance for ${med.worker.name} is overdue by ${Math.abs(days)} day(s)`
        : `Medical surveillance for ${med.worker.name} due in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({
      siteId: med.worker.siteId,
      zoneId: med.worker.zoneId,
      severity,
      message,
    });
    if (alert) newAlerts.push(alert);
  }

  const inspections = await prisma.safetyInspection.findMany({ where: { status: "SCHEDULED" } });
  for (const insp of inspections) {
    const days = daysFromNow(insp.scheduledDate);
    if (days < 0) {
      await prisma.safetyInspection.update({ where: { id: insp.id }, data: { status: "OVERDUE" } });
      const message = `Safety inspection "${insp.title}" is overdue by ${Math.abs(days)} day(s)`;
      const alert = await raiseAlertIfMissing({ siteId: insp.siteId, zoneId: insp.zoneId, severity: "MEDIUM", message });
      if (alert) newAlerts.push(alert);
    } else if (days <= NOTICE_WARNING_DAYS) {
      const message = `Safety inspection "${insp.title}" scheduled in ${days} day(s)`;
      const alert = await raiseAlertIfMissing({ siteId: insp.siteId, zoneId: insp.zoneId, severity: "LOW", message });
      if (alert) newAlerts.push(alert);
    }
  }

  const permits = await prisma.permit.findMany({ where: { status: { in: ["ACTIVE", "PENDING_RENEWAL"] } } });
  for (const permit of permits) {
    const days = daysFromNow(permit.expiryDate);
    if (days > PERMIT_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "CRITICAL" : days <= 14 ? "HIGH" : days <= 30 ? "MEDIUM" : "LOW";
    const typeLabel = permit.type.replace(/_/g, " ");
    const message =
      days < 0
        ? `${typeLabel} "${permit.permitNumber}" expired ${Math.abs(days)} day(s) ago`
        : `${typeLabel} "${permit.permitNumber}" expires in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({ siteId: permit.siteId, severity, message });
    if (alert) newAlerts.push(alert);
  }

  const certificates = await prisma.certificate.findMany({
    where: { status: "ACTIVE", expiryDate: { not: null } },
    include: { worker: true },
  });
  for (const cert of certificates) {
    if (!cert.expiryDate) continue;
    const days = daysFromNow(cert.expiryDate);
    if (days > REVIEW_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "HIGH" : days <= 7 ? "MEDIUM" : "LOW";
    const typeLabel = cert.type.replace(/_/g, " ");
    const message =
      days < 0
        ? `${typeLabel} Certificate of Competency for ${cert.worker.name} is overdue by ${Math.abs(days)} day(s)`
        : `${typeLabel} Certificate of Competency for ${cert.worker.name} expires in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({
      siteId: cert.worker.siteId,
      zoneId: cert.worker.zoneId,
      severity,
      message,
    });
    if (alert) newAlerts.push(alert);
  }

  const trainingRecords = await prisma.trainingRecord.findMany({
    where: { expiryDate: { not: null } },
    include: { worker: true },
  });
  for (const training of trainingRecords) {
    if (!training.expiryDate) continue;
    const days = daysFromNow(training.expiryDate);
    if (days > REVIEW_WARNING_DAYS) continue;
    const severity: AlertSeverity = days < 0 ? "MEDIUM" : days <= 7 ? "LOW" : "LOW";
    const message =
      days < 0
        ? `${training.courseName} training for ${training.worker.name} is overdue by ${Math.abs(days)} day(s)`
        : `${training.courseName} training for ${training.worker.name} due in ${days} day(s)`;
    const alert = await raiseAlertIfMissing({
      siteId: training.worker.siteId,
      zoneId: training.worker.zoneId,
      severity,
      message,
    });
    if (alert) newAlerts.push(alert);
  }

  if (io) {
    for (const alert of newAlerts) io.emit("alert:new", alert);
  }

  return newAlerts;
}
