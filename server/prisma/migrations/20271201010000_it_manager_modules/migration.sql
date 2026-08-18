-- CreateEnum
CREATE TYPE "ITLicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ITBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'ONE_TIME', 'OTHER');

-- CreateEnum
CREATE TYPE "ITBackupRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL', 'NOT_RUN');

-- CreateEnum
CREATE TYPE "ITDrTestResult" AS ENUM ('PASSED', 'FAILED', 'NOT_TESTED');

-- CreateEnum
CREATE TYPE "ITIncidentType" AS ENUM ('PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'DENIAL_OF_SERVICE', 'VULNERABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ITIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ITIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ITChangeType" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ITChangeRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ITChangeStatus" AS ENUM ('PLANNED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ITVendorContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ITAccessRequestType" AS ENUM ('GRANT', 'MODIFY', 'REVOKE');

-- CreateEnum
CREATE TYPE "ITAccessRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROVISIONED', 'DENIED', 'REVOKED');

-- CreateTable
CREATE TABLE "ITSoftwareLicense" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "vendor" TEXT,
    "seatsTotal" INTEGER NOT NULL,
    "seatsUsed" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "billingCycle" "ITBillingCycle" NOT NULL DEFAULT 'ANNUAL',
    "status" "ITLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "purchaseDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITSoftwareLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITBackupRecord" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "schedule" TEXT,
    "retentionDays" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" "ITBackupRunStatus" NOT NULL DEFAULT 'NOT_RUN',
    "lastDrTestDate" TIMESTAMP(3),
    "lastDrTestResult" "ITDrTestResult" NOT NULL DEFAULT 'NOT_TESTED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITBackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITSecurityIncident" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "incidentType" "ITIncidentType" NOT NULL DEFAULT 'OTHER',
    "severity" "ITIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ITIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "affectedSystems" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "remediation" TEXT,
    "reportedByName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITSecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITChangeRequest" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "changeType" "ITChangeType" NOT NULL DEFAULT 'STANDARD',
    "systemAffected" TEXT,
    "description" TEXT NOT NULL,
    "riskLevel" "ITChangeRisk" NOT NULL DEFAULT 'LOW',
    "status" "ITChangeStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" TIMESTAMP(3),
    "implementedDate" TIMESTAMP(3),
    "rollbackPlan" TEXT,
    "outcome" TEXT,
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITVendorContract" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "annualCost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "ITVendorContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "ownerName" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITVendorContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITAccessRequest" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "accessLevel" TEXT,
    "requestType" "ITAccessRequestType" NOT NULL DEFAULT 'GRANT',
    "status" "ITAccessRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionedDate" TIMESTAMP(3),
    "approvedById" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITAccessRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ITSoftwareLicense" ADD CONSTRAINT "ITSoftwareLicense_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITSoftwareLicense" ADD CONSTRAINT "ITSoftwareLicense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITBackupRecord" ADD CONSTRAINT "ITBackupRecord_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITBackupRecord" ADD CONSTRAINT "ITBackupRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITSecurityIncident" ADD CONSTRAINT "ITSecurityIncident_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITSecurityIncident" ADD CONSTRAINT "ITSecurityIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITChangeRequest" ADD CONSTRAINT "ITChangeRequest_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITChangeRequest" ADD CONSTRAINT "ITChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITChangeRequest" ADD CONSTRAINT "ITChangeRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITVendorContract" ADD CONSTRAINT "ITVendorContract_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITVendorContract" ADD CONSTRAINT "ITVendorContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAccessRequest" ADD CONSTRAINT "ITAccessRequest_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAccessRequest" ADD CONSTRAINT "ITAccessRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAccessRequest" ADD CONSTRAINT "ITAccessRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

