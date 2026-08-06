-- AlterEnum
ALTER TYPE "MaintenanceType" ADD VALUE 'PLANNED';
ALTER TYPE "MaintenanceType" ADD VALUE 'EMERGENCY';

-- AlterTable
-- performedBy was free text; replaced with a proper technician (User) assignment.
-- Existing free-text values are dropped rather than guessed at.
ALTER TABLE "MaintenanceSchedule" DROP COLUMN "performedBy",
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "downtimeMinutes" DOUBLE PRECISION,
ADD COLUMN     "downtimeReason" TEXT;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MaintenancePartUsed" (
    "id" TEXT NOT NULL,
    "maintenanceScheduleId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePartUsed_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaintenancePartUsed" ADD CONSTRAINT "MaintenancePartUsed_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePartUsed" ADD CONSTRAINT "MaintenancePartUsed_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
