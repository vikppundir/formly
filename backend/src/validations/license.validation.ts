import { z } from "zod";

export const licenceSettingsSchema = z.object({
  licence_signing_secret: z.string().min(16),
  licence_default_validity_days: z.coerce.number().int().min(1).max(3650),
  licence_grace_days: z.coerce.number().int().min(0).max(180),
  licence_enforcement_active: z.enum(["OK"]),
  licence_enforcement_grace: z.enum(["WARN_GRACE"]),
  licence_enforcement_suspended: z.enum(["SUSPEND_ADMIN", "READ_ONLY"]),
  licence_enforcement_expired: z.enum(["LOCKOUT"]),
  licence_enforcement_revoked: z.enum(["LOCKOUT"]),
  licence_build_signature_policy: z.coerce.boolean(),
  licence_central_validate_url: z.string().url(),
  licence_central_api_key: z.string().optional().default(""),
  licence_central_timeout_ms: z.coerce.number().int().min(1000).max(30000).default(5000),
  licence_allow_offline_activation: z.coerce.boolean().default(true),
});

export const licenceIssueSchema = z.object({
  validityDays: z.coerce.number().int().min(1).max(3650).optional(),
  allowedDomains: z.array(z.string().min(1)).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const licenceActivationSchema = z.object({
  licenceKey: z.string().min(8).max(256),
  instanceId: z.string().min(3).max(128),
  fingerprint: z.string().min(8).max(512),
  domain: z.string().min(1).max(255),
  productVersion: z.string().max(128).optional(),
  buildDigest: z.string().max(256).optional(),
});

export const licenceValidateSchema = licenceActivationSchema;

export const licenceStatusSchema = z.object({
  licenceKey: z.string().min(8).max(256),
  instanceId: z.string().min(3).max(128),
  fingerprint: z.string().min(8).max(512),
  domain: z.string().min(1).max(255),
  productVersion: z.string().max(128).optional(),
  buildDigest: z.string().max(256).optional(),
});

export const licenceRenewalCheckoutSchema = z.object({
  licenceId: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const licenceRenewalVerifySchema = z.object({
  renewalId: z.string().min(1),
  sessionId: z.string().min(1),
});
