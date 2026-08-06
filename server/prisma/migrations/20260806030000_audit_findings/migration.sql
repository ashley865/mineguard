-- CreateEnum
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'VERIFIED', 'CLOSED', 'OVERDUE');

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "requirementViolated" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "responsiblePersonId" TEXT,
    "correctiveAction" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
    "verificationNotes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "closureDate" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
