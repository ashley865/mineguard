-- CreateEnum
CREATE TYPE "SafetyObservationType" AS ENUM ('NEAR_MISS', 'UNSAFE_ACT', 'UNSAFE_CONDITION', 'POSITIVE_OBSERVATION');

-- CreateEnum
CREATE TYPE "SafetyObservationStatus" AS ENUM ('OPEN', 'ACTION_REQUIRED', 'CLOSED');

-- CreateTable
CREATE TABLE "SafetyObservation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "zoneId" TEXT,
    "type" "SafetyObservationType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'LOW',
    "description" TEXT NOT NULL,
    "location" TEXT,
    "actionTaken" TEXT,
    "status" "SafetyObservationStatus" NOT NULL DEFAULT 'OPEN',
    "reporterName" TEXT,
    "reportedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyObservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExplosivesMagazineStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ExplosivesMagazine" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "magazineNumber" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "status" "ExplosivesMagazineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplosivesMagazine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExplosivesMagazine" ADD CONSTRAINT "ExplosivesMagazine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExplosivesTransactionType" AS ENUM ('RECEIPT', 'ISSUE', 'RETURN', 'DESTRUCTION');

-- CreateTable
CREATE TABLE "ExplosivesTransaction" (
    "id" TEXT NOT NULL,
    "magazineId" TEXT NOT NULL,
    "transactionType" "ExplosivesTransactionType" NOT NULL,
    "explosiveType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "issuedTo" TEXT,
    "authorizedById" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplosivesTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExplosivesTransaction" ADD CONSTRAINT "ExplosivesTransaction_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "ExplosivesMagazine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplosivesTransaction" ADD CONSTRAINT "ExplosivesTransaction_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
