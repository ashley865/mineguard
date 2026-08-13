-- CreateEnum
CREATE TYPE "GeotechnicalPointType" AS ENUM ('EXTENSOMETER', 'CONVERGENCE_STATION', 'TILTMETER', 'PIEZOMETER', 'OTHER');

-- CreateEnum
CREATE TYPE "GeotechnicalEventType" AS ENUM ('ROCKFALL', 'ROCKBURST');

-- CreateEnum
CREATE TYPE "RefugeBayStatus" AS ENUM ('OPERATIONAL', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "ExposurePollutant" AS ENUM ('DUST_RESPIRABLE', 'DUST_INHALABLE', 'NOISE', 'METHANE', 'CARBON_MONOXIDE', 'DIESEL_PARTICULATE', 'SILICA', 'OTHER');

-- CreateEnum
CREATE TYPE "ExposureSampleType" AS ENUM ('PERSONAL', 'AREA');

-- CreateEnum
CREATE TYPE "RescueTeamRole" AS ENUM ('TEAM_LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "RescueMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BaSetStatus" AS ENUM ('SERVICEABLE', 'OUT_OF_SERVICE', 'DUE_FOR_SERVICE');

-- CreateEnum
CREATE TYPE "RescueDrillResult" AS ENUM ('PASS', 'FAIL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DisciplinaryOutcome" AS ENUM ('PENDING', 'VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING', 'DISMISSAL', 'NOT_GUILTY', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DisciplinaryStatus" AS ENUM ('OPEN', 'SCHEDULED', 'CONCLUDED', 'APPEALED');

-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'ESCALATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CcmaCaseType" AS ENUM ('UNFAIR_DISMISSAL', 'UNFAIR_LABOUR_PRACTICE', 'DISCRIMINATION', 'WAGE_DISPUTE', 'OTHER');

-- CreateEnum
CREATE TYPE "CcmaCaseStatus" AS ENUM ('REFERRED', 'CONCILIATION', 'ARBITRATION', 'SETTLED', 'AWARD_ISSUED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "UnionAgreementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'UNDER_NEGOTIATION');

-- CreateEnum
CREATE TYPE "PollutionDamStatus" AS ENUM ('ACTIVE', 'DECOMMISSIONED');

-- CreateTable
CREATE TABLE "GroundControlDistrict" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "requiredSupportStandard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroundControlDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeotechnicalMonitoringPoint" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "pointType" "GeotechnicalPointType" NOT NULL,
    "locationDescription" TEXT NOT NULL,
    "installedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeotechnicalMonitoringPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeotechnicalReading" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "alertThreshold" DOUBLE PRECISION,
    "exceedsThreshold" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeotechnicalReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeismicEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "locationDescription" TEXT,
    "damageObserved" BOOLEAN NOT NULL DEFAULT false,
    "damageDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeismicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RockfallIncident" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "districtId" TEXT,
    "eventType" "GeotechnicalEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "supportInPlace" TEXT,
    "description" TEXT NOT NULL,
    "reEntryAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "signOffById" TEXT,
    "signOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RockfallIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentilationDistrict" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "requiredAirflowQuantity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'm3/s',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentilationDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentilationReading" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "airflowQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm3/s',
    "withinRequirement" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentilationReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefugeBay" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "capacityPersons" INTEGER NOT NULL,
    "airSupplyDurationHours" DOUBLE PRECISION,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "status" "RefugeBayStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefugeBay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationalExposureRecord" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "pollutant" "ExposurePollutant" NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "sampleType" "ExposureSampleType" NOT NULL DEFAULT 'PERSONAL',
    "measuredValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "occupationalExposureLimit" DOUBLE PRECISION NOT NULL,
    "exceedsLimit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccupationalExposureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueTeamMember" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "role" "RescueTeamRole" NOT NULL DEFAULT 'MEMBER',
    "certificationNumber" TEXT,
    "certificationExpiry" TIMESTAMP(3),
    "status" "RescueMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescueTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreathingApparatusSet" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "setNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDue" TIMESTAMP(3),
    "lastPressureTestDate" TIMESTAMP(3),
    "nextPressureTestDue" TIMESTAMP(3),
    "status" "BaSetStatus" NOT NULL DEFAULT 'SERVICEABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreathingApparatusSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueDrill" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL,
    "scenario" TEXT NOT NULL,
    "result" "RescueDrillResult" NOT NULL DEFAULT 'PASS',
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "conductedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescueDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutualAidAgreement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "partnerOrganization" TEXT NOT NULL,
    "agreementType" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "contactName" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutualAidAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueCallout" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "emergencyEventId" TEXT,
    "calloutTime" TIMESTAMP(3) NOT NULL,
    "teamDispatched" TEXT,
    "responseTimeMinutes" INTEGER,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescueCallout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "chargeDescription" TEXT NOT NULL,
    "hearingDate" TIMESTAMP(3),
    "chairperson" TEXT,
    "outcome" "DisciplinaryOutcome" NOT NULL DEFAULT 'PENDING',
    "sanctionDetails" TEXT,
    "status" "DisciplinaryStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceCase" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "raisedAgainst" TEXT,
    "description" TEXT NOT NULL,
    "dateRaised" TIMESTAMP(3) NOT NULL,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcmaCase" (
    "id" TEXT NOT NULL,
    "workerId" TEXT,
    "referralNumber" TEXT,
    "caseType" "CcmaCaseType" NOT NULL,
    "conciliationDate" TIMESTAMP(3),
    "arbitrationDate" TIMESTAMP(3),
    "outcome" TEXT,
    "status" "CcmaCaseStatus" NOT NULL DEFAULT 'REFERRED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CcmaCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnionAgreement" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "unionName" TEXT NOT NULL,
    "agreementType" TEXT,
    "recognitionThresholdPercent" DOUBLE PRECISION,
    "membershipCount" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "UnionAgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnionAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterBalanceRecord" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "abstractedVolume" DOUBLE PRECISION NOT NULL,
    "dischargedVolume" DOUBLE PRECISION NOT NULL,
    "recycledVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kL',
    "licenseLimit" DOUBLE PRECISION,
    "withinLimit" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterBalanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollutionControlDam" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION,
    "unit" TEXT,
    "currentLevel" DOUBLE PRECISION,
    "status" "PollutionDamStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastInspectionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollutionControlDam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcidMineDrainageReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "monitoringPoint" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "ph" DOUBLE PRECISION NOT NULL,
    "sulfateConcentration" DOUBLE PRECISION,
    "metalConcentration" DOUBLE PRECISION,
    "withinLimits" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcidMineDrainageReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyConsumptionRecord" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "recordMonth" TIMESTAMP(3) NOT NULL,
    "gridConsumptionKwh" DOUBLE PRECISION NOT NULL,
    "renewableConsumptionKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dieselConsumptionLiters" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyConsumptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhgEmissionsRecord" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "scope1TonnesCO2e" DOUBLE PRECISION NOT NULL,
    "scope2TonnesCO2e" DOUBLE PRECISION NOT NULL,
    "carbonTaxLiability" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhgEmissionsRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GroundControlDistrict" ADD CONSTRAINT "GroundControlDistrict_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundControlDistrict" ADD CONSTRAINT "GroundControlDistrict_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeotechnicalMonitoringPoint" ADD CONSTRAINT "GeotechnicalMonitoringPoint_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "GroundControlDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeotechnicalReading" ADD CONSTRAINT "GeotechnicalReading_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "GeotechnicalMonitoringPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeotechnicalReading" ADD CONSTRAINT "GeotechnicalReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeismicEvent" ADD CONSTRAINT "SeismicEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeismicEvent" ADD CONSTRAINT "SeismicEvent_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RockfallIncident" ADD CONSTRAINT "RockfallIncident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RockfallIncident" ADD CONSTRAINT "RockfallIncident_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RockfallIncident" ADD CONSTRAINT "RockfallIncident_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "GroundControlDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RockfallIncident" ADD CONSTRAINT "RockfallIncident_signOffById_fkey" FOREIGN KEY ("signOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentilationDistrict" ADD CONSTRAINT "VentilationDistrict_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentilationDistrict" ADD CONSTRAINT "VentilationDistrict_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentilationReading" ADD CONSTRAINT "VentilationReading_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "VentilationDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefugeBay" ADD CONSTRAINT "RefugeBay_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefugeBay" ADD CONSTRAINT "RefugeBay_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationalExposureRecord" ADD CONSTRAINT "OccupationalExposureRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueTeamMember" ADD CONSTRAINT "RescueTeamMember_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueTeamMember" ADD CONSTRAINT "RescueTeamMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreathingApparatusSet" ADD CONSTRAINT "BreathingApparatusSet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueDrill" ADD CONSTRAINT "RescueDrill_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueDrill" ADD CONSTRAINT "RescueDrill_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutualAidAgreement" ADD CONSTRAINT "MutualAidAgreement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueCallout" ADD CONSTRAINT "RescueCallout_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueCallout" ADD CONSTRAINT "RescueCallout_emergencyEventId_fkey" FOREIGN KEY ("emergencyEventId") REFERENCES "EmergencyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceCase" ADD CONSTRAINT "GrievanceCase_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcmaCase" ADD CONSTRAINT "CcmaCase_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionAgreement" ADD CONSTRAINT "UnionAgreement_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterBalanceRecord" ADD CONSTRAINT "WaterBalanceRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollutionControlDam" ADD CONSTRAINT "PollutionControlDam_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcidMineDrainageReading" ADD CONSTRAINT "AcidMineDrainageReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyConsumptionRecord" ADD CONSTRAINT "EnergyConsumptionRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhgEmissionsRecord" ADD CONSTRAINT "GhgEmissionsRecord_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

