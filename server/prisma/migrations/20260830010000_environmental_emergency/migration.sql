-- CreateEnum
CREATE TYPE "EnvironmentalParameterType" AS ENUM ('WATER_QUALITY', 'AIR_QUALITY', 'DUST', 'NOISE', 'TAILINGS_DAM_LEVEL');

-- CreateTable
CREATE TABLE "EnvironmentalReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "monitoringPoint" TEXT NOT NULL,
    "parameterType" "EnvironmentalParameterType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "thresholdMin" DOUBLE PRECISION,
    "thresholdMax" DOUBLE PRECISION,
    "withinLimits" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalReading_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EnvironmentalReading" ADD CONSTRAINT "EnvironmentalReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalReading" ADD CONSTRAINT "EnvironmentalReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "EmergencyContactCategory" AS ENUM ('MINE_RESCUE', 'MEDICAL', 'FIRE', 'POLICE', 'INTERNAL_MANAGEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" "EmergencyContactCategory" NOT NULL DEFAULT 'OTHER',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "EvacuationDrillType" AS ENUM ('FIRE', 'GAS_LEAK', 'SEISMIC', 'GENERAL');

-- CreateTable
CREATE TABLE "EvacuationDrill" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL,
    "drillType" "EvacuationDrillType" NOT NULL,
    "totalParticipants" INTEGER,
    "musterTimeSeconds" INTEGER,
    "issuesIdentified" TEXT,
    "conductedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvacuationDrill_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EvacuationDrill" ADD CONSTRAINT "EvacuationDrill_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationDrill" ADD CONSTRAINT "EvacuationDrill_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
