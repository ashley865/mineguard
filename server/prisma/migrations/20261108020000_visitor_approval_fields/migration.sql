-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- Backfill: every existing visitor was created under the old immediate-check-in
-- flow, so their scheduled time is best represented by when they actually checked in.
UPDATE "Visitor" SET "scheduledFor" = "checkInAt" WHERE "scheduledFor" IS NULL;

-- AlterTable
ALTER TABLE "Visitor" ALTER COLUMN "scheduledFor" SET NOT NULL,
ALTER COLUMN "checkInAt" DROP NOT NULL,
ALTER COLUMN "checkInAt" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
