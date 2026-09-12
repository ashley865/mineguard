-- Lets an HTTP_JSON sensor poll authenticate against a real software/AI API, which almost
-- always requires a credential, while leaving push and the existing unauthenticated
-- HTTP_JSON/MODBUS_TCP/SNMP pull paths untouched.

-- CreateEnum
CREATE TYPE "SensorPollAuthType" AS ENUM ('NONE', 'API_KEY_HEADER', 'BEARER', 'BASIC');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SENSOR_POLL_FAILING';

-- AlterTable
ALTER TABLE "Sensor"
  ADD COLUMN "pollConsecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pollAuthType" "SensorPollAuthType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "pollAuthHeaderName" TEXT,
  ADD COLUMN "pollAuthSecretEnc" TEXT,
  ADD COLUMN "pollAuthSecretSetAt" TIMESTAMP(3);
