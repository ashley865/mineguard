-- CreateEnum
CREATE TYPE "RequirementFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONCE_OFF', 'AD_HOC');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING', 'COMPLIANT', 'NON_COMPLIANT', 'IN_PROGRESS', 'OVERDUE', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "ComplianceRequirement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "regulation" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "applicableOperation" TEXT NOT NULL,
    "responsibleDepartment" TEXT NOT NULL,
    "responsiblePersonId" TEXT,
    "frequency" "RequirementFrequency" NOT NULL,
    "evidenceRequired" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'PENDING',
    "riskLevel" "RiskLevel" NOT NULL,
    "lastVerification" TIMESTAMP(3),
    "nextReview" TIMESTAMP(3),
    "relatedDocuments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
