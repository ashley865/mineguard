-- CreateEnum
CREATE TYPE "PermitDocumentType" AS ENUM ('PERMIT_CERTIFICATE', 'RENEWAL_APPROVAL', 'INSPECTION_REPORT', 'CORRESPONDENCE', 'OTHER');

-- CreateTable
CREATE TABLE "PermitDocument" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "docType" "PermitDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PermitDocument" ADD CONSTRAINT "PermitDocument_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ContractorDocumentType" AS ENUM ('INSURANCE_CERTIFICATE', 'GOOD_STANDING_CERTIFICATE', 'CONTRACT_AGREEMENT', 'SAFETY_FILE', 'OTHER');

-- CreateTable
CREATE TABLE "ContractorDocument" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "docType" "ContractorDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
