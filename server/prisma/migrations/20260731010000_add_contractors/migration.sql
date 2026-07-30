-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "scopeOfWork" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contractStartDate" TIMESTAMP(3) NOT NULL,
    "contractEndDate" TIMESTAMP(3) NOT NULL,
    "goodStandingExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE',
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
