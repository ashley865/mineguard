-- Expands the tender bid form with the credentials a real tender evaluates a bidder on,
-- a proposed timeline, references, and supporting document uploads.

-- CreateEnum
CREATE TYPE "ContractBidDocumentType" AS ENUM ('COMPANY_PROFILE', 'TAX_CLEARANCE', 'BBBEE_CERTIFICATE', 'INSURANCE', 'REFERENCE_LETTER', 'OTHER');

-- AlterTable
ALTER TABLE "ContractBid"
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "taxNumber" TEXT,
  ADD COLUMN "bbbeeLevel" TEXT,
  ADD COLUMN "yearsInBusiness" INTEGER,
  ADD COLUMN "proposedStartDate" TIMESTAMP(3),
  ADD COLUMN "proposedCompletionDate" TIMESTAMP(3),
  ADD COLUMN "references" TEXT;

-- CreateTable
CREATE TABLE "ContractBidDocument" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "docType" "ContractBidDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractBidDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractBidDocument" ADD CONSTRAINT "ContractBidDocument_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "ContractBid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
