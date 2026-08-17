-- CreateEnum
CREATE TYPE "ExecutiveRequestPriority" AS ENUM ('NORMAL', 'EMERGENCY');

-- AlterTable
ALTER TABLE "ExecutiveRequest" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "priority" "ExecutiveRequestPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "payeeId" TEXT,
ALTER COLUMN "workerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

