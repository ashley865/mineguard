-- CreateTable
CREATE TABLE "Mine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "miningRightNumber" TEXT,
    "description" TEXT,
    "passkeyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mineId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
