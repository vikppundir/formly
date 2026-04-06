-- Run if profile PATCH returns 500 after pulling schema changes (when migrate history is not applied).
-- Usage: npx prisma db execute --file prisma/patch-profile-columns.sql
ALTER TABLE "IndividualProfile" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "CompanyProfile" ADD COLUMN IF NOT EXISTS "selfDirectorId" TEXT;
