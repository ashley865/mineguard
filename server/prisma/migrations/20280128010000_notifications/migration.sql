-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EXECUTIVE_REQUEST', 'VISITOR_PENDING', 'PERMIT_TO_WORK', 'EXPENSE_APPROVAL', 'PURCHASE_ORDER_APPROVAL', 'IT_ACCESS_REQUEST', 'LEAVE_REQUEST', 'IOD_CLAIM');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
