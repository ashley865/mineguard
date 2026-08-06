-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('FIXED', 'PTZ', 'DOME', 'THERMAL', 'BODY_WORN', 'DRONE', 'OTHER');

-- CreateEnum
CREATE TYPE "CameraOperationalStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "VmsIntegrationMethod" AS ENUM ('ONVIF', 'RTSP_STREAM', 'VENDOR_API', 'NVR_EXPORT', 'NOT_INTEGRATED');

-- CreateEnum
CREATE TYPE "VmsIntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'PENDING', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "SecurityCamera" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cameraType" "CameraType" NOT NULL DEFAULT 'FIXED',
    "status" "CameraOperationalStatus" NOT NULL DEFAULT 'ONLINE',
    "coverageDescription" TEXT,
    "vmsProvider" TEXT,
    "integrationMethod" "VmsIntegrationMethod" NOT NULL DEFAULT 'NOT_INTEGRATED',
    "integrationStatus" "VmsIntegrationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "streamUrl" TEXT,
    "retentionDays" INTEGER,
    "installedDate" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityCamera_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SecurityCamera" ADD CONSTRAINT "SecurityCamera_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityCamera" ADD CONSTRAINT "SecurityCamera_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityCamera" ADD CONSTRAINT "SecurityCamera_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
