-- Lets a PlatformAdmin sign in with a generated access key instead of email+password.
-- passwordHash becomes optional: the bootstrap endpoint (the only way to create the very
-- first admin without already having database access) only ever sets an access key.

-- AlterTable
ALTER TABLE "PlatformAdmin"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "accessKeyHash" TEXT,
  ADD COLUMN "accessKeyIssuedAt" TIMESTAMP(3);
