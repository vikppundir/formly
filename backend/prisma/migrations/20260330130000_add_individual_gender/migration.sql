-- Gender for individual tax profiles (form values: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY)
ALTER TABLE "IndividualProfile" ADD COLUMN IF NOT EXISTS "gender" TEXT;
