-- CreateEnum
CREATE TYPE "WorkerDocumentType" AS ENUM ('ID_DOCUMENT', 'CERTIFICATE', 'CV_RESUME', 'QUALIFICATION', 'PROOF_OF_ADDRESS', 'BANKING_DETAILS', 'MEDICAL_CERTIFICATE', 'CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "WorkerDocument" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "docType" "WorkerDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
