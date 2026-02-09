-- AlterTable: Add tfnHash columns for encrypted TFN lookup
-- TFN values will be AES-256-GCM encrypted; tfnHash stores HMAC-SHA256 for uniqueness checks.

-- Step 1: Drop the existing unique constraint on IndividualProfile.tfn
-- (uniqueness now enforced via tfnHash)
ALTER TABLE "IndividualProfile" DROP CONSTRAINT IF EXISTS "IndividualProfile_tfn_key";

-- Step 2: Add tfnHash columns
ALTER TABLE "IndividualProfile" ADD COLUMN "tfnHash" TEXT;
ALTER TABLE "TrustProfile" ADD COLUMN "tfnHash" TEXT;
ALTER TABLE "PartnershipProfile" ADD COLUMN "tfnHash" TEXT;

-- Step 3: Create unique index on IndividualProfile.tfnHash
CREATE UNIQUE INDEX "IndividualProfile_tfnHash_key" ON "IndividualProfile"("tfnHash");
