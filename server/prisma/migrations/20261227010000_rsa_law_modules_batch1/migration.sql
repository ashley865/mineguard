-- CreateEnum
CREATE TYPE "OccupationalDiseaseClassification" AS ENUM ('NONE', 'SILICOSIS', 'TUBERCULOSIS', 'NOISE_INDUCED_HEARING_LOSS', 'PNEUMOCONIOSIS_OTHER', 'OTHER');

-- CreateEnum
CREATE TYPE "StatutoryAppointmentType" AS ENUM ('MINE_MANAGER', 'MINE_OVERSEER', 'ENGINEER', 'SURVEYOR', 'VENTILATION_OFFICER', 'HEALTH_SAFETY_OFFICER', 'BLASTING_OFFICER', 'ROCK_ENGINEER', 'ELECTRICAL_ENGINEER', 'MECHANICAL_ENGINEER', 'ASSISTANT_MANAGER', 'ENVIRONMENTAL_CONTROL_OFFICER', 'OCCUPATIONAL_HYGIENIST', 'OTHER');

-- CreateEnum
CREATE TYPE "StatutoryAppointmentStatus" AS ENUM ('ACTIVE', 'VACANT', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IodClaimStatus" AS ENUM ('REPORTED', 'SUBMITTED', 'UNDER_ASSESSMENT', 'ACCEPTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BlastLogStatus" AS ENUM ('PLANNED', 'FIRED', 'MISFIRE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DamStructuralRating" AS ENUM ('SATISFACTORY', 'FAIR', 'POOR', 'UNSATISFACTORY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RehabilitationStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "OccupationalLevel" AS ENUM ('TOP_MANAGEMENT', 'SENIOR_MANAGEMENT', 'PROFESSIONALLY_QUALIFIED', 'SKILLED_TECHNICAL', 'SEMI_SKILLED', 'UNSKILLED');

-- CreateEnum
CREATE TYPE "DesignatedGroup" AS ENUM ('AFRICAN', 'COLOURED', 'INDIAN', 'WHITE', 'FOREIGN_NATIONAL');

-- CreateEnum
CREATE TYPE "LearnershipStatus" AS ENUM ('APPLIED', 'ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LegalComplianceCategory" AS ENUM ('MINING_RIGHT', 'ENVIRONMENTAL', 'WATER_USE', 'LABOUR', 'HEALTH_SAFETY', 'TAX_LEVY', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalComplianceItemStatus" AS ENUM ('UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED');

-- AlterTable
ALTER TABLE "MedicalSurveillance" ADD COLUMN     "chestXrayResult" TEXT,
ADD COLUMN     "diseaseClassification" "OccupationalDiseaseClassification" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "dustExposed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lungFunctionResult" TEXT,
ADD COLUMN     "mbodReferenceNumber" TEXT,
ADD COLUMN     "submittedToMbod" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submittedToMbodAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StatutoryAppointment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "appointmentType" "StatutoryAppointmentType" NOT NULL,
    "customTitle" TEXT,
    "legislativeReference" TEXT,
    "workerId" TEXT,
    "appointeeName" TEXT NOT NULL,
    "certificateId" TEXT,
    "appointedDate" TIMESTAMP(3) NOT NULL,
    "status" "StatutoryAppointmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopeOfAppointment" TEXT,
    "notes" TEXT,
    "letterFileName" TEXT,
    "letterFileMimeType" TEXT,
    "letterFileSize" INTEGER,
    "letterFileData" BYTEA,
    "appointedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutoryAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IodClaim" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "workerId" TEXT NOT NULL,
    "claimNumber" TEXT,
    "dateOfInjury" TIMESTAMP(3) NOT NULL,
    "natureOfInjury" TEXT NOT NULL,
    "wclForm2Filed" BOOLEAN NOT NULL DEFAULT false,
    "wclForm2FiledAt" TIMESTAMP(3),
    "firstMedicalReport" TEXT,
    "finalMedicalReport" TEXT,
    "status" "IodClaimStatus" NOT NULL DEFAULT 'REPORTED',
    "compensationAmount" DOUBLE PRECISION,
    "payoutDate" TIMESTAMP(3),
    "notes" TEXT,
    "reportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IodClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlastLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "magazineId" TEXT,
    "shotFirerId" TEXT,
    "blastDate" TIMESTAMP(3) NOT NULL,
    "explosiveType" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "numberOfHoles" INTEGER,
    "misfireOccurred" BOOLEAN NOT NULL DEFAULT false,
    "misfireResolution" TEXT,
    "clearanceGivenById" TEXT,
    "clearanceTime" TIMESTAMP(3),
    "sapsNotified" BOOLEAN NOT NULL DEFAULT false,
    "status" "BlastLogStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlastLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailingsFacility" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facilityType" TEXT,
    "designCapacity" DOUBLE PRECISION,
    "unit" TEXT,
    "engineerOfRecord" TEXT,
    "gistmClassification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TailingsFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailingsInspection" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspector" TEXT NOT NULL,
    "freeboardMeters" DOUBLE PRECISION,
    "seepageObserved" BOOLEAN NOT NULL DEFAULT false,
    "seepageDescription" TEXT,
    "structuralRating" "DamStructuralRating" NOT NULL DEFAULT 'UNKNOWN',
    "findings" TEXT,
    "correctiveActions" TEXT,
    "engineerSignOff" BOOLEAN NOT NULL DEFAULT false,
    "engineerSignOffName" TEXT,
    "engineerSignOffDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TailingsInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureRehabilitationPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "planReferenceNumber" TEXT,
    "financialProvisionAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "guaranteeInstrument" TEXT,
    "lastAssessmentDate" TIMESTAMP(3),
    "nextAssessmentDue" TIMESTAMP(3),
    "targetClosureDate" TIMESTAMP(3),
    "status" "RehabilitationStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureRehabilitationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureRehabilitationProgress" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hectaresRehabilitated" DOUBLE PRECISION,
    "percentComplete" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureRehabilitationProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentEquityTarget" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "occupationalLevel" "OccupationalLevel" NOT NULL,
    "designatedGroup" "DesignatedGroup" NOT NULL,
    "gender" TEXT NOT NULL,
    "targetPercent" DOUBLE PRECISION NOT NULL,
    "actualHeadcount" INTEGER NOT NULL DEFAULT 0,
    "totalHeadcountAtLevel" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentEquityTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiningCharterElement" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "elementName" TEXT NOT NULL,
    "targetPercent" DOUBLE PRECISION,
    "actualPercent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiningCharterElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkplaceSkillsPlan" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "setaName" TEXT NOT NULL DEFAULT 'MQA',
    "submittedDate" TIMESTAMP(3),
    "levyPayable" DOUBLE PRECISION,
    "levyGrantClaimed" DOUBLE PRECISION,
    "atrSubmittedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkplaceSkillsPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learnership" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "workerId" TEXT,
    "learnerName" TEXT NOT NULL,
    "programme" TEXT NOT NULL,
    "provider" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "LearnershipStatus" NOT NULL DEFAULT 'APPLIED',
    "fundingSource" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Learnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleEndDate" TIMESTAMP(3) NOT NULL,
    "entitlementDays" DOUBLE PRECISION NOT NULL,
    "carriedOverDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalComplianceItem" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "siteId" TEXT,
    "category" "LegalComplianceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "legislativeReference" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "status" "LegalComplianceItemStatus" NOT NULL DEFAULT 'UPCOMING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalComplianceItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StatutoryAppointment" ADD CONSTRAINT "StatutoryAppointment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryAppointment" ADD CONSTRAINT "StatutoryAppointment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryAppointment" ADD CONSTRAINT "StatutoryAppointment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryAppointment" ADD CONSTRAINT "StatutoryAppointment_appointedById_fkey" FOREIGN KEY ("appointedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IodClaim" ADD CONSTRAINT "IodClaim_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IodClaim" ADD CONSTRAINT "IodClaim_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IodClaim" ADD CONSTRAINT "IodClaim_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastLog" ADD CONSTRAINT "BlastLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastLog" ADD CONSTRAINT "BlastLog_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastLog" ADD CONSTRAINT "BlastLog_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "ExplosivesMagazine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastLog" ADD CONSTRAINT "BlastLog_shotFirerId_fkey" FOREIGN KEY ("shotFirerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlastLog" ADD CONSTRAINT "BlastLog_clearanceGivenById_fkey" FOREIGN KEY ("clearanceGivenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailingsFacility" ADD CONSTRAINT "TailingsFacility_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailingsInspection" ADD CONSTRAINT "TailingsInspection_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "TailingsFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureRehabilitationPlan" ADD CONSTRAINT "ClosureRehabilitationPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureRehabilitationProgress" ADD CONSTRAINT "ClosureRehabilitationProgress_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ClosureRehabilitationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureRehabilitationProgress" ADD CONSTRAINT "ClosureRehabilitationProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentEquityTarget" ADD CONSTRAINT "EmploymentEquityTarget_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningCharterElement" ADD CONSTRAINT "MiningCharterElement_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkplaceSkillsPlan" ADD CONSTRAINT "WorkplaceSkillsPlan_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learnership" ADD CONSTRAINT "Learnership_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learnership" ADD CONSTRAINT "Learnership_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learnership" ADD CONSTRAINT "Learnership_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalComplianceItem" ADD CONSTRAINT "LegalComplianceItem_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalComplianceItem" ADD CONSTRAINT "LegalComplianceItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalComplianceItem" ADD CONSTRAINT "LegalComplianceItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

