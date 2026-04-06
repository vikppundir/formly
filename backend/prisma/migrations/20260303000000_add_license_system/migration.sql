-- License management system
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'GRACE', 'SUSPENDED', 'EXPIRED', 'REVOKED');
CREATE TYPE "LicenseValidationResult" AS ENUM ('OK', 'WARN_GRACE', 'SUSPEND_ADMIN', 'READ_ONLY', 'LOCKOUT');
CREATE TYPE "LicenseEnforcementMode" AS ENUM ('OK', 'WARN_GRACE', 'SUSPEND_ADMIN', 'READ_ONLY', 'LOCKOUT');
CREATE TYPE "RenewalPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "License" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keyLast4" TEXT NOT NULL,
  "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "graceEndsAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "allowedDomains" TEXT,
  "boundDomain" TEXT,
  "metadata" TEXT,
  "latestRenewalFailedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseActivation" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "userId" TEXT,
  "instanceId" TEXT NOT NULL,
  "fingerprintHash" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "productVersion" TEXT,
  "buildDigest" TEXT,
  "lastValidationStatus" "LicenseValidationResult" NOT NULL DEFAULT 'OK',
  "lastValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicenseActivation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseRenewal" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "paymentStatus" "RenewalPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "stripeSessionId" TEXT,
  "transactionId" TEXT,
  "amount" DECIMAL(10,2),
  "currency" TEXT DEFAULT 'AUD',
  "periodMonths" INTEGER NOT NULL DEFAULT 12,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicenseRenewal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseValidationAudit" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT,
  "activationId" TEXT,
  "instanceId" TEXT,
  "status" "LicenseValidationResult" NOT NULL,
  "enforcementMode" "LicenseEnforcementMode" NOT NULL,
  "reasonCode" TEXT,
  "domain" TEXT,
  "keyHash" TEXT,
  "fingerprintHash" TEXT,
  "buildDigestHash" TEXT,
  "requestIp" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LicenseValidationAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "License_keyHash_key" ON "License"("keyHash");
CREATE INDEX "License_status_idx" ON "License"("status");
CREATE INDEX "License_expiresAt_idx" ON "License"("expiresAt");
CREATE INDEX "License_boundDomain_idx" ON "License"("boundDomain");

CREATE UNIQUE INDEX "LicenseActivation_licenseId_instanceId_key" ON "LicenseActivation"("licenseId", "instanceId");
CREATE INDEX "LicenseActivation_instanceId_idx" ON "LicenseActivation"("instanceId");
CREATE INDEX "LicenseActivation_userId_idx" ON "LicenseActivation"("userId");
CREATE INDEX "LicenseActivation_domain_idx" ON "LicenseActivation"("domain");

CREATE UNIQUE INDEX "LicenseRenewal_stripeSessionId_key" ON "LicenseRenewal"("stripeSessionId");
CREATE INDEX "LicenseRenewal_licenseId_idx" ON "LicenseRenewal"("licenseId");
CREATE INDEX "LicenseRenewal_paymentStatus_idx" ON "LicenseRenewal"("paymentStatus");
CREATE INDEX "LicenseRenewal_paidAt_idx" ON "LicenseRenewal"("paidAt");

CREATE INDEX "LicenseValidationAudit_licenseId_idx" ON "LicenseValidationAudit"("licenseId");
CREATE INDEX "LicenseValidationAudit_activationId_idx" ON "LicenseValidationAudit"("activationId");
CREATE INDEX "LicenseValidationAudit_instanceId_idx" ON "LicenseValidationAudit"("instanceId");
CREATE INDEX "LicenseValidationAudit_status_idx" ON "LicenseValidationAudit"("status");
CREATE INDEX "LicenseValidationAudit_createdAt_idx" ON "LicenseValidationAudit"("createdAt");

ALTER TABLE "LicenseActivation"
  ADD CONSTRAINT "LicenseActivation_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenseActivation"
  ADD CONSTRAINT "LicenseActivation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LicenseRenewal"
  ADD CONSTRAINT "LicenseRenewal_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenseValidationAudit"
  ADD CONSTRAINT "LicenseValidationAudit_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LicenseValidationAudit"
  ADD CONSTRAINT "LicenseValidationAudit_activationId_fkey"
  FOREIGN KEY ("activationId") REFERENCES "LicenseActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
