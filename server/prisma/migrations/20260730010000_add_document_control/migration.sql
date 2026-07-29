-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('POLICY', 'CODE_OF_PRACTICE', 'PERMIT', 'CERTIFICATE', 'REPORT', 'PROCEDURE', 'DRAWING', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "reviewDate" TIMESTAMP(3),
    "siteId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
