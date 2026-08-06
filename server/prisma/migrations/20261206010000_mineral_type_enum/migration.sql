-- CreateEnum
CREATE TYPE "MineralType" AS ENUM ('GOLD', 'PLATINUM_GROUP_METALS', 'DIAMOND', 'COAL', 'IRON_ORE', 'CHROME', 'MANGANESE', 'COPPER', 'ZINC', 'NICKEL', 'URANIUM', 'COBALT', 'LIMESTONE', 'SAND_AND_AGGREGATE', 'OTHER');

-- AlterTable
-- mineralType was free text; there is no reliable mapping from arbitrary strings to the
-- new fixed commodity list, so existing values are dropped and records fall back to
-- 'OTHER' until re-tagged from the new dropdown.
ALTER TABLE "ProductionRecord" DROP COLUMN "mineralType",
ADD COLUMN     "mineralType" "MineralType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ProductionRecord" ALTER COLUMN "mineralType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MineralListing" DROP COLUMN "mineralType",
ADD COLUMN     "mineralType" "MineralType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "MineralListing" ALTER COLUMN "mineralType" DROP DEFAULT;
