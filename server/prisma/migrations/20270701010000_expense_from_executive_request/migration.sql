-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "executiveRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_executiveRequestId_key" ON "Expense"("executiveRequestId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_executiveRequestId_fkey" FOREIGN KEY ("executiveRequestId") REFERENCES "ExecutiveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

