import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

router.get("/:siteId", async (req, res) => {
  const { siteId } = req.params;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const [
    permits,
    codesOfPractice,
    riskAssessments,
    openNotices,
    inspections,
    workers,
    certificates,
    trainingRecords,
    recentVisits,
  ] = await Promise.all([
    prisma.permit.findMany({ where: { siteId }, orderBy: { expiryDate: "asc" } }),
    prisma.codeOfPractice.findMany({ where: { siteId, status: "ACTIVE" }, orderBy: { reviewDate: "asc" } }),
    prisma.riskAssessment.findMany({ where: { siteId, status: "APPROVED" }, orderBy: { reviewDate: "asc" } }),
    prisma.regulatoryNotice.findMany({ where: { siteId, status: "OPEN" }, orderBy: { issuedDate: "desc" } }),
    prisma.safetyInspection.findMany({ where: { siteId } }),
    prisma.worker.findMany({ where: { siteId }, select: { id: true } }),
    prisma.certificate.findMany({ where: { worker: { siteId } }, include: { worker: { select: { name: true } } } }),
    prisma.trainingRecord.findMany({ where: { worker: { siteId } }, include: { worker: { select: { name: true } } } }),
    prisma.inspectionVisit.findMany({
      where: { siteId },
      orderBy: { visitDate: "desc" },
      take: 5,
      include: { relatedNotice: { select: { id: true, noticeNumber: true } } },
    }),
  ]);

  const now = new Date();
  const inspectionsCompleted = inspections.filter((i) => i.status === "COMPLETED").length;
  const inspectionsOverdue = inspections.filter((i) => i.status === "OVERDUE").length;

  const certsExpiringSoon = certificates.filter(
    (c) => c.expiryDate && c.status === "ACTIVE" && (c.expiryDate.getTime() - now.getTime()) / 86400000 <= 30
  ).length;
  const certsActive = certificates.filter((c) => c.status === "ACTIVE").length;

  const trainingExpiringSoon = trainingRecords.filter(
    (t) => t.expiryDate && (t.expiryDate.getTime() - now.getTime()) / 86400000 <= 30
  ).length;

  res.json({
    site,
    generatedAt: now,
    permits,
    codesOfPractice,
    riskAssessments,
    openNotices,
    safetyInspections: {
      total: inspections.length,
      completed: inspectionsCompleted,
      overdue: inspectionsOverdue,
    },
    workforce: {
      totalWorkers: workers.length,
      certificatesTotal: certificates.length,
      certificatesActive: certsActive,
      certificatesExpiringSoon: certsExpiringSoon,
      trainingTotal: trainingRecords.length,
      trainingExpiringSoon,
    },
    recentVisits,
  });
});

export default router;
