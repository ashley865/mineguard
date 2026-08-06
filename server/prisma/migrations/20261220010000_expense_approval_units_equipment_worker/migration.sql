-- AlterTable: Expense approval workflow
ALTER TABLE "Expense" ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "OreGradeUnit" AS ENUM ('PERCENT', 'GRAMS_PER_TONNE', 'OUNCES_PER_TONNE', 'CARATS_PER_TONNE', 'PARTS_PER_MILLION');

-- AlterTable
ALTER TABLE "ProductionRecord" ADD COLUMN     "oreGradeUnit" "OreGradeUnit";

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('KILOGRAMS', 'TONNES', 'LITRES', 'METERS', 'PIECES', 'BOXES', 'PAIRS', 'ROLLS', 'DRUMS', 'BAGS', 'SETS', 'OTHER');

-- AlterTable
-- unit was free text; there is no reliable mapping from arbitrary strings to the new
-- fixed unit list, so existing values are dropped and items fall back to 'OTHER' until
-- re-tagged from the new dropdown.
ALTER TABLE "InventoryItem" DROP COLUMN "unit",
ADD COLUMN     "unit" "InventoryUnit" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "InventoryItem" ALTER COLUMN "unit" DROP DEFAULT;

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('EXCAVATOR', 'HAUL_TRUCK', 'DRILL_RIG', 'LOADER', 'DOZER', 'GRADER', 'CRUSHER', 'CONVEYOR', 'GENERATOR', 'PUMP', 'VENTILATION_FAN', 'COMPRESSOR', 'WINCH', 'CRANE', 'OTHER');

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "type",
ADD COLUMN     "type" "EquipmentType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "assignedOperatorId" TEXT;
ALTER TABLE "Equipment" ALTER COLUMN "type" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: repoint maintenance technician assignment from User to Worker
ALTER TABLE "MaintenanceSchedule" DROP CONSTRAINT "MaintenanceSchedule_assignedToId_fkey";
-- Existing assignedToId values reference User rows, which are not valid Worker ids.
UPDATE "MaintenanceSchedule" SET "assignedToId" = NULL WHERE "assignedToId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: account ban support
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
