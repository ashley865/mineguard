-- CreateEnum
CREATE TYPE "CustomApiKeyAuthStyle" AS ENUM ('BEARER', 'HEADER', 'QUERY');

-- CreateTable
CREATE TABLE "CustomApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "testUrl" TEXT,
    "authStyle" "CustomApiKeyAuthStyle" NOT NULL DEFAULT 'BEARER',
    "headerName" TEXT,
    "queryParam" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomApiKey_name_key" ON "CustomApiKey"("name");
