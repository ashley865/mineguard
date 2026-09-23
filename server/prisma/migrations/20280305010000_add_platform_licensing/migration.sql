-- Platform licensing subsystem: who has bought MineGuard and what they're licensed for.
-- Entirely separate from mine-tenant data — administered by PlatformAdmin accounts, which
-- have no relation to Mine/User. "Customer" (not "Buyer") because Buyer already means the
-- marketplace's mineral purchasers.

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LicensePlan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "LicenseKeyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'LEAD',
    "mineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plan" "LicensePlan" NOT NULL,
    "seats" INTEGER,
    "status" "LicenseKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mineId_key" ON "Customer"("mineId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKey_key_key" ON "LicenseKey"("key");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
