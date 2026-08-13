-- CreateEnum
CREATE TYPE "SensorInstallationStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'INSTALLED', 'COMMISSIONED');

-- CreateEnum
CREATE TYPE "CommunityProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunityEngagementType" AS ENUM ('PUBLIC_MEETING', 'FOCUS_GROUP', 'FORUM', 'SITE_VISIT', 'SURVEY', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityGrievanceStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'ESCALATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DrillHoleStatus" AS ENUM ('PLANNED', 'DRILLING', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ResourceClassification" AS ENUM ('MEASURED', 'INDICATED', 'INFERRED', 'PROVED_RESERVE', 'PROBABLE_RESERVE');

-- CreateEnum
CREATE TYPE "WinderInspectionResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ConveyanceStatus" AS ENUM ('IN_SERVICE', 'DISCARDED', 'PENDING_REPLACEMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SensorType" ADD VALUE 'CARBON_DIOXIDE';
ALTER TYPE "SensorType" ADD VALUE 'NITROGEN_OXIDES';
ALTER TYPE "SensorType" ADD VALUE 'SULFUR_DIOXIDE';
ALTER TYPE "SensorType" ADD VALUE 'HYDROGEN_SULFIDE';
ALTER TYPE "SensorType" ADD VALUE 'RADIATION';
ALTER TYPE "SensorType" ADD VALUE 'SMOKE_FIRE';
ALTER TYPE "SensorType" ADD VALUE 'VIBRATION';
ALTER TYPE "SensorType" ADD VALUE 'PRESSURE';
ALTER TYPE "SensorType" ADD VALUE 'FLOW_RATE';
ALTER TYPE "SensorType" ADD VALUE 'CONVEYOR_ALIGNMENT';
ALTER TYPE "SensorType" ADD VALUE 'PROXIMITY_COLLISION';
ALTER TYPE "SensorType" ADD VALUE 'GPS_LOCATION';
ALTER TYPE "SensorType" ADD VALUE 'PUMP_STATUS';
ALTER TYPE "SensorType" ADD VALUE 'FAN_STATUS';
ALTER TYPE "SensorType" ADD VALUE 'ACCESS_CONTROL';

-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "commissionedAt" TIMESTAMP(3),
ADD COLUMN     "commissionedById" TEXT,
ADD COLUMN     "installationNotes" TEXT,
ADD COLUMN     "installationStatus" "SensorInstallationStatus" NOT NULL DEFAULT 'COMMISSIONED',
ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "installedById" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "scheduledDate" TIMESTAMP(3),
ADD COLUMN     "serialNumber" TEXT;

-- CreateTable
CREATE TABLE "CommunityProject" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "budget" DOUBLE PRECISION,
    "spentToDate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "startDate" TIMESTAMP(3),
    "targetCompletionDate" TIMESTAMP(3),
    "status" "CommunityProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "beneficiaries" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEngagement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "engagementType" "CommunityEngagementType" NOT NULL,
    "engagementDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "attendeesCount" INTEGER,
    "topicsDiscussed" TEXT,
    "outcomes" TEXT,
    "facilitatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGrievance" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "complainantName" TEXT NOT NULL,
    "complainantContact" TEXT,
    "description" TEXT NOT NULL,
    "dateRaised" TIMESTAMP(3) NOT NULL,
    "status" "CommunityGrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityGrievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySpendRecord" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "supplierOrBeneficiary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunitySpendRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillHole" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "collarEasting" DOUBLE PRECISION,
    "collarNorthing" DOUBLE PRECISION,
    "collarElevation" DOUBLE PRECISION,
    "azimuth" DOUBLE PRECISION,
    "dip" DOUBLE PRECISION,
    "totalDepth" DOUBLE PRECISION,
    "status" "DrillHoleStatus" NOT NULL DEFAULT 'PLANNED',
    "drilledDate" TIMESTAMP(3),
    "contractor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillHole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssayInterval" (
    "id" TEXT NOT NULL,
    "drillHoleId" TEXT NOT NULL,
    "fromDepth" DOUBLE PRECISION NOT NULL,
    "toDepth" DOUBLE PRECISION NOT NULL,
    "mineralType" "MineralType" NOT NULL,
    "grade" DOUBLE PRECISION,
    "gradeUnit" TEXT,
    "lithology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssayInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceEstimate" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "estimateDate" TIMESTAMP(3) NOT NULL,
    "mineralType" "MineralType" NOT NULL,
    "classification" "ResourceClassification" NOT NULL,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "grade" DOUBLE PRECISION,
    "gradeUnit" TEXT,
    "containedMetal" DOUBLE PRECISION,
    "competentPerson" TEXT,
    "reportReference" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winder" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shaftName" TEXT,
    "winderType" TEXT,
    "installedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Winder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinderInspection" (
    "id" TEXT NOT NULL,
    "winderId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspector" TEXT NOT NULL,
    "brakeTestResult" "WinderInspectionResult",
    "findings" TEXT,
    "correctiveActions" TEXT,
    "nextInspectionDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinderInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConveyanceRope" (
    "id" TEXT NOT NULL,
    "winderId" TEXT NOT NULL,
    "ropeIdentifier" TEXT NOT NULL,
    "installedDate" TIMESTAMP(3) NOT NULL,
    "discardDate" TIMESTAMP(3),
    "lastTestDate" TIMESTAMP(3),
    "nextTestDue" TIMESTAMP(3),
    "status" "ConveyanceStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConveyanceRope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShaftInspection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shaftName" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspector" TEXT NOT NULL,
    "headgearCondition" TEXT,
    "findings" TEXT,
    "correctiveActions" TEXT,
    "nextInspectionDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShaftInspection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_commissionedById_fkey" FOREIGN KEY ("commissionedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProject" ADD CONSTRAINT "CommunityProject_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEngagement" ADD CONSTRAINT "CommunityEngagement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEngagement" ADD CONSTRAINT "CommunityEngagement_facilitatedById_fkey" FOREIGN KEY ("facilitatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGrievance" ADD CONSTRAINT "CommunityGrievance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySpendRecord" ADD CONSTRAINT "CommunitySpendRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillHole" ADD CONSTRAINT "DrillHole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssayInterval" ADD CONSTRAINT "AssayInterval_drillHoleId_fkey" FOREIGN KEY ("drillHoleId") REFERENCES "DrillHole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceEstimate" ADD CONSTRAINT "ResourceEstimate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winder" ADD CONSTRAINT "Winder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinderInspection" ADD CONSTRAINT "WinderInspection_winderId_fkey" FOREIGN KEY ("winderId") REFERENCES "Winder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConveyanceRope" ADD CONSTRAINT "ConveyanceRope_winderId_fkey" FOREIGN KEY ("winderId") REFERENCES "Winder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShaftInspection" ADD CONSTRAINT "ShaftInspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

