-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "nextOfKinName" TEXT,
ADD COLUMN     "nextOfKinRelationship" TEXT,
ADD COLUMN     "nextOfKinPhone" TEXT;

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('MINE_MANAGER', 'MINE_OVERSEER', 'SHIFT_SUPERVISOR', 'BLASTING', 'ROCK_BREAKER', 'WINDING_ENGINE_DRIVER', 'ELECTRICAL', 'MECHANICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issuingBody" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('INDUCTION', 'REFRESHER', 'FIRST_AID', 'FIRE_FIGHTING', 'SELF_RESCUE', 'HAZARD_SPECIFIC', 'SKILLS_DEVELOPMENT', 'OTHER');

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "trainingType" "TrainingType" NOT NULL,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
