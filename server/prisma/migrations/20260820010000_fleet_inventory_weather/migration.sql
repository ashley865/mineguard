-- CreateTable
CREATE TABLE "FleetPosition" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetPosition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FleetPosition" ADD CONSTRAINT "FleetPosition_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetPosition" ADD CONSTRAINT "FleetPosition_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetPosition" ADD CONSTRAINT "FleetPosition_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InventoryMovementDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "partNumber" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderPoint" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "supplier" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "direction" "InventoryMovementDirection" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'FOG', 'HIGH_WIND');

-- CreateTable
CREATE TABLE "WeatherReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "windDirection" TEXT,
    "precipitation" DOUBLE PRECISION,
    "condition" "WeatherCondition" NOT NULL DEFAULT 'CLEAR',
    "lightningDetected" BOOLEAN NOT NULL DEFAULT false,
    "alertIssued" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherReading_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeatherReading" ADD CONSTRAINT "WeatherReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherReading" ADD CONSTRAINT "WeatherReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
