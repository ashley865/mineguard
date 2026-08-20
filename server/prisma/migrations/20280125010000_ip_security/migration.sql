-- AlterTable
ALTER TABLE "CyberBlockedIp" ADD COLUMN     "autoBlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BuyerLoginEvent" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "eventType" "CyberLoginEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalBlockedIp" (
    "id" TEXT NOT NULL,
    "ipOrCidr" TEXT NOT NULL,
    "reason" TEXT,
    "autoBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalBlockedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalBlockedIp_ipOrCidr_key" ON "GlobalBlockedIp"("ipOrCidr");

-- AddForeignKey
ALTER TABLE "BuyerLoginEvent" ADD CONSTRAINT "BuyerLoginEvent_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

