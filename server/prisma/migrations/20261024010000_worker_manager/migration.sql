-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "managerId" TEXT;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
