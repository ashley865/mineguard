-- CreateEnum
CREATE TYPE "PatrolObservationCategory" AS ENUM ('SAFETY_HAZARD', 'SUSPICIOUS_ACTIVITY', 'SECURITY_CONCERN', 'MAINTENANCE_ISSUE', 'GENERAL_OBSERVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterTable
ALTER TABLE "PatrolLogEntry" ADD COLUMN     "category" "PatrolObservationCategory",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "workerId" TEXT,
ALTER COLUMN "assignmentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "mineId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changedById" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_mineId_createdAt_idx" ON "AuditLog"("mineId", "createdAt");

-- AddForeignKey
ALTER TABLE "PatrolLogEntry" ADD CONSTRAINT "PatrolLogEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolLogEntry" ADD CONSTRAINT "PatrolLogEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

