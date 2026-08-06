-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('SPARE_PARTS', 'PPE', 'FUEL', 'LUBRICANTS', 'CRITICAL_COMPONENT', 'WAREHOUSE_STOCK', 'OTHER');

-- AlterTable
-- The old "category" column was free text; there is no reliable mapping from arbitrary
-- strings to the new fixed categories, so existing values are dropped and items fall
-- back to uncategorized until re-tagged from the new dropdown.
ALTER TABLE "InventoryItem" DROP COLUMN "category",
ADD COLUMN     "category" "InventoryCategory";
