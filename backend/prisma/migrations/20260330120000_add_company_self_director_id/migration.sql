-- Optional Director Identification Number for the account owner on company profiles
ALTER TABLE "CompanyProfile" ADD COLUMN IF NOT EXISTS "selfDirectorId" TEXT;
