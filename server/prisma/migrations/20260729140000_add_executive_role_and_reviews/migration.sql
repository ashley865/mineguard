-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EXECUTIVE';

-- CreateEnum
CREATE TYPE "ExecReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "reviewStatus" "ExecReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "reviewStatus" "ExecReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
