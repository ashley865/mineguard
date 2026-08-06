-- CreateTable
CREATE TABLE "EmployeeComplianceCheck" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "isProperlyTrained" BOOLEAN NOT NULL DEFAULT false,
    "isCompetent" BOOLEAN NOT NULL DEFAULT false,
    "isCertified" BOOLEAN NOT NULL DEFAULT false,
    "isAuthorised" BOOLEAN NOT NULL DEFAULT false,
    "medicalFitness" "FitnessResult",
    "isAssignedPermittedTasks" BOOLEAN NOT NULL DEFAULT false,
    "isTrainingUpToDate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmployeeComplianceCheck" ADD CONSTRAINT "EmployeeComplianceCheck_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeComplianceCheck" ADD CONSTRAINT "EmployeeComplianceCheck_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: link expenses back to the payslip they were auto-generated from
ALTER TABLE "Expense" ADD COLUMN     "payslipId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_payslipId_key" ON "Expense"("payslipId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
