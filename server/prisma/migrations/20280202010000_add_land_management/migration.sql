-- CreateEnum
CREATE TYPE "LandTenureType" AS ENUM ('SURFACE_RIGHTS_LEASE', 'SERVITUDE', 'PERMISSION_TO_OCCUPY', 'RESETTLEMENT_AGREEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LandAgreementStatus" AS ENUM ('DRAFT', 'NEGOTIATING', 'SIGNED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ResettlementStatus" AS ENUM ('IDENTIFIED', 'CONSULTATION', 'COMPENSATION_AGREED', 'RELOCATED', 'LIVELIHOOD_RESTORED', 'CLOSED');

-- CreateTable
CREATE TABLE "LandAgreement" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "siteId" TEXT,
    "parcelReference" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "tenureType" "LandTenureType" NOT NULL,
    "areaHectares" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "annualPaymentAmount" DOUBLE PRECISION,
    "status" "LandAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResettlementCase" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "landAgreementId" TEXT,
    "householdName" TEXT NOT NULL,
    "householdSize" INTEGER,
    "status" "ResettlementStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "compensationAmount" DOUBLE PRECISION,
    "compensationPaidAt" TIMESTAMP(3),
    "relocationDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResettlementCase_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LandAgreement" ADD CONSTRAINT "LandAgreement_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandAgreement" ADD CONSTRAINT "LandAgreement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResettlementCase" ADD CONSTRAINT "ResettlementCase_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResettlementCase" ADD CONSTRAINT "ResettlementCase_landAgreementId_fkey" FOREIGN KEY ("landAgreementId") REFERENCES "LandAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
