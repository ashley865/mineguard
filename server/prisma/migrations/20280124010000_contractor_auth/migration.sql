-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "CyberLoginEvent" ADD COLUMN     "contractorId" TEXT;

-- AddForeignKey
ALTER TABLE "CyberLoginEvent" ADD CONSTRAINT "CyberLoginEvent_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

