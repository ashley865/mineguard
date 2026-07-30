import { prisma } from "../prisma";

export interface ComplianceScoreBreakdown {
  codesOfPractice: { active: number; total: number };
  riskAssessments: { approved: number; total: number };
  permits: { active: number; total: number };
  safetyInspections: { completed: number; total: number };
  certificates: { active: number; total: number };
  trainingRecords: { total: number; expiringSoon: number };
  contractors: { active: number; total: number };
}

export interface ComplianceScoreResult {
  score: number;
  breakdown: ComplianceScoreBreakdown;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

export async function computeComplianceScore(siteId?: string): Promise<ComplianceScoreResult> {
  const siteFilter = siteId ? { siteId } : {};
  const workerSiteFilter = siteId ? { worker: { siteId } } : {};

  const [
    copActive,
    copTotal,
    riskApproved,
    riskTotal,
    permitsActive,
    permitsTotal,
    inspectionsCompleted,
    inspectionsTotal,
    certificatesActive,
    certificatesTotal,
    trainingTotal,
    trainingExpiringSoon,
    contractorsActive,
    contractorsTotal,
  ] = await Promise.all([
    prisma.codeOfPractice.count({ where: { ...siteFilter, status: "ACTIVE" } }),
    prisma.codeOfPractice.count({ where: siteFilter }),
    prisma.riskAssessment.count({ where: { ...siteFilter, status: "APPROVED" } }),
    prisma.riskAssessment.count({ where: siteFilter }),
    prisma.permit.count({ where: { ...siteFilter, status: "ACTIVE" } }),
    prisma.permit.count({ where: siteFilter }),
    prisma.safetyInspection.count({ where: { ...siteFilter, status: "COMPLETED" } }),
    prisma.safetyInspection.count({ where: siteFilter }),
    prisma.certificate.count({ where: { ...workerSiteFilter, status: "ACTIVE" } }),
    prisma.certificate.count({ where: workerSiteFilter }),
    prisma.trainingRecord.count({ where: workerSiteFilter }),
    prisma.trainingRecord.count({
      where: { ...workerSiteFilter, expiryDate: { not: null, lte: new Date(Date.now() + 90 * 86400000) } },
    }),
    prisma.contractor.count({ where: { ...siteFilter, status: "ACTIVE" } }),
    prisma.contractor.count({ where: siteFilter }),
  ]);

  const breakdown: ComplianceScoreBreakdown = {
    codesOfPractice: { active: copActive, total: copTotal },
    riskAssessments: { approved: riskApproved, total: riskTotal },
    permits: { active: permitsActive, total: permitsTotal },
    safetyInspections: { completed: inspectionsCompleted, total: inspectionsTotal },
    certificates: { active: certificatesActive, total: certificatesTotal },
    trainingRecords: { total: trainingTotal, expiringSoon: trainingExpiringSoon },
    contractors: { active: contractorsActive, total: contractorsTotal },
  };

  const rates = [
    rate(copActive, copTotal),
    rate(riskApproved, riskTotal),
    rate(permitsActive, permitsTotal),
    rate(inspectionsCompleted, inspectionsTotal),
    rate(certificatesActive, certificatesTotal),
    rate(trainingTotal - trainingExpiringSoon, trainingTotal),
    rate(contractorsActive, contractorsTotal),
  ];

  const score = Math.round((rates.reduce((sum, r) => sum + r, 0) / rates.length) * 100);

  return { score, breakdown };
}
