-- CreateEnum
CREATE TYPE "FatigueTestResult" AS ENUM ('PASS', 'BORDERLINE', 'FAIL');

-- CreateEnum
CREATE TYPE "FatigueAssessmentOutcome" AS ENUM ('CLEARED', 'RESTRICTED_DUTY', 'STOOD_DOWN');

-- CreateTable
CREATE TABLE "FatigueAssessment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hoursWorkedLast24h" DOUBLE PRECISION,
    "hoursRestLast24h" DOUBLE PRECISION,
    "consecutiveShifts" INTEGER,
    "testResult" "FatigueTestResult" NOT NULL,
    "outcome" "FatigueAssessmentOutcome" NOT NULL DEFAULT 'CLEARED',
    "assessedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FatigueAssessment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FatigueAssessment" ADD CONSTRAINT "FatigueAssessment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
