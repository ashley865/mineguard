-- CreateEnum
CREATE TYPE "CopCategory" AS ENUM ('ROCK_ENGINEERING', 'VENTILATION', 'EXPLOSIVES', 'FALL_OF_GROUND', 'TRACKLESS_MOBILE_MACHINERY', 'WINDING_PLANT', 'ELECTRICAL', 'OCCUPATIONAL_HEALTH', 'EMERGENCY_PREPAREDNESS', 'OTHER');

-- CreateEnum
CREATE TYPE "CopStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskAssessmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'UNDER_REVIEW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NoticeSection" AS ENUM ('SECTION_54', 'SECTION_55', 'SECTION_53', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('OPEN', 'COMPLIED', 'WITHDRAWN', 'APPEALED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('PRE_EMPLOYMENT', 'PERIODICAL', 'EXIT', 'RETURN_TO_WORK');

-- CreateEnum
CREATE TYPE "FitnessResult" AS ENUM ('FIT', 'FIT_WITH_RESTRICTION', 'TEMPORARILY_UNFIT', 'UNFIT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'OVERDUE');

-- CreateTable
CREATE TABLE "CodeOfPractice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "CopCategory" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "CopStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "description" TEXT,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeOfPractice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "initialRiskLevel" "RiskLevel" NOT NULL,
    "residualRiskLevel" "RiskLevel" NOT NULL,
    "controlMeasures" TEXT NOT NULL,
    "assessor" TEXT NOT NULL,
    "status" "RiskAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryNotice" (
    "id" TEXT NOT NULL,
    "noticeNumber" TEXT NOT NULL,
    "section" "NoticeSection" NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "complianceDeadline" TIMESTAMP(3),
    "status" "NoticeStatus" NOT NULL DEFAULT 'OPEN',
    "compliedDate" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalSurveillance" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "result" "FitnessResult" NOT NULL,
    "restrictions" TEXT,
    "nextExamDue" TIMESTAMP(3) NOT NULL,
    "practitioner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalSurveillance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "inspector" TEXT NOT NULL,
    "findings" TEXT,
    "correctiveActions" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyInspection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CodeOfPractice" ADD CONSTRAINT "CodeOfPractice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeOfPractice" ADD CONSTRAINT "CodeOfPractice_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryNotice" ADD CONSTRAINT "RegulatoryNotice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryNotice" ADD CONSTRAINT "RegulatoryNotice_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalSurveillance" ADD CONSTRAINT "MedicalSurveillance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyInspection" ADD CONSTRAINT "SafetyInspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyInspection" ADD CONSTRAINT "SafetyInspection_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
