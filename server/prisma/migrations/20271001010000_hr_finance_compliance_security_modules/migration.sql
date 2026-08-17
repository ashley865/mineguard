-- CreateEnum
CREATE TYPE "SkillProficiency" AS ENUM ('NOVICE', 'COMPETENT', 'PROFICIENT', 'EXPERT');

-- CreateEnum
CREATE TYPE "VettingSubjectType" AS ENUM ('CONTRACTOR', 'VISITOR', 'WORKER', 'OTHER');

-- CreateEnum
CREATE TYPE "VettingCheckType" AS ENUM ('CRIMINAL_RECORD', 'ID_VERIFICATION', 'REFERENCE_CHECK', 'COMPETENCY_VERIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "VettingStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerSkillRating" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" "SkillProficiency" NOT NULL,
    "assessedDate" TIMESTAMP(3),
    "assessedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerSkillRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAcknowledgement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "acknowledgedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VettingRecord" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "subjectType" "VettingSubjectType" NOT NULL,
    "subjectName" TEXT NOT NULL,
    "idNumber" TEXT,
    "checkType" "VettingCheckType" NOT NULL,
    "status" "VettingStatus" NOT NULL DEFAULT 'PENDING',
    "checkedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "conductedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VettingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_mineId_name_key" ON "Skill"("mineId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSkillRating_workerId_skillId_key" ON "WorkerSkillRating"("workerId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAcknowledgement_documentId_workerId_key" ON "DocumentAcknowledgement"("documentId", "workerId");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSkillRating" ADD CONSTRAINT "WorkerSkillRating_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSkillRating" ADD CONSTRAINT "WorkerSkillRating_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSkillRating" ADD CONSTRAINT "WorkerSkillRating_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcknowledgement" ADD CONSTRAINT "DocumentAcknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcknowledgement" ADD CONSTRAINT "DocumentAcknowledgement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcknowledgement" ADD CONSTRAINT "DocumentAcknowledgement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingRecord" ADD CONSTRAINT "VettingRecord_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingRecord" ADD CONSTRAINT "VettingRecord_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

