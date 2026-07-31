-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'TRUST', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BuyerDocumentType" AS ENUM ('ID_OR_REGISTRATION', 'PROOF_OF_ADDRESS', 'DEALER_LICENSE', 'TAX_CLEARANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MineralListingStatus" AS ENUM ('AVAILABLE', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MineralBidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ContractOpportunityStatus" AS ENUM ('OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractBidStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'AWARDED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "buyerType" "BuyerType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "registrationNumber" TEXT,
    "idNumber" TEXT,
    "taxNumber" TEXT NOT NULL,
    "vatNumber" TEXT,
    "dealerLicenseNumber" TEXT,
    "dealerLicenseAuthority" TEXT,
    "dealerLicenseExpiry" TIMESTAMP(3),
    "physicalAddress" TEXT NOT NULL,
    "postalAddress" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccountHolder" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranchCode" TEXT,
    "bbbeeLevel" TEXT,
    "sourceOfFunds" TEXT NOT NULL,
    "popiaConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "ficaDeclarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "amlDeclarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "BuyerStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_contactEmail_key" ON "Buyer"("contactEmail");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BuyerDocument" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "docType" "BuyerDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BuyerDocument" ADD CONSTRAINT "BuyerDocument_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MineralListing" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "mineralType" TEXT NOT NULL,
    "grade" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "description" TEXT,
    "status" "MineralListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "listedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MineralListing_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MineralListing" ADD CONSTRAINT "MineralListing_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralListing" ADD CONSTRAINT "MineralListing_listedById_fkey" FOREIGN KEY ("listedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MineralBid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "offerPrice" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "MineralBidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MineralBid_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MineralBid" ADD CONSTRAINT "MineralBid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MineralListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralBid" ADD CONSTRAINT "MineralBid_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ContractOpportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "budgetRange" TEXT,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "status" "ContractOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractOpportunity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractOpportunity" ADD CONSTRAINT "ContractOpportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractOpportunity" ADD CONSTRAINT "ContractOpportunity_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ContractBid" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "bidAmount" DOUBLE PRECISION NOT NULL,
    "proposalNotes" TEXT,
    "status" "ContractBidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractBid_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractBid" ADD CONSTRAINT "ContractBid_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ContractOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
