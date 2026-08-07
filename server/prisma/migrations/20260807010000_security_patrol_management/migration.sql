-- CreateEnum
CREATE TYPE "PatrolAssignmentStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED');

-- CreateTable
CREATE TABLE "PatrolRoute" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolCheckpoint" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolAssignment" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "status" "PatrolAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolLogEntry" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "checkpointId" TEXT,
    "photoData" BYTEA,
    "photoMimeType" TEXT,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatrolCheckpoint_routeId_sequence_key" ON "PatrolCheckpoint"("routeId", "sequence");

-- AddForeignKey
ALTER TABLE "PatrolRoute" ADD CONSTRAINT "PatrolRoute_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRoute" ADD CONSTRAINT "PatrolRoute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "PatrolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolAssignment" ADD CONSTRAINT "PatrolAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "PatrolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolAssignment" ADD CONSTRAINT "PatrolAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolAssignment" ADD CONSTRAINT "PatrolAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolAssignment" ADD CONSTRAINT "PatrolAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolLogEntry" ADD CONSTRAINT "PatrolLogEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PatrolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolLogEntry" ADD CONSTRAINT "PatrolLogEntry_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "PatrolCheckpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: attribute guard-triggered evacuations (from the public patrol duty portal)
-- to the Worker rather than a logged-in User
ALTER TABLE "EmergencyEvacuation" ADD COLUMN     "triggeredByWorkerId" TEXT;

-- AddForeignKey
ALTER TABLE "EmergencyEvacuation" ADD CONSTRAINT "EmergencyEvacuation_triggeredByWorkerId_fkey" FOREIGN KEY ("triggeredByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
