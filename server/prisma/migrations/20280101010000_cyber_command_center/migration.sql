-- CreateEnum
CREATE TYPE "CyberSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "CyberDomain" AS ENUM ('ENDPOINT', 'IDENTITY', 'NETWORK', 'VULNERABILITY', 'EMAIL', 'BACKUP', 'OT_IOT', 'COMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CyberAlertStatus" AS ENUM ('NEW', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "CyberIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CyberEndpointDeviceType" AS ENUM ('COMPUTER', 'SERVER', 'MOBILE', 'IOT', 'OT_EQUIPMENT');

-- CreateEnum
CREATE TYPE "CyberEndpointAvStatus" AS ENUM ('PROTECTED', 'OUTDATED', 'MISSING', 'DISABLED');

-- CreateEnum
CREATE TYPE "CyberEndpointPatchStatus" AS ENUM ('UP_TO_DATE', 'PENDING', 'OVERDUE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CyberEndpointEncryptionStatus" AS ENUM ('ENCRYPTED', 'NOT_ENCRYPTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CyberNetworkAssetType" AS ENUM ('FIREWALL', 'VPN_GATEWAY', 'ROUTER_SWITCH', 'IDS_IPS', 'ROGUE_DEVICE', 'OPEN_PORT', 'SUSPICIOUS_CONNECTION');

-- CreateEnum
CREATE TYPE "CyberNetworkAssetStatus" AS ENUM ('SECURE', 'WARNING', 'COMPROMISED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CyberVulnerabilityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PATCHED', 'ACCEPTED_RISK', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "CyberCompliancePolicyStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'IN_PROGRESS', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "CyberFindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK');

-- CreateEnum
CREATE TYPE "CyberLoginEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CyberEndpoint" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "deviceType" "CyberEndpointDeviceType" NOT NULL DEFAULT 'COMPUTER',
    "ownerName" TEXT,
    "operatingSystem" TEXT,
    "avEdrStatus" "CyberEndpointAvStatus" NOT NULL DEFAULT 'MISSING',
    "avEdrProduct" TEXT,
    "patchStatus" "CyberEndpointPatchStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastPatchedAt" TIMESTAMP(3),
    "encryptionStatus" "CyberEndpointEncryptionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "isCompromised" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberNetworkAsset" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "assetType" "CyberNetworkAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" "CyberNetworkAssetStatus" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberNetworkAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberVulnerability" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "cveId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "severity" "CyberSeverity" NOT NULL DEFAULT 'MEDIUM',
    "affectedAssetName" TEXT,
    "status" "CyberVulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediationDeadline" TIMESTAMP(3),
    "assignedToId" TEXT,
    "remediatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberIncident" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "CyberSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "CyberIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "affectedAssets" TEXT,
    "riskScore" INTEGER,
    "aiSummary" TEXT,
    "assignedToId" TEXT,
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberAlert" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" "CyberDomain" NOT NULL DEFAULT 'OTHER',
    "severity" "CyberSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "CyberAlertStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "affectedAssetName" TEXT,
    "assignedToId" TEXT,
    "incidentId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberCompliancePolicy" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT,
    "status" "CyberCompliancePolicyStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "ownerName" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberCompliancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberAuditFinding" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "CyberSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "CyberFindingStatus" NOT NULL DEFAULT 'OPEN',
    "policyId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberLoginEvent" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "CyberLoginEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberScoreSnapshot" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "capturedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CyberScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CyberScoreSnapshot_mineId_capturedDate_key" ON "CyberScoreSnapshot"("mineId", "capturedDate");

-- AddForeignKey
ALTER TABLE "CyberEndpoint" ADD CONSTRAINT "CyberEndpoint_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberEndpoint" ADD CONSTRAINT "CyberEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberNetworkAsset" ADD CONSTRAINT "CyberNetworkAsset_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberNetworkAsset" ADD CONSTRAINT "CyberNetworkAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberVulnerability" ADD CONSTRAINT "CyberVulnerability_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberVulnerability" ADD CONSTRAINT "CyberVulnerability_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberVulnerability" ADD CONSTRAINT "CyberVulnerability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberIncident" ADD CONSTRAINT "CyberIncident_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberIncident" ADD CONSTRAINT "CyberIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberIncident" ADD CONSTRAINT "CyberIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAlert" ADD CONSTRAINT "CyberAlert_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAlert" ADD CONSTRAINT "CyberAlert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAlert" ADD CONSTRAINT "CyberAlert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CyberIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAlert" ADD CONSTRAINT "CyberAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberCompliancePolicy" ADD CONSTRAINT "CyberCompliancePolicy_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberCompliancePolicy" ADD CONSTRAINT "CyberCompliancePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAuditFinding" ADD CONSTRAINT "CyberAuditFinding_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAuditFinding" ADD CONSTRAINT "CyberAuditFinding_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CyberCompliancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberAuditFinding" ADD CONSTRAINT "CyberAuditFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberLoginEvent" ADD CONSTRAINT "CyberLoginEvent_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberLoginEvent" ADD CONSTRAINT "CyberLoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberScoreSnapshot" ADD CONSTRAINT "CyberScoreSnapshot_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

