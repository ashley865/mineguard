-- CreateEnum
CREATE TYPE "InsurancePolicyType" AS ENUM ('PROPERTY', 'EQUIPMENT', 'LIABILITY', 'BUSINESS_INTERRUPTION', 'MARINE_TRANSIT', 'DIRECTORS_OFFICERS', 'OTHER');

-- CreateEnum
CREATE TYPE "InsurancePolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('LODGED', 'UNDER_ASSESSMENT', 'APPROVED', 'REJECTED', 'SETTLED', 'CLOSED');

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyType" "InsurancePolicyType" NOT NULL,
    "coverageAmount" DOUBLE PRECISION,
    "premiumAmount" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "InsurancePolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "incidentId" TEXT,
    "claimNumber" TEXT,
    "dateOfLoss" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountClaimed" DOUBLE PRECISION,
    "amountSettled" DOUBLE PRECISION,
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'LODGED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
