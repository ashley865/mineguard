-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('GEOTECHNICAL_ROCKFALL', 'ELECTRICAL', 'FIRE_EXPLOSION', 'CHEMICAL_SPILL', 'MACHINERY_EQUIPMENT', 'VENTILATION_AIR_QUALITY', 'DUST_NOISE', 'SLIP_TRIP_FALL', 'WORKING_AT_HEIGHT', 'CONFINED_SPACE', 'VEHICLE_TRAFFIC', 'STRUCTURAL', 'ERGONOMIC', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED', 'OVERDUE');

-- CreateTable
CREATE TABLE "HazardReport" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "hazardType" "HazardType" NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedById" TEXT,
    "riskLevel" "RiskLevel" NOT NULL,
    "immediateAction" TEXT,
    "responsiblePersonId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "HazardStatus" NOT NULL DEFAULT 'OPEN',
    "closureEvidence" TEXT,
    "closedById" TEXT,
    "closureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardMedia" (
    "id" TEXT NOT NULL,
    "hazardReportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardMedia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardMedia" ADD CONSTRAINT "HazardMedia_hazardReportId_fkey" FOREIGN KEY ("hazardReportId") REFERENCES "HazardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
