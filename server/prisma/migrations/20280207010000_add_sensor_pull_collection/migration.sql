-- CreateEnum
CREATE TYPE "SensorPollProtocol" AS ENUM ('HTTP_JSON', 'MODBUS_TCP', 'SNMP');

-- CreateTable
CREATE TABLE "SensorAgent" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "agentVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SensorAgent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "pollEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pollProtocol" "SensorPollProtocol",
ADD COLUMN     "pollTarget" TEXT,
ADD COLUMN     "pollConfig" JSONB,
ADD COLUMN     "pollIntervalSeconds" INTEGER,
ADD COLUMN     "pollAgentId" TEXT,
ADD COLUMN     "lastPollAt" TIMESTAMP(3),
ADD COLUMN     "lastPollOk" BOOLEAN,
ADD COLUMN     "lastPollError" TEXT;

-- AddForeignKey
ALTER TABLE "SensorAgent" ADD CONSTRAINT "SensorAgent_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_pollAgentId_fkey" FOREIGN KEY ("pollAgentId") REFERENCES "SensorAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
