-- CreateEnum
CREATE TYPE "LiftingEquipmentType" AS ENUM ('OVERHEAD_CRANE', 'MOBILE_CRANE', 'GANTRY', 'CHAIN_BLOCK', 'LEVER_HOIST', 'WINCH', 'WIRE_ROPE_SLING', 'CHAIN_SLING', 'WEBBING_SLING', 'SHACKLE', 'EYEBOLT', 'SPREADER_BEAM', 'LIFTING_MAGNET', 'OTHER');

-- CreateEnum
CREATE TYPE "LiftingEquipmentStatus" AS ENUM ('IN_SERVICE', 'QUARANTINED', 'UNDER_REPAIR', 'CONDEMNED');

-- CreateEnum
CREATE TYPE "LiftingInspectionType" AS ENUM ('VISUAL', 'THOROUGH_EXAMINATION', 'LOAD_TEST');

-- CreateEnum
CREATE TYPE "LiftingInspectionResult" AS ENUM ('PASS', 'PASS_WITH_DEFECTS', 'FAIL');

-- CreateEnum
CREATE TYPE "PressureEquipmentType" AS ENUM ('AIR_RECEIVER', 'BOILER', 'PRESSURE_VESSEL', 'AUTOCLAVE', 'ACCUMULATOR', 'STEAM_PIPING', 'OTHER');

