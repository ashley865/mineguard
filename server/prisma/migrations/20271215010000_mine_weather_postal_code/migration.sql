-- AlterTable
ALTER TABLE "Mine" ADD COLUMN     "weatherGeocodedAt" TIMESTAMP(3),
ADD COLUMN     "weatherLatitude" DOUBLE PRECISION,
ADD COLUMN     "weatherLongitude" DOUBLE PRECISION,
ADD COLUMN     "weatherPostalCode" TEXT NOT NULL DEFAULT '2094';

