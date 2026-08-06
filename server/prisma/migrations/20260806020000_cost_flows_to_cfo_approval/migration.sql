-- AlterEnum
ALTER TYPE "PayeeType" ADD VALUE 'SUPPLIER';

-- AlterTable: auto-synced payees for procurement and awarded contracts
ALTER TABLE "Payee" ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "contractBidId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payee_supplierId_key" ON "Payee"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Payee_contractBidId_key" ON "Payee"("contractBidId");

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_contractBidId_fkey" FOREIGN KEY ("contractBidId") REFERENCES "ContractBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: link expenses back to whichever cost-incurring event generated them, so
-- purchase orders, maintenance jobs, and awarded contract bids all flow through the same
-- CFO approval pipeline as manually-logged expenses and payslips
ALTER TABLE "Expense" ADD COLUMN     "purchaseOrderId" TEXT,
ADD COLUMN     "maintenanceScheduleId" TEXT,
ADD COLUMN     "contractBidId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_purchaseOrderId_key" ON "Expense"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_maintenanceScheduleId_key" ON "Expense"("maintenanceScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_contractBidId_key" ON "Expense"("contractBidId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_contractBidId_fkey" FOREIGN KEY ("contractBidId") REFERENCES "ContractBid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
