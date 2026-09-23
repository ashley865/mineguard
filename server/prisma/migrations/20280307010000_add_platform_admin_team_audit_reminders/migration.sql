-- Team management (multiple platform admins), an audit log of admin actions, and
-- reminder-sent tracking on licenses so expiry/grace-period emails fire exactly once.

-- AlterTable
ALTER TABLE "PlatformAdmin"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LicenseKey"
  ADD COLUMN "expiryReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "graceReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformAdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformAdminAuditLog" ADD CONSTRAINT "PlatformAdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