-- CreateEnum
CREATE TYPE "PressureEquipmentStatus" AS ENUM ('IN_SERVICE', 'AWAITING_INSPECTION', 'OUT_OF_SERVICE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "PressureInspectionType" AS ENUM ('EXTERNAL', 'INTERNAL', 'HYDROSTATIC', 'SAFETY_VALVE', 'ULTRASONIC_THICKNESS');

-- CreateEnum
CREATE TYPE "ElectricalInstallationType" AS ENUM ('SUBSTATION', 'TRANSFORMER', 'SWITCHGEAR', 'DISTRIBUTION_BOARD', 'MOTOR_CONTROL_CENTRE', 'CABLE_RETICULATION', 'EARTH_LEAKAGE_UNIT', 'GENERATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ExProtectionType" AS ENUM ('NONE', 'FLAMEPROOF_D', 'INCREASED_SAFETY_E', 'INTRINSICALLY_SAFE_I', 'PRESSURIZED_P', 'ENCAPSULATION_M', 'NON_SPARKING_N', 'DUST_PROTECTION_T', 'OTHER');

-- CreateEnum
CREATE TYPE "ElectricalTestType" AS ENUM ('EARTH_CONTINUITY', 'EARTH_LEAKAGE', 'INSULATION_RESISTANCE', 'POLARITY', 'EX_INSPECTION', 'THERMOGRAPHIC');

-- CreateEnum
CREATE TYPE "ElectricalTestResult" AS ENUM ('PASS', 'MARGINAL', 'FAIL');

-- CreateEnum
CREATE TYPE "ElectricalInstallationStatus" AS ENUM ('IN_SERVICE', 'ISOLATED', 'UNDER_REPAIR', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "EquipmentFailureMode" AS ENUM ('MECHANICAL_WEAR', 'BEARING_FAILURE', 'LUBRICATION_FAILURE', 'ELECTRICAL_FAULT', 'HYDRAULIC_FAILURE', 'PNEUMATIC_FAILURE', 'STRUCTURAL_CRACK', 'CONTROL_SYSTEM', 'CONTAMINATION', 'OVERLOAD', 'CORROSION', 'OPERATOR_ERROR', 'OTHER');

-- CreateTable
CREATE TABLE "LiftingEquipment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "equipmentType" "LiftingEquipmentType" NOT NULL,
    "description" TEXT,
    "safeWorkingLoadKg" DOUBLE PRECISION,
    "location" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "colourCode" TEXT,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "lastLoadTestDate" TIMESTAMP(3),
    "nextLoadTestDue" TIMESTAMP(3),
    "status" "LiftingEquipmentStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftingEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftingInspection" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectionType" "LiftingInspectionType" NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "result" "LiftingInspectionResult" NOT NULL,
    "defectsFound" TEXT,
    "loadTestedKg" DOUBLE PRECISION,
    "certificateNumber" TEXT,
    "colourCodeApplied" TEXT,
    "nextInspectionDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiftingInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureEquipment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "equipmentType" "PressureEquipmentType" NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "designPressureKpa" DOUBLE PRECISION,
    "operatingPressureKpa" DOUBLE PRECISION,
    "capacityLitres" DOUBLE PRECISION,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "yearBuilt" INTEGER,
    "inspectionAuthority" TEXT,
    "certificateNumber" TEXT,
    "certificateExpiry" TIMESTAMP(3),
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "safetyValveLastTested" TIMESTAMP(3),
    "safetyValveNextDue" TIMESTAMP(3),
    "status" "PressureEquipmentStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressureEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureEquipmentInspection" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectionType" "PressureInspectionType" NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "inspectionAuthority" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "findings" TEXT,
    "certificateNumber" TEXT,
    "certificateExpiry" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PressureEquipmentInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricalInstallation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "identifier" TEXT NOT NULL,
    "installationType" "ElectricalInstallationType" NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "voltageRating" TEXT,
    "hazardousArea" BOOLEAN NOT NULL DEFAULT false,
    "exProtection" "ExProtectionType" NOT NULL DEFAULT 'NONE',
    "exCertificateNumber" TEXT,
    "exCertificateExpiry" TIMESTAMP(3),
    "earthLeakageProtected" BOOLEAN NOT NULL DEFAULT false,
    "cocNumber" TEXT,
    "cocIssuedDate" TIMESTAMP(3),
    "lastTestDate" TIMESTAMP(3),
    "nextTestDue" TIMESTAMP(3),
    "status" "ElectricalInstallationStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectricalInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricalTest" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "testType" "ElectricalTestType" NOT NULL,
    "testedByName" TEXT NOT NULL,
    "result" "ElectricalTestResult" NOT NULL,
    "measuredValue" DOUBLE PRECISION,
    "unit" TEXT,
    "findings" TEXT,
    "nextTestDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectricalTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetReliabilityProfile" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
    "criticalityRationale" TEXT,
    "commissionedDate" TIMESTAMP(3),
    "expectedLifeYears" INTEGER,
    "replacementValue" DOUBLE PRECISION,
    "currentRunHours" DOUBLE PRECISION,
    "runHoursUpdatedAt" TIMESTAMP(3),
    "targetAvailabilityPct" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetReliabilityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentFailure" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "failureDate" TIMESTAMP(3) NOT NULL,
    "failureMode" "EquipmentFailureMode" NOT NULL,
    "description" TEXT NOT NULL,
    "detectedBy" TEXT,
    "downtimeHours" DOUBLE PRECISION,
    "repairCost" DOUBLE PRECISION,
    "runHoursAtFailure" DOUBLE PRECISION,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "recurrencePrevented" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetReliabilityProfile_equipmentId_key" ON "AssetReliabilityProfile"("equipmentId");

-- AddForeignKey
ALTER TABLE "LiftingEquipment" ADD CONSTRAINT "LiftingEquipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftingInspection" ADD CONSTRAINT "LiftingInspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "LiftingEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureEquipment" ADD CONSTRAINT "PressureEquipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureEquipmentInspection" ADD CONSTRAINT "PressureEquipmentInspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "PressureEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricalInstallation" ADD CONSTRAINT "ElectricalInstallation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricalInstallation" ADD CONSTRAINT "ElectricalInstallation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricalTest" ADD CONSTRAINT "ElectricalTest_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ElectricalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReliabilityProfile" ADD CONSTRAINT "AssetReliabilityProfile_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFailure" ADD CONSTRAINT "EquipmentFailure_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
