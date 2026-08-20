-- AlterTable
ALTER TABLE "MineralListingImage" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BuyerFavorite" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerFavorite_buyerId_listingId_key" ON "BuyerFavorite"("buyerId", "listingId");

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MineralListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
