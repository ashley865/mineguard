-- CreateTable
CREATE TABLE "AiDailyBriefing" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "briefingDate" TIMESTAMP(3) NOT NULL,
    "headline" TEXT NOT NULL,
    "topPriority" TEXT,
    "sections" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiDailyBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiDailyBriefing_mineId_briefingDate_key" ON "AiDailyBriefing"("mineId", "briefingDate");

-- AddForeignKey
ALTER TABLE "AiDailyBriefing" ADD CONSTRAINT "AiDailyBriefing_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

