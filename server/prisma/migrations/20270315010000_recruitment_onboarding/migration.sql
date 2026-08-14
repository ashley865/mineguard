-- CreateEnum
CREATE TYPE "JobRequisitionStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('REFERRAL', 'AGENCY', 'WALK_IN', 'ONLINE_APPLICATION', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "JobRequisition" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "category" "StaffCategory" NOT NULL DEFAULT 'OTHER',
    "numberOfPositions" INTEGER NOT NULL DEFAULT 1,
    "justification" TEXT,
    "status" "JobRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "targetFillDate" TIMESTAMP(3),
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "idNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'OTHER',
    "stage" "CandidateStage" NOT NULL DEFAULT 'APPLIED',
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewDate" TIMESTAMP(3),
    "interviewNotes" TEXT,
    "offerAmount" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "resumeFileName" TEXT,
    "resumeMimeType" TEXT,
    "resumeFileSize" INTEGER,
    "resumeFileData" BYTEA,
    "hiredWorkerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "inductionCompleted" BOOLEAN NOT NULL DEFAULT false,
    "inductionDate" TIMESTAMP(3),
    "medicalCompleted" BOOLEAN NOT NULL DEFAULT false,
    "medicalDate" TIMESTAMP(3),
    "ppeIssued" BOOLEAN NOT NULL DEFAULT false,
    "ppeIssuedDate" TIMESTAMP(3),
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "contractSignedDate" TIMESTAMP(3),
    "bankDetailsCollected" BOOLEAN NOT NULL DEFAULT false,
    "statutoryFormsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "systemAccessGranted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_hiredWorkerId_key" ON "Candidate"("hiredWorkerId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklist_workerId_key" ON "OnboardingChecklist"("workerId");

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "JobRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_hiredWorkerId_fkey" FOREIGN KEY ("hiredWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

