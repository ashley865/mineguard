-- AlterEnum
ALTER TYPE "PayeeType" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "Payee" ADD COLUMN     "workerId" TEXT,
ADD COLUMN     "linkedUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payee_workerId_key" ON "Payee"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payee_linkedUserId_key" ON "Payee"("linkedUserId");

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExecutiveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "ExecutiveRequest" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toTitle" "ExecutiveTitle" NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ExecutiveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExecutiveRequest" ADD CONSTRAINT "ExecutiveRequest_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveRequest" ADD CONSTRAINT "ExecutiveRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveRequest" ADD CONSTRAINT "ExecutiveRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
