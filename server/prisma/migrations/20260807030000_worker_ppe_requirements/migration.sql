-- CreateEnum
CREATE TYPE "PpeType" AS ENUM ('HARD_HAT', 'SAFETY_BOOTS', 'HI_VIS_VEST', 'SAFETY_GLASSES', 'HEARING_PROTECTION', 'RESPIRATOR', 'GLOVES', 'FALL_PROTECTION_HARNESS', 'FACE_SHIELD', 'DUST_MASK', 'OTHER');

-- CreateTable
CREATE TABLE "WorkerPpeRequirement" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "ppeType" "PpeType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isIssued" BOOLEAN NOT NULL DEFAULT false,
    "issuedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerPpeRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPpeRequirement_workerId_ppeType_key" ON "WorkerPpeRequirement"("workerId", "ppeType");

-- AddForeignKey
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
