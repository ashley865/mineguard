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
    documents,
    bids,
    contracts,
    explosivesMagazines,
    environmentalReadings,
    safetyObservations,
    productionRecords,
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
    prisma.document.findMany({
      where: { OR: [{ siteId }, { siteId: null }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        version: true,
        status: true,
        reviewDate: true,
        fileName: true,
        createdAt: true,
      },
    }),
    prisma.mineralBid.findMany({
      where: { listing: { siteId }, buyer: { status: "APPROVED" } },
      distinct: ["buyerId"],
      include: {
        buyer: {
          select: {
            id: true,
            legalName: true,
            buyerType: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            taxNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contractOpportunity.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      include: { bids: { where: { status: "AWARDED" }, select: { id: true, companyName: true, bidAmount: true } } },
    }),
    prisma.explosivesMagazine.findMany({ where: { siteId }, orderBy: { licenseExpiry: "asc" } }),
    prisma.environmentalReading.findMany({
      where: { siteId },
      orderBy: { recordedAt: "desc" },
      take: 20,
    }),
    prisma.safetyObservation.findMany({ where: { siteId } }),
    prisma.productionRecord.findMany({
      where: { siteId, shiftDate: { gte: new Date(Date.now() - 30 * 86400000) } },
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

  const buyers = bids.map((b) => b.buyer);

  const awardedContracts = contracts.filter((c) => c.status === "AWARDED");

  const explosivesExpiringSoon = explosivesMagazines.filter(
    (m) => (m.licenseExpiry.getTime() - now.getTime()) / 86400000 <= 30
  ).length;

  const environmentalOutOfLimits = environmentalReadings.filter((r) => !r.withinLimits).length;

  const safetyObservationsOpen = safetyObservations.filter((o) => o.status === "OPEN").length;

  const tonnesLast30Days = productionRecords.reduce((sum, r) => sum + r.tonnesMined, 0);

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
    documents: {
      total: documents.length,
      items: documents.slice(0, 10),
    },
    buyers: {
      total: buyers.length,
      items: buyers,
    },
    contracts: {
      total: contracts.length,
      awarded: awardedContracts.length,
      items: contracts.slice(0, 10),
    },
    explosives: {
      total: explosivesMagazines.length,
      expiringSoon: explosivesExpiringSoon,
      items: explosivesMagazines,
    },
    environmental: {
      readingsCount: environmentalReadings.length,
      outOfLimits: environmentalOutOfLimits,
      items: environmentalReadings.slice(0, 10),
    },
    safetyObservations: {
      total: safetyObservations.length,
      open: safetyObservationsOpen,
    },
    production: {
      tonnesLast30Days,
      recordsLast30Days: productionRecords.length,
    },
  });
});

export default router;
