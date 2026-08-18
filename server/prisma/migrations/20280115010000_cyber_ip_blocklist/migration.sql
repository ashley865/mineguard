-- AlterEnum
ALTER TYPE "CyberLoginEventType" ADD VALUE 'BLOCKED';

-- CreateTable
CREATE TABLE "CyberBlockedIp" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "ipOrCidr" TEXT NOT NULL,
    "reason" TEXT,
    "blockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberBlockedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CyberBlockedIp_mineId_ipOrCidr_key" ON "CyberBlockedIp"("mineId", "ipOrCidr");

-- AddForeignKey
ALTER TABLE "CyberBlockedIp" ADD CONSTRAINT "CyberBlockedIp_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberBlockedIp" ADD CONSTRAINT "CyberBlockedIp_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

