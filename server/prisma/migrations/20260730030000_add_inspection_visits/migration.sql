-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('NO_ACTION', 'VERBAL_WARNING', 'NOTICE_ISSUED', 'FOLLOW_UP_REQUIRED');

-- CreateTable
CREATE TABLE "InspectionVisit" (
    "id" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "inspectorBadge" TEXT,
    "authority" TEXT NOT NULL,
    "areasInspected" TEXT NOT NULL,
    "purpose" TEXT,
    "findings" TEXT,
    "outcome" "InspectionOutcome" NOT NULL DEFAULT 'NO_ACTION',
    "siteId" TEXT NOT NULL,
    "relatedNoticeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionVisit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InspectionVisit" ADD CONSTRAINT "InspectionVisit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionVisit" ADD CONSTRAINT "InspectionVisit_relatedNoticeId_fkey" FOREIGN KEY ("relatedNoticeId") REFERENCES "RegulatoryNotice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
