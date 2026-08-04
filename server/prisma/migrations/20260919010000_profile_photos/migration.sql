-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoData" BYTEA,
ADD COLUMN     "photoMimeType" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "photoData" BYTEA,
ADD COLUMN     "photoMimeType" TEXT;
