-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "apiKeyHash" TEXT,
ADD COLUMN     "apiKeyIssuedAt" TIMESTAMP(3),
ADD COLUMN     "apiKeyLastUsedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenIp" TEXT;
