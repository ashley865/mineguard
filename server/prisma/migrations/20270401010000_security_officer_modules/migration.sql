-- CreateEnum
CREATE TYPE "GatePassType" AS ENUM ('VISITOR', 'CONTRACTOR', 'EMPLOYEE_VEHICLE', 'DELIVERY_VEHICLE', 'EQUIPMENT_REMOVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "GateLogDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvestigationOutcome" AS ENUM ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE', 'REFERRED_EXTERNAL');

-- CreateEnum
CREATE TYPE "SecurityKeyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "KeyIssueEventType" AS ENUM ('ISSUED', 'RETURNED', 'REPORTED_LOST');

-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "GatePassType" NOT NULL DEFAULT 'VISITOR',
    "holderName" TEXT NOT NULL,
    "company" TEXT,
    "idNumber" TEXT,
    "vehicleReg" TEXT,
    "purpose" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "status" "GatePassStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedReason" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "gatePassId" TEXT,
    "direction" "GateLogDirection" NOT NULL,
    "personName" TEXT NOT NULL,
    "company" TEXT,
    "vehicleReg" TEXT,
    "itemsCarried" TEXT,
    "gateName" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityBlacklistEntry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "idNumber" TEXT,
    "vehicleReg" TEXT,
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityBlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityInvestigation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "securityIncidentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "AlertSeverity",
    "status" "InvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "InvestigationOutcome",
    "findings" TEXT,
    "leadInvestigatorId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationEvidence" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileName" TEXT,
    "fileMimeType" TEXT,
    "fileSize" INTEGER,
    "fileData" BYTEA,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationStatement" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "role" TEXT,
    "statement" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityKey" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "keyCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" "SecurityKeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentHolderName" TEXT,
    "currentWorkerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyIssueLog" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "eventType" "KeyIssueEventType" NOT NULL,
    "holderName" TEXT,
    "workerId" TEXT,
    "notes" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyIssueLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityInvestigation_securityIncidentId_key" ON "SecurityInvestigation"("securityIncidentId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityKey_siteId_keyCode_key" ON "SecurityKey"("siteId", "keyCode");

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_gatePassId_fkey" FOREIGN KEY ("gatePassId") REFERENCES "GatePass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityBlacklistEntry" ADD CONSTRAINT "SecurityBlacklistEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityBlacklistEntry" ADD CONSTRAINT "SecurityBlacklistEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityInvestigation" ADD CONSTRAINT "SecurityInvestigation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityInvestigation" ADD CONSTRAINT "SecurityInvestigation_securityIncidentId_fkey" FOREIGN KEY ("securityIncidentId") REFERENCES "SecurityIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityInvestigation" ADD CONSTRAINT "SecurityInvestigation_leadInvestigatorId_fkey" FOREIGN KEY ("leadInvestigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityInvestigation" ADD CONSTRAINT "SecurityInvestigation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "SecurityInvestigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationStatement" ADD CONSTRAINT "InvestigationStatement_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "SecurityInvestigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationStatement" ADD CONSTRAINT "InvestigationStatement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityKey" ADD CONSTRAINT "SecurityKey_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityKey" ADD CONSTRAINT "SecurityKey_currentWorkerId_fkey" FOREIGN KEY ("currentWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityKey" ADD CONSTRAINT "SecurityKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyIssueLog" ADD CONSTRAINT "KeyIssueLog_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "SecurityKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyIssueLog" ADD CONSTRAINT "KeyIssueLog_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyIssueLog" ADD CONSTRAINT "KeyIssueLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

