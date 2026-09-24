-- Hardens every public, unauthenticated entry point the portal funnels people into:
-- burst-abuse tracking (PublicSubmissionEvent) and email verification for self-registered
-- buyers/contractors (login is refused until verified; staff-onboarded accounts are
-- verified immediately at creation, so this never affects them).

-- AlterTable
ALTER TABLE "Contractor"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Buyer"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

-- Every account that exists before this migration was created before email verification
-- existed — treat them as already verified rather than retroactively locking out every
-- contractor/buyer who already has a working login.
UPDATE "Contractor" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
UPDATE "Buyer" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- CreateTable
CREATE TABLE "PublicSubmissionEvent" (
    "id" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "mineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicSubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicSubmissionEvent_formType_ip_createdAt_idx" ON "PublicSubmissionEvent"("formType", "ip", "createdAt");
