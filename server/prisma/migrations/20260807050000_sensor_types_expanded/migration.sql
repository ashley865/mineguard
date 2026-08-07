-- AlterEnum: broaden SensorType to cover dust, noise, water level, and equipment
-- condition monitoring, alongside the existing gas/temperature/seismic/air-flow types
ALTER TYPE "SensorType" ADD VALUE 'DUST';
ALTER TYPE "SensorType" ADD VALUE 'NOISE';
ALTER TYPE "SensorType" ADD VALUE 'WATER_LEVEL';
ALTER TYPE "SensorType" ADD VALUE 'EQUIPMENT_CONDITION';
