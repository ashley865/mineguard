-- CreateEnum
CREATE TYPE "ConsumablePartType" AS ENUM ('TYRE', 'GET_BUCKET_TOOTH', 'GET_CUTTING_EDGE', 'GET_BLADE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsumablePartStatus" AS ENUM ('IN_SERVICE', 'REMOVED', 'SCRAPPED');

-- CreateTable
CREATE TABLE "EquipmentConsumablePart" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "partType" "ConsumablePartType" NOT NULL,
    "position" TEXT,
    "brand" TEXT,
    "serialOrPartNumber" TEXT,
    "installDate" TIMESTAMP(3),
    "installHoursMeter" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "initialMeasurement" DOUBLE PRECISION,
    "currentMeasurement" DOUBLE PRECISION,
    "measurementUnit" TEXT,
    "status" "ConsumablePartStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "removedDate" TIMESTAMP(3),
    "removalReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentConsumablePart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EquipmentConsumablePart" ADD CONSTRAINT "EquipmentConsumablePart_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
