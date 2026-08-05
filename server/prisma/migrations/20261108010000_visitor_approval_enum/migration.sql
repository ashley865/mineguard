-- AlterEnum
-- Split into its own migration: a new enum value cannot be referenced (e.g. as a
-- column default) within the same transaction it was added in.
ALTER TYPE "VisitorStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "VisitorStatus" ADD VALUE 'APPROVED';
