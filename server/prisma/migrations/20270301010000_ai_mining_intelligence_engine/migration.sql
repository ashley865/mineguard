-- CreateEnum
CREATE TYPE "AiRecommendationKind" AS ENUM ('RISK', 'PREDICTION', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "AiRecommendationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "executiveTitle" "ExecutiveTitle" NOT NULL,
    "kind" "AiRecommendationKind" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "AiRecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRecommendation_mineId_executiveTitle_status_idx" ON "AiRecommendation"("mineId", "executiveTitle", "status");

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

