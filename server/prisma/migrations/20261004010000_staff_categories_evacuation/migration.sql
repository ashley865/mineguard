-- CreateEnum
CREATE TYPE "StaffCategory" AS ENUM ('MINING_OPERATIONS', 'ENGINEERING_TECHNICAL', 'DRIVER', 'CLEANER', 'SECURITY', 'ADMINISTRATION', 'EXECUTIVE', 'MEDICAL', 'SAFETY_HEALTH', 'MAINTENANCE', 'CATERING', 'OTHER');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "category" "StaffCategory" NOT NULL DEFAULT 'OTHER';

-- AlterEnum
ALTER TYPE "EmergencyContactCategory" ADD VALUE 'AMBULANCE';
ALTER TYPE "EmergencyContactCategory" ADD VALUE 'SECURITY';

-- CreateEnum
CREATE TYPE "EvacuationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmergencyEvacuation" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assemblyPoint" TEXT NOT NULL,
    "message" TEXT,
    "status" "EvacuationStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggeredById" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyEvacuation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmergencyEvacuation" ADD CONSTRAINT "EmergencyEvacuation_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvacuation" ADD CONSTRAINT "EmergencyEvacuation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvacuation" ADD CONSTRAINT "EmergencyEvacuation_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvacuation" ADD CONSTRAINT "EmergencyEvacuation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
