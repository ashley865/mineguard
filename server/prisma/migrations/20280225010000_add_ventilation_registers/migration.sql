-- CreateEnum
CREATE TYPE "FanType" AS ENUM ('MAIN_SURFACE', 'MAIN_UNDERGROUND', 'BOOSTER', 'AUXILIARY', 'FORCE', 'EXHAUST', 'OTHER');

-- CreateEnum
CREATE TYPE "FanStatus" AS ENUM ('RUNNING', 'STOPPED', 'STANDBY', 'UNDER_REPAIR', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "FanStoppageReason" AS ENUM ('PLANNED_MAINTENANCE', 'BREAKDOWN', 'POWER_FAILURE', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "GasInstrumentType" AS ENUM ('PORTABLE_MULTI_GAS', 'METHANOMETER', 'CO_DETECTOR', 'OXYGEN_METER', 'FLAME_SAFETY_LAMP', 'ANEMOMETER', 'DUST_PUMP', 'OTHER');

-- CreateEnum
CREATE TYPE "GasInstrumentStatus" AS ENUM ('IN_SERVICE', 'OUT_OF_CALIBRATION', 'UNDER_REPAIR', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CalibrationType" AS ENUM ('FULL_CALIBRATION', 'BUMP_TEST', 'ZERO_CHECK', 'SPAN_CHECK');

-- CreateEnum
CREATE TYPE "CalibrationResult" AS ENUM ('PASS', 'ADJUSTED', 'FAIL');

-- CreateEnum
CREATE TYPE "ThermalStationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "AcclimatisationStatus" AS ENUM ('NOT_REQUIRED', 'IN_PROGRESS', 'ACCLIMATISED', 'LAPSED');

-- CreateEnum
CREATE TYPE "SelfRescuerType" AS ENUM ('FILTER_SELF_RESCUER', 'SELF_CONTAINED_SELF_RESCUER', 'CACHE_UNIT', 'OTHER');

-- CreateEnum
CREATE TYPE "SelfRescuerStatus" AS ENUM ('ISSUED', 'IN_STORE', 'EXPIRED', 'WITHDRAWN', 'DEPLOYED');

-- CreateEnum
CREATE TYPE "EscapeRouteCondition" AS ENUM ('CLEAR', 'OBSTRUCTED', 'IMPASSABLE', 'UNDER_REPAIR');

-- CreateTable
CREATE TABLE "VentilationFan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "identifier" TEXT NOT NULL,
    "fanType" "FanType" NOT NULL,
    "location" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "dutyQuantityM3s" DOUBLE PRECISION,
    "dutyPressurePa" DOUBLE PRECISION,
    "motorKw" DOUBLE PRECISION,
    "installedDate" TIMESTAMP(3),
    "lastSurveyDate" TIMESTAMP(3),
    "nextSurveyDue" TIMESTAMP(3),
    "primaryVentilation" BOOLEAN NOT NULL DEFAULT false,
    "status" "FanStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VentilationFan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanSurvey" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "surveyDate" TIMESTAMP(3) NOT NULL,
    "measuredQuantityM3s" DOUBLE PRECISION,
    "measuredPressurePa" DOUBLE PRECISION,
    "motorAmps" DOUBLE PRECISION,
    "surveyedByName" TEXT NOT NULL,
    "meetsDuty" BOOLEAN NOT NULL DEFAULT true,
    "findings" TEXT,
    "nextSurveyDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanStoppage" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" "FanStoppageReason" NOT NULL,
    "personsWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalNote" TEXT,
    "reportedToRegulator" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanStoppage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasDetectionInstrument" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "instrumentType" "GasInstrumentType" NOT NULL,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "assignedTo" TEXT,
    "lastCalibrationDate" TIMESTAMP(3),
    "nextCalibrationDue" TIMESTAMP(3),
    "lastBumpTestDate" TIMESTAMP(3),
    "nextBumpTestDue" TIMESTAMP(3),
    "status" "GasInstrumentStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasDetectionInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentCalibration" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL,
    "calibrationType" "CalibrationType" NOT NULL,
    "performedByName" TEXT NOT NULL,
    "gasStandardUsed" TEXT,
    "result" "CalibrationResult" NOT NULL DEFAULT 'PASS',
    "findings" TEXT,
    "nextDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThermalStressStation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "identifier" TEXT NOT NULL,
    "location" TEXT,
    "virginRockTemperatureC" DOUBLE PRECISION,
    "wetBulbLimitC" DOUBLE PRECISION,
    "coolingServed" TEXT,
    "status" "ThermalStationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThermalStressStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThermalStressReading" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "wetBulbC" DOUBLE PRECISION NOT NULL,
    "dryBulbC" DOUBLE PRECISION,
    "airVelocityMs" DOUBLE PRECISION,
    "withinLimit" BOOLEAN NOT NULL DEFAULT true,
    "measuredByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThermalStressReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfRescuerUnit" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "rescuerType" "SelfRescuerType" NOT NULL,
    "manufacturer" TEXT,
    "expiryDate" TIMESTAMP(3),
    "issuedDate" TIMESTAMP(3),
    "issuedToName" TEXT,
    "storageLocation" TEXT,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "status" "SelfRescuerStatus" NOT NULL DEFAULT 'IN_STORE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfRescuerUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscapeRoute" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "routeLengthM" DOUBLE PRECISION,
    "isSecondOutlet" BOOLEAN NOT NULL DEFAULT false,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "lastWalkedDate" TIMESTAMP(3),
    "condition" "EscapeRouteCondition" NOT NULL DEFAULT 'CLEAR',
    "findings" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscapeRoute_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VentilationFan" ADD CONSTRAINT "VentilationFan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentilationFan" ADD CONSTRAINT "VentilationFan_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanSurvey" ADD CONSTRAINT "FanSurvey_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "VentilationFan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanStoppage" ADD CONSTRAINT "FanStoppage_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "VentilationFan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasDetectionInstrument" ADD CONSTRAINT "GasDetectionInstrument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentCalibration" ADD CONSTRAINT "InstrumentCalibration_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "GasDetectionInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThermalStressStation" ADD CONSTRAINT "ThermalStressStation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThermalStressStation" ADD CONSTRAINT "ThermalStressStation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThermalStressReading" ADD CONSTRAINT "ThermalStressReading_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ThermalStressStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfRescuerUnit" ADD CONSTRAINT "SelfRescuerUnit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscapeRoute" ADD CONSTRAINT "EscapeRoute_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
