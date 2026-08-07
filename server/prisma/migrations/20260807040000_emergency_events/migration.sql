-- CreateEnum
CREATE TYPE "EmergencyEventType" AS ENUM ('FIRE', 'GROUND_INSTABILITY', 'EXPLOSION', 'FLOODING', 'GAS_EVENT', 'SERIOUS_INJURY', 'VEHICLE_INCIDENT', 'EVACUATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyEventStatus" AS ENUM ('ACTIVE', 'RESPONDING', 'CONTAINED', 'RESOLVED');

-- CreateTable
CREATE TABLE "EmergencyEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "eventType" "EmergencyEventType" NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "peopleAffectedCount" INTEGER,
    "peopleAffectedDetails" TEXT,
    "response" TEXT,
    "evacuationId" TEXT,
    "status" "EmergencyEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "reportedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyEvent_evacuationId_key" ON "EmergencyEvent"("evacuationId");

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_evacuationId_fkey" FOREIGN KEY ("evacuationId") REFERENCES "EmergencyEvacuation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
