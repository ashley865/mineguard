-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('HAZARDOUS', 'GENERAL', 'RECYCLABLE');

-- CreateEnum
CREATE TYPE "WasteStreamStatus" AS ENUM ('ACTIVE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "WasteDisposalMethod" AS ENUM ('LANDFILL', 'INCINERATION', 'RECYCLING', 'TREATMENT', 'RECOVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "EmissionLicenceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "BoreholeType" AS ENUM ('UPGRADIENT', 'DOWNGRADIENT', 'SUPPLY', 'OTHER');

-- CreateEnum
CREATE TYPE "BoreholeStatus" AS ENUM ('ACTIVE', 'DECOMMISSIONED', 'DRY');

-- CreateEnum
CREATE TYPE "EnvironmentalIncidentCategory" AS ENUM ('SPILL', 'WATER_POLLUTION', 'AIR_POLLUTION', 'DUST_EXCEEDANCE', 'WASTE_MISMANAGEMENT', 'NOISE', 'ECOLOGICAL_DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnvironmentalIncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC');

-- CreateEnum
CREATE TYPE "EnvironmentalRemediationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'VERIFIED');

-- CreateTable
CREATE TABLE "WasteStream" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wasteType" "WasteType" NOT NULL,
    "classificationCode" TEXT,
    "sourceActivity" TEXT,
    "storageLocation" TEXT,
    "storageCapacity" DOUBLE PRECISION,
    "storageCapacityUnit" TEXT,
    "storageStartDate" TIMESTAMP(3),
    "storageLimitMonths" INTEGER,
    "status" "WasteStreamStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteManifest" (
    "id" TEXT NOT NULL,
    "wasteStreamId" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "transporterName" TEXT,
    "transporterRegistrationNumber" TEXT,
    "disposalFacilityName" TEXT NOT NULL,
    "disposalFacilityLicenceNumber" TEXT,
    "disposalMethod" "WasteDisposalMethod" NOT NULL,
    "receivedConfirmationDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionLicence" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "EmissionLicenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "conditionsSummary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmissionLicence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackEmissionTest" (
    "id" TEXT NOT NULL,
    "emissionLicenceId" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "stackName" TEXT NOT NULL,
    "pollutant" TEXT NOT NULL,
    "measuredValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "licensedLimit" DOUBLE PRECISION,
    "compliant" BOOLEAN NOT NULL DEFAULT true,
    "testingAuthority" TEXT,
    "certificateNumber" TEXT,
    "nextTestDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StackEmissionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DustFalloutReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "monitoringPoint" TEXT NOT NULL,
    "readingMonth" TIMESTAMP(3) NOT NULL,
    "dustFalloutRate" DOUBLE PRECISION NOT NULL,
    "thresholdMgM2Day" DOUBLE PRECISION,
    "withinLimit" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DustFalloutReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringBorehole" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "boreholeType" "BoreholeType" NOT NULL DEFAULT 'OTHER',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "installedDate" TIMESTAMP(3),
    "staticWaterLevelBaselineM" DOUBLE PRECISION,
    "status" "BoreholeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringBorehole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundwaterReading" (
    "id" TEXT NOT NULL,
    "boreholeId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "waterLevelMbgl" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "electricalConductivity" DOUBLE PRECISION,
    "totalDissolvedSolids" DOUBLE PRECISION,
    "sulfateConcentration" DOUBLE PRECISION,
    "withinLimits" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroundwaterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalIncident" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "category" "EnvironmentalIncidentCategory" NOT NULL,
    "severity" "EnvironmentalIncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "description" TEXT NOT NULL,
    "receivingEnvironment" TEXT,
    "estimatedVolume" DOUBLE PRECISION,
    "volumeUnit" TEXT,
    "immediateActionTaken" TEXT,
    "regulatorNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "regulatorNotifiedAt" TIMESTAMP(3),
    "regulatorNotifiedTo" TEXT,
    "remediationStatus" "EnvironmentalRemediationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "remediationCompletedAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "recurrencePrevented" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "reportedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalIncident_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WasteStream" ADD CONSTRAINT "WasteStream_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteManifest" ADD CONSTRAINT "WasteManifest_wasteStreamId_fkey" FOREIGN KEY ("wasteStreamId") REFERENCES "WasteStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionLicence" ADD CONSTRAINT "EmissionLicence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackEmissionTest" ADD CONSTRAINT "StackEmissionTest_emissionLicenceId_fkey" FOREIGN KEY ("emissionLicenceId") REFERENCES "EmissionLicence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DustFalloutReading" ADD CONSTRAINT "DustFalloutReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringBorehole" ADD CONSTRAINT "MonitoringBorehole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundwaterReading" ADD CONSTRAINT "GroundwaterReading_boreholeId_fkey" FOREIGN KEY ("boreholeId") REFERENCES "MonitoringBorehole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalIncident" ADD CONSTRAINT "EnvironmentalIncident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalIncident" ADD CONSTRAINT "EnvironmentalIncident_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalIncident" ADD CONSTRAINT "EnvironmentalIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
