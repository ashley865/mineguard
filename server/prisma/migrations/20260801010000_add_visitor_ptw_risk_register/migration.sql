-- CreateEnum
CREATE TYPE "RiskMitigationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'DENIED');

-- CreateEnum
CREATE TYPE "VisitorDocumentType" AS ENUM ('ID_DOCUMENT', 'MEDICAL_CERTIFICATE', 'INDUCTION_ACKNOWLEDGEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PermitToWorkStatus" AS ENUM ('PENDING_SUPERVISOR', 'PENDING_EXECUTIVE', 'APPROVED', 'REJECTED', 'EXPIRED', 'CLOSED');

-- AlterTable
ALTER TABLE "RiskAssessment"
    ADD COLUMN "likelihood" INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN "severity" INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN "owner" TEXT,
    ADD COLUMN "mitigationStatus" "RiskMitigationStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN "mitigationDueDate" TIMESTAMP(3),
    ADD COLUMN "escalated" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExecutiveSiteAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveSiteAssignment_userId_siteId_key" ON "ExecutiveSiteAssignment"("userId", "siteId");

-- AddForeignKey
ALTER TABLE "ExecutiveSiteAssignment" ADD CONSTRAINT "ExecutiveSiteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveSiteAssignment" ADD CONSTRAINT "ExecutiveSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "company" TEXT,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "hostName" TEXT NOT NULL,
    "purposeOfVisit" TEXT NOT NULL,
    "vehicleRegistration" TEXT,
    "siteId" TEXT NOT NULL,
    "status" "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "inductionAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "popiaConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "indemnityAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "VisitorDocument" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "docType" "VisitorDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VisitorDocument" ADD CONSTRAINT "VisitorDocument_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PermitToWork" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workDescription" TEXT NOT NULL,
    "workArea" TEXT NOT NULL,
    "hazardsIdentified" TEXT NOT NULL,
    "controlMeasures" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "status" "PermitToWorkStatus" NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "supervisorNote" TEXT,
    "supervisorDecidedAt" TIMESTAMP(3),
    "supervisorDecidedById" TEXT,
    "executiveNote" TEXT,
    "executiveDecidedAt" TIMESTAMP(3),
    "executiveDecidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitToWork_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_supervisorDecidedById_fkey" FOREIGN KEY ("supervisorDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_executiveDecidedById_fkey" FOREIGN KEY ("executiveDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
