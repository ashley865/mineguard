-- CreateEnum
CREATE TYPE "SecurityAssetType" AS ENUM ('RADIO', 'BATON', 'FIREARM', 'ALARM_PANEL', 'BARRIER', 'METAL_DETECTOR', 'BODY_CAMERA', 'TORCH', 'HANDCUFFS', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityAssetCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "SecurityAssetStatus" AS ENUM ('IN_STORE', 'ASSIGNED', 'IN_MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "SecurityAssetEventType" AS ENUM ('ASSIGNED', 'RETURNED', 'SENT_FOR_MAINTENANCE', 'RETURNED_FROM_MAINTENANCE', 'DECOMMISSIONED');

-- CreateTable
CREATE TABLE "SecurityAsset" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "type" "SecurityAssetType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "serialNumber" TEXT,
    "condition" "SecurityAssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "SecurityAssetStatus" NOT NULL DEFAULT 'IN_STORE',
    "assignedWorkerId" TEXT,
    "lastMaintenanceAt" TIMESTAMP(3),
    "nextMaintenanceDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAssetAssignmentLog" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "eventType" "SecurityAssetEventType" NOT NULL,
    "workerId" TEXT,
    "notes" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAssetAssignmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAsset_siteId_assetTag_key" ON "SecurityAsset"("siteId", "assetTag");

-- AddForeignKey
ALTER TABLE "SecurityAsset" ADD CONSTRAINT "SecurityAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAsset" ADD CONSTRAINT "SecurityAsset_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAsset" ADD CONSTRAINT "SecurityAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAssetAssignmentLog" ADD CONSTRAINT "SecurityAssetAssignmentLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SecurityAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAssetAssignmentLog" ADD CONSTRAINT "SecurityAssetAssignmentLog_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAssetAssignmentLog" ADD CONSTRAINT "SecurityAssetAssignmentLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

