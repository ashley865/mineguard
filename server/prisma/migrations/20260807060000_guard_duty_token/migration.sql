-- AlterTable: secure per-guard duty link token
ALTER TABLE "Worker" ADD COLUMN     "dutyToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_dutyToken_key" ON "Worker"("dutyToken");
