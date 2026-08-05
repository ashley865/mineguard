-- AlterTable
ALTER TABLE "ExecutiveRequest" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileData" BYTEA;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "recipientId" DROP NOT NULL,
ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "MessageGroup" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageGroupMember_groupId_userId_key" ON "MessageGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Message_groupId_createdAt_idx" ON "Message"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MessageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroup" ADD CONSTRAINT "MessageGroup_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroup" ADD CONSTRAINT "MessageGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroupMember" ADD CONSTRAINT "MessageGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MessageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroupMember" ADD CONSTRAINT "MessageGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
