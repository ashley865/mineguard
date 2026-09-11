-- CreateEnum
CREATE TYPE "BeaconType" AS ENUM ('PRIMARY_SG_BEACON', 'SECONDARY_MINE_BEACON', 'UNDERGROUND_STATION', 'OTHER');

-- CreateEnum
CREATE TYPE "BeaconCondition" AS ENUM ('INTACT', 'DAMAGED', 'MISSING', 'REPLACED');

-- CreateEnum
CREATE TYPE "QaqcSampleType" AS ENUM ('CERTIFIED_REFERENCE_STANDARD', 'FIELD_DUPLICATE', 'PULP_DUPLICATE', 'BLANK', 'CHECK_ASSAY');

-- CreateEnum
CREATE TYPE "QaqcResult" AS ENUM ('PASS', 'WARNING', 'FAIL');

-- CreateEnum
CREATE TYPE "MineralRightType" AS ENUM ('PROSPECTING_RIGHT', 'MINING_RIGHT', 'MINING_PERMIT', 'RECONNAISSANCE_PERMIT', 'RETENTION_PERMIT');

-- CreateEnum
CREATE TYPE "MineralRightStatus" AS ENUM ('ACTIVE', 'RENEWAL_PENDING', 'EXPIRED', 'RELINQUISHED');

-- CreateTable
CREATE TABLE "SurveyPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "planReferenceNumber" TEXT,
    "surveyDate" TIMESTAMP(3) NOT NULL,
    "surveyorName" TEXT NOT NULL,
    "surveyorRegistrationNumber" TEXT,
    "workingsExtentDescription" TEXT,
    "submittedToRegulator" BOOLEAN NOT NULL DEFAULT false,
    "submittedDate" TIMESTAMP(3),
    "nextSurveyDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoundaryBeacon" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "beaconType" "BeaconType" NOT NULL DEFAULT 'OTHER',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "lastVerifiedDate" TIMESTAMP(3),
    "nextVerificationDue" TIMESTAMP(3),
    "condition" "BeaconCondition" NOT NULL DEFAULT 'INTACT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoundaryBeacon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaqcSample" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "drillHoleId" TEXT,
    "sampleType" "QaqcSampleType" NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "labName" TEXT,
    "batchNumber" TEXT,
    "mineralType" "MineralType" NOT NULL,
    "referenceValue" DOUBLE PRECISION,
    "measuredValue" DOUBLE PRECISION,
    "toleranceRangeLow" DOUBLE PRECISION,
    "toleranceRangeHigh" DOUBLE PRECISION,
    "result" "QaqcResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaqcSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MineralRight" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "siteId" TEXT,
    "rightType" "MineralRightType" NOT NULL,
    "rightReferenceNumber" TEXT NOT NULL,
    "mineralsScheduled" TEXT,
    "areaHectares" DOUBLE PRECISION,
    "holderName" TEXT,
    "grantedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalApplicationDue" TIMESTAMP(3),
    "renewalLodgedDate" TIMESTAMP(3),
    "status" "MineralRightStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MineralRight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeReconciliation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "mineralType" "MineralType" NOT NULL,
    "estimatedTonnes" DOUBLE PRECISION NOT NULL,
    "estimatedGrade" DOUBLE PRECISION NOT NULL,
    "gradeUnit" TEXT,
    "actualTonnesMined" DOUBLE PRECISION,
    "actualGradeMined" DOUBLE PRECISION,
    "actualTonnesMilled" DOUBLE PRECISION,
    "actualGradeMilled" DOUBLE PRECISION,
    "varianceExplanation" TEXT,
    "reconciledById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeReconciliation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SurveyPlan" ADD CONSTRAINT "SurveyPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoundaryBeacon" ADD CONSTRAINT "BoundaryBeacon_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaqcSample" ADD CONSTRAINT "QaqcSample_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaqcSample" ADD CONSTRAINT "QaqcSample_drillHoleId_fkey" FOREIGN KEY ("drillHoleId") REFERENCES "DrillHole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralRight" ADD CONSTRAINT "MineralRight_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralRight" ADD CONSTRAINT "MineralRight_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeReconciliation" ADD CONSTRAINT "GradeReconciliation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeReconciliation" ADD CONSTRAINT "GradeReconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
