-- AlterTable: add mineId as nullable first so existing rows are not rejected
ALTER TABLE "Site" ADD COLUMN "mineId" TEXT;

-- Backfill: every existing site is assigned to the earliest-registered mine.
-- This deployment has only ever had a single mine in production, so this is a
-- safe, complete backfill rather than a guess. If more than one mine already
-- existed with real sites, this UPDATE would leave those sites misassigned —
-- there is no way to recover the original mapping since it was never stored,
-- so that scenario must be corrected manually before this migration runs.
UPDATE "Site" SET "mineId" = (SELECT "id" FROM "Mine" ORDER BY "createdAt" ASC LIMIT 1) WHERE "mineId" IS NULL;

-- AlterTable: now that every row has a value, enforce it going forward.
-- If this fails, it means a Site had no Mine to backfill from (e.g. sites
-- exist but zero mines do) and needs manual intervention before retrying.
ALTER TABLE "Site" ALTER COLUMN "mineId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document, EmergencyContact, and TrainingCourse can be "company-wide" (siteId
-- nullable), so they need mineId of their own rather than relying entirely on
-- their optional Site relation, or a company-wide row would have no tenant
-- boundary at all.

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "mineId" TEXT;
UPDATE "Document" d SET "mineId" = COALESCE(
  (SELECT s."mineId" FROM "Site" s WHERE s."id" = d."siteId"),
  (SELECT "id" FROM "Mine" ORDER BY "createdAt" ASC LIMIT 1)
) WHERE d."mineId" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "mineId" SET NOT NULL;
ALTER TABLE "Document" ADD CONSTRAINT "Document_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "EmergencyContact" ADD COLUMN "mineId" TEXT;
UPDATE "EmergencyContact" e SET "mineId" = COALESCE(
  (SELECT s."mineId" FROM "Site" s WHERE s."id" = e."siteId"),
  (SELECT "id" FROM "Mine" ORDER BY "createdAt" ASC LIMIT 1)
) WHERE e."mineId" IS NULL;
ALTER TABLE "EmergencyContact" ALTER COLUMN "mineId" SET NOT NULL;
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN "mineId" TEXT;
UPDATE "TrainingCourse" t SET "mineId" = COALESCE(
  (SELECT s."mineId" FROM "Site" s WHERE s."id" = t."siteId"),
  (SELECT "id" FROM "Mine" ORDER BY "createdAt" ASC LIMIT 1)
) WHERE t."mineId" IS NULL;
ALTER TABLE "TrainingCourse" ALTER COLUMN "mineId" SET NOT NULL;
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payee has no Site relation at all (a payee isn't tied to one site), so it
-- needs mineId directly too, or the payees registry added this same session
-- would have been globally visible/payable across every mine.

-- AlterTable
ALTER TABLE "Payee" ADD COLUMN "mineId" TEXT;
UPDATE "Payee" SET "mineId" = (SELECT "id" FROM "Mine" ORDER BY "createdAt" ASC LIMIT 1) WHERE "mineId" IS NULL;
ALTER TABLE "Payee" ALTER COLUMN "mineId" SET NOT NULL;
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
