-- AlterTable
ALTER TABLE "DisciplinaryCase" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "GrievanceCase" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "CcmaCase" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "UnionAgreement" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "targetLevel" "SkillProficiency";

