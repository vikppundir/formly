import crypto from "node:crypto";
import type {
  License,
  LicenseActivation,
  LicenseEnforcementMode,
  LicenseStatus,
  LicenseValidationResult,
  PrismaClient,
} from "@prisma/client";
import { logger, writeAuditLog } from "../utils/logger.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";

type SettingsRepo = ReturnType<typeof createSettingsRepository>;

export type EnforcementMap = {
  ACTIVE: "OK";
  GRACE: "WARN_GRACE";
  SUSPENDED: "SUSPEND_ADMIN" | "READ_ONLY";
  EXPIRED: "LOCKOUT";
  REVOKED: "LOCKOUT";
};

export interface LicenseConfig {
  signingSecret: string;
  defaultValidityDays: number;
  graceDays: number;
  buildSignaturePolicy: boolean;
  centralValidateUrl: string;
  centralApiKey: string;
  centralTimeoutMs: number;
  allowOfflineActivation: boolean;
  enforcementMap: EnforcementMap;
}

export interface LicenseCheckInput {
  licenceKey: string;
  instanceId: string;
  fingerprint: string;
  domain: string;
  productVersion?: string;
  buildDigest?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LicenseCheckResult {
  status: LicenseStatus | "INVALID";
  expiresAt: string | null;
  graceEndsAt: string | null;
  enforcementMode: LicenseEnforcementMode;
  message: string;
  serverTime: string;
  reasonCode?: string;
  license?: License;
  activation?: LicenseActivation | null;
}

const DEFAULT_CONFIG: LicenseConfig = {
  signingSecret: "replace_me_licence_signing_secret",
  defaultValidityDays: 365,
  graceDays: 14,
  buildSignaturePolicy: false,
  centralValidateUrl: "http://localhost:3001/api/license/validate",
  centralApiKey: "",
  centralTimeoutMs: 5000,
  allowOfflineActivation: true,
  enforcementMap: {
    ACTIVE: "OK",
    GRACE: "WARN_GRACE",
    SUSPENDED: "SUSPEND_ADMIN",
    EXPIRED: "LOCKOUT",
    REVOKED: "LOCKOUT",
  },
};

function toBoolean(value: string, fallback = false): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function hashLicenseValue(value: string): string {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}

export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return trimmed;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).hostname.toLowerCase();
    }
    return new URL(`https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export async function loadLicenseConfig(settingsRepo: SettingsRepo): Promise<LicenseConfig> {
  const [
    signingSecret,
    validity,
    grace,
    buildPolicy,
    suspended,
    centralValidateUrl,
    centralApiKey,
    centralTimeoutMs,
    allowOfflineActivation,
  ] = await Promise.all([
    settingsRepo.getValue("licence_signing_secret", DEFAULT_CONFIG.signingSecret),
    settingsRepo.getValue("licence_default_validity_days", String(DEFAULT_CONFIG.defaultValidityDays)),
    settingsRepo.getValue("licence_grace_days", String(DEFAULT_CONFIG.graceDays)),
    settingsRepo.getValue("licence_build_signature_policy", String(DEFAULT_CONFIG.buildSignaturePolicy)),
    settingsRepo.getValue("licence_enforcement_suspended", DEFAULT_CONFIG.enforcementMap.SUSPENDED),
    settingsRepo.getValue("licence_central_validate_url", DEFAULT_CONFIG.centralValidateUrl),
    settingsRepo.getValue("licence_central_api_key", DEFAULT_CONFIG.centralApiKey),
    settingsRepo.getValue("licence_central_timeout_ms", String(DEFAULT_CONFIG.centralTimeoutMs)),
    settingsRepo.getValue("licence_allow_offline_activation", String(DEFAULT_CONFIG.allowOfflineActivation)),
  ]);

  return {
    signingSecret: signingSecret || DEFAULT_CONFIG.signingSecret,
    defaultValidityDays: Math.max(1, toInt(validity, DEFAULT_CONFIG.defaultValidityDays)),
    graceDays: Math.max(0, toInt(grace, DEFAULT_CONFIG.graceDays)),
    buildSignaturePolicy: toBoolean(buildPolicy, DEFAULT_CONFIG.buildSignaturePolicy),
    centralValidateUrl: centralValidateUrl || DEFAULT_CONFIG.centralValidateUrl,
    centralApiKey: centralApiKey || DEFAULT_CONFIG.centralApiKey,
    centralTimeoutMs: Math.max(1000, toInt(centralTimeoutMs, DEFAULT_CONFIG.centralTimeoutMs)),
    allowOfflineActivation: toBoolean(allowOfflineActivation, DEFAULT_CONFIG.allowOfflineActivation),
    enforcementMap: {
      ACTIVE: "OK",
      GRACE: "WARN_GRACE",
      SUSPENDED: suspended === "READ_ONLY" ? "READ_ONLY" : "SUSPEND_ADMIN",
      EXPIRED: "LOCKOUT",
      REVOKED: "LOCKOUT",
    },
  };
}

interface CentralValidateResult {
  status: LicenseStatus | "INVALID";
  expiresAt: Date | null;
  graceEndsAt: Date | null;
  enforcementMode: LicenseEnforcementMode;
  message: string;
  reasonCode?: string;
}

async function validateWithCentralServer(
  config: LicenseConfig,
  input: LicenseCheckInput
): Promise<CentralValidateResult | null> {
  if (!config.centralValidateUrl) return null;
  const domain = normalizeDomain(input.domain);

  function normalizeCentralPayload(raw: any): CentralValidateResult | null {
    const payload = raw?.data && typeof raw.data === "object" ? raw.data : raw;
    if (!payload || typeof payload !== "object") return null;

    const statusRaw = String(payload?.status || payload?.licenseStatus || "").toUpperCase();
    const status: LicenseStatus | "INVALID" =
      statusRaw === "ACTIVE" || statusRaw === "GRACE" || statusRaw === "SUSPENDED" || statusRaw === "EXPIRED" || statusRaw === "REVOKED"
        ? (statusRaw as LicenseStatus)
        : "INVALID";

    const enforcementRaw = String(payload?.enforcementMode || "").toUpperCase();
    const enforcementMode: LicenseEnforcementMode =
      enforcementRaw === "OK" ||
      enforcementRaw === "WARN_GRACE" ||
      enforcementRaw === "SUSPEND_ADMIN" ||
      enforcementRaw === "READ_ONLY" ||
      enforcementRaw === "LOCKOUT"
        ? (enforcementRaw as LicenseEnforcementMode)
        : status === "ACTIVE"
        ? "OK"
        : status === "GRACE"
        ? "WARN_GRACE"
        : status === "SUSPENDED"
        ? "SUSPEND_ADMIN"
        : "LOCKOUT";

    return {
      status,
      enforcementMode,
      message: String(payload?.message || (status === "INVALID" ? "Invalid licence key." : "Central validation passed.")),
      expiresAt: payload?.expiresAt ? new Date(payload.expiresAt) : null,
      graceEndsAt: payload?.graceEndsAt ? new Date(payload.graceEndsAt) : null,
      reasonCode: payload?.reasonCode,
    };
  }

  async function tryRequest(url: string, init: RequestInit): Promise<CentralValidateResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.centralTimeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn("Central validation rejected request", {
          statusCode: res.status,
          responseError: data?.error || data?.message || "unknown",
          url,
        });
        return null;
      }
      if (data?.success === false) {
        logger.warn("Central validation returned success=false", {
          responseError: data?.error || data?.message || "unknown",
          url,
        });
        return null;
      }
      return normalizeCentralPayload(data);
    } catch (error) {
      logger.warn("Central license validation unavailable", {
        message: error instanceof Error ? error.message : "unknown",
        url,
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.centralApiKey) headers["x-license-api-key"] = config.centralApiKey;

  const postResult = await tryRequest(config.centralValidateUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      licenceKey: input.licenceKey,
      licenseKey: input.licenceKey,
      domain,
      instanceId: input.instanceId,
      fingerprint: input.fingerprint,
      productVersion: input.productVersion,
      buildDigest: input.buildDigest,
    }),
  });
  if (postResult) return postResult;

  const getUrl = new URL(config.centralValidateUrl);
  getUrl.searchParams.set("licenceKey", input.licenceKey);
  getUrl.searchParams.set("licenseKey", input.licenceKey);
  getUrl.searchParams.set("domain", domain);
  getUrl.searchParams.set("instanceId", input.instanceId);
  getUrl.searchParams.set("fingerprint", input.fingerprint);
  if (input.productVersion) getUrl.searchParams.set("productVersion", input.productVersion);
  if (input.buildDigest) getUrl.searchParams.set("buildDigest", input.buildDigest);

  return tryRequest(getUrl.toString(), {
    method: "GET",
    headers: config.centralApiKey ? { "x-license-api-key": config.centralApiKey } : undefined,
  });
}

export function mapStatusToEnforcement(status: LicenseStatus, config: LicenseConfig): LicenseEnforcementMode {
  if (status === "ACTIVE") return config.enforcementMap.ACTIVE;
  if (status === "GRACE") return config.enforcementMap.GRACE;
  if (status === "SUSPENDED") return config.enforcementMap.SUSPENDED;
  if (status === "REVOKED") return config.enforcementMap.REVOKED;
  return config.enforcementMap.EXPIRED;
}

function getDerivedStatus(license: License, now: Date): LicenseStatus {
  if (license.status === "REVOKED" || license.revokedAt) return "REVOKED";
  if (license.status === "SUSPENDED") return "SUSPENDED";
  if (license.status === "EXPIRED") return "EXPIRED";

  if (license.status === "GRACE") {
    if (license.graceEndsAt && license.graceEndsAt > now) return "GRACE";
    return "SUSPENDED";
  }

  if (license.expiresAt > now) return "ACTIVE";
  return "EXPIRED";
}

async function writeValidationAudit(
  prisma: PrismaClient,
  params: {
    licenseId?: string;
    activationId?: string;
    instanceId?: string;
    status: LicenseValidationResult;
    enforcementMode: LicenseEnforcementMode;
    reasonCode?: string;
    domain?: string;
    keyHash?: string;
    fingerprintHash?: string;
    buildDigestHash?: string;
    requestIp?: string;
    userAgent?: string;
  }
): Promise<void> {
  await prisma.licenseValidationAudit.create({
    data: {
      licenseId: params.licenseId,
      activationId: params.activationId,
      instanceId: params.instanceId,
      status: params.status,
      enforcementMode: params.enforcementMode,
      reasonCode: params.reasonCode,
      domain: params.domain,
      keyHash: params.keyHash,
      fingerprintHash: params.fingerprintHash,
      buildDigestHash: params.buildDigestHash,
      requestIp: params.requestIp,
      userAgent: params.userAgent ? params.userAgent.slice(0, 200) : undefined,
    },
  });
}

function toResult(
  status: LicenseStatus | "INVALID",
  enforcementMode: LicenseEnforcementMode,
  message: string,
  now: Date,
  options?: {
    expiresAt?: Date | null;
    graceEndsAt?: Date | null;
    reasonCode?: string;
    license?: License;
    activation?: LicenseActivation | null;
  }
): LicenseCheckResult {
  return {
    status,
    enforcementMode,
    message,
    serverTime: now.toISOString(),
    expiresAt: options?.expiresAt ? options.expiresAt.toISOString() : null,
    graceEndsAt: options?.graceEndsAt ? options.graceEndsAt.toISOString() : null,
    reasonCode: options?.reasonCode,
    license: options?.license,
    activation: options?.activation,
  };
}

export async function runLicenseTransitions(prisma: PrismaClient, config: LicenseConfig): Promise<number> {
  const now = new Date();
  const candidates = await prisma.license.findMany({
    where: {
      status: { in: ["ACTIVE", "GRACE"] },
    },
  });

  let changed = 0;
  for (const license of candidates) {
    const derived = getDerivedStatus(license, now);
    let nextStatus = derived;
    let graceEndsAt = license.graceEndsAt;

    if (license.status === "ACTIVE" && derived === "EXPIRED" && config.graceDays > 0) {
      nextStatus = "GRACE";
      graceEndsAt = addDays(license.expiresAt, config.graceDays);
    }

    if (nextStatus !== license.status || String(graceEndsAt) !== String(license.graceEndsAt)) {
      await prisma.license.update({
        where: { id: license.id },
        data: {
          status: nextStatus,
          graceEndsAt,
          suspendedAt: nextStatus === "SUSPENDED" ? now : license.suspendedAt,
        },
      });
      changed += 1;
      writeAuditLog({
        action: "LICENSE_STATUS_CHANGED",
        targetId: license.id,
        targetType: "license",
        details: { from: license.status, to: nextStatus },
      });
    }
  }
  return changed;
}

export async function validateLicense(
  prisma: PrismaClient,
  config: LicenseConfig,
  input: LicenseCheckInput
): Promise<LicenseCheckResult> {
  const now = new Date();
  const domain = normalizeDomain(input.domain);
  const keyHash = hashLicenseValue(input.licenceKey);
  const fingerprintHash = hashLicenseValue(input.fingerprint);
  const buildDigestHash = input.buildDigest ? hashLicenseValue(input.buildDigest) : undefined;

  let license = await prisma.license.findUnique({
    where: { keyHash },
    include: {
      activations: {
        where: { instanceId: input.instanceId },
        take: 1,
      },
    },
  });

  const central = await validateWithCentralServer(config, input);
  if (!license && central && central.status !== "INVALID") {
    const expiresAt = central.expiresAt || addDays(now, config.defaultValidityDays);
    const graceEndsAt = central.graceEndsAt || addDays(expiresAt, config.graceDays);
    const created = await prisma.license.create({
      data: {
        keyHash,
        keyLast4: input.licenceKey.slice(-4),
        status: central.status,
        expiresAt,
        graceEndsAt,
        boundDomain: domain,
      },
    });
    license = { ...created, activations: [] } as License & { activations: LicenseActivation[] };
  }

  if (!license && !central && config.allowOfflineActivation) {
    const normalizedKey = input.licenceKey.trim().toUpperCase();
    const expiresAt = addDays(now, config.defaultValidityDays);
    const graceEndsAt = addDays(expiresAt, config.graceDays);
    const created = await prisma.license.create({
      data: {
        keyHash,
        keyLast4: normalizedKey.slice(-4),
        status: "ACTIVE",
        expiresAt,
        graceEndsAt,
        boundDomain: domain,
        metadata: JSON.stringify({ source: "offline_fallback", centralUrl: config.centralValidateUrl }),
      },
    });
    logger.warn("License activated via offline fallback", {
      licenseId: created.id,
      domain,
    });
    license = { ...created, activations: [] } as License & { activations: LicenseActivation[] };
  }

  if (!license) {
    await writeValidationAudit(prisma, {
      instanceId: input.instanceId,
      status: "LOCKOUT",
      enforcementMode: "LOCKOUT",
      reasonCode: "KEY_NOT_FOUND",
      domain,
      keyHash,
      fingerprintHash,
      buildDigestHash,
      requestIp: input.ipAddress,
      userAgent: input.userAgent,
    });
    return toResult("INVALID", "LOCKOUT", "Invalid licence key.", now, { reasonCode: "KEY_NOT_FOUND" });
  }

  const allowedDomains = license.allowedDomains ? (JSON.parse(license.allowedDomains) as string[]) : [];
  if (allowedDomains.length > 0 && !allowedDomains.map(normalizeDomain).includes(domain)) {
    await writeValidationAudit(prisma, {
      licenseId: license.id,
      instanceId: input.instanceId,
      status: "LOCKOUT",
      enforcementMode: "LOCKOUT",
      reasonCode: "DOMAIN_NOT_ALLOWED",
      domain,
      keyHash,
      fingerprintHash,
      buildDigestHash,
      requestIp: input.ipAddress,
      userAgent: input.userAgent,
    });
    return toResult("INVALID", "LOCKOUT", "Domain is not authorized for this licence.", now, {
      reasonCode: "DOMAIN_NOT_ALLOWED",
      expiresAt: license.expiresAt,
      graceEndsAt: license.graceEndsAt,
      license,
    });
  }

  if (license.boundDomain && normalizeDomain(license.boundDomain) !== domain) {
    await writeValidationAudit(prisma, {
      licenseId: license.id,
      instanceId: input.instanceId,
      status: "LOCKOUT",
      enforcementMode: "LOCKOUT",
      reasonCode: "DOMAIN_MISMATCH",
      domain,
      keyHash,
      fingerprintHash,
      buildDigestHash,
      requestIp: input.ipAddress,
      userAgent: input.userAgent,
    });
    return toResult("INVALID", "LOCKOUT", "Licence is bound to a different domain.", now, {
      reasonCode: "DOMAIN_MISMATCH",
      expiresAt: license.expiresAt,
      graceEndsAt: license.graceEndsAt,
      license,
    });
  }

  const activation = license.activations[0] ?? null;
  if (config.buildSignaturePolicy) {
    if (!input.buildDigest) {
      return toResult("INVALID", "LOCKOUT", "Build signature required.", now, {
        reasonCode: "BUILD_DIGEST_REQUIRED",
        expiresAt: license.expiresAt,
        graceEndsAt: license.graceEndsAt,
        license,
      });
    }
    if (activation?.buildDigest && activation.buildDigest !== input.buildDigest) {
      return toResult("INVALID", "LOCKOUT", "Build signature mismatch.", now, {
        reasonCode: "BUILD_DIGEST_MISMATCH",
        expiresAt: license.expiresAt,
        graceEndsAt: license.graceEndsAt,
        license,
        activation,
      });
    }
  }

  let normalizedLicense = license;
  if (central && central.status !== "INVALID") {
    const expiresAt = central.expiresAt || license.expiresAt;
    const graceEndsAt = central.graceEndsAt || license.graceEndsAt || addDays(expiresAt, config.graceDays);
    const centralRevoked = central.status === "REVOKED";
    normalizedLicense = await prisma.license.update({
      where: { id: license.id },
      data: {
        status: central.status,
        expiresAt,
        graceEndsAt,
        boundDomain: license.boundDomain || domain,
        revokedAt: centralRevoked ? (license.revokedAt || now) : null,
      },
    });
  }

  const derivedStatus = getDerivedStatus(normalizedLicense, now);
  const statusToPersist =
    normalizedLicense.status === "ACTIVE" && derivedStatus === "EXPIRED" && config.graceDays > 0
      ? "GRACE"
      : derivedStatus;

  let graceEndsAt = normalizedLicense.graceEndsAt;
  if (statusToPersist === "GRACE" && !graceEndsAt) {
    graceEndsAt = addDays(normalizedLicense.expiresAt, config.graceDays);
  }

  const persistedLicense =
    statusToPersist !== normalizedLicense.status || String(graceEndsAt) !== String(normalizedLicense.graceEndsAt) || !normalizedLicense.boundDomain
      ? await prisma.license.update({
          where: { id: normalizedLicense.id },
          data: {
            status: statusToPersist,
            graceEndsAt,
            boundDomain: normalizedLicense.boundDomain || domain,
            suspendedAt: statusToPersist === "SUSPENDED" ? now : normalizedLicense.suspendedAt,
          },
        })
      : normalizedLicense;

  const enforcementMode = mapStatusToEnforcement(persistedLicense.status, config);
  const validationStatus: LicenseValidationResult =
    enforcementMode === "OK"
      ? "OK"
      : enforcementMode === "WARN_GRACE"
      ? "WARN_GRACE"
      : enforcementMode === "READ_ONLY"
      ? "READ_ONLY"
      : enforcementMode === "SUSPEND_ADMIN"
      ? "SUSPEND_ADMIN"
      : "LOCKOUT";

  if (activation) {
    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: {
        fingerprintHash,
        domain,
        productVersion: input.productVersion,
        buildDigest: input.buildDigest,
        lastValidatedAt: now,
        lastValidationStatus: validationStatus,
      },
    });
  }

  await writeValidationAudit(prisma, {
    licenseId: persistedLicense.id,
    activationId: activation?.id,
    instanceId: input.instanceId,
    status: validationStatus,
    enforcementMode,
    reasonCode: persistedLicense.status,
    domain,
    keyHash,
    fingerprintHash,
    buildDigestHash,
    requestIp: input.ipAddress,
    userAgent: input.userAgent,
  });

  const messageMap: Record<LicenseStatus, string> = {
    ACTIVE: "Licence is active.",
    GRACE: "Licence is in grace period. Please renew soon.",
    SUSPENDED: "Licence is suspended.",
    EXPIRED: "Licence has expired.",
    REVOKED: "Licence has been revoked.",
  };

  logger.info("License validated", {
    licenseId: persistedLicense.id,
    status: persistedLicense.status,
    enforcementMode,
    domain,
    instanceId: input.instanceId,
  });

  return toResult(persistedLicense.status, enforcementMode, messageMap[persistedLicense.status], now, {
    expiresAt: persistedLicense.expiresAt,
    graceEndsAt: persistedLicense.graceEndsAt,
    reasonCode: persistedLicense.status,
    license: persistedLicense,
    activation,
  });
}

export function generateLicenseKey(signingSecret: string): string {
  const random = crypto.randomBytes(16).toString("hex").toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  const signature = crypto
    .createHmac("sha256", signingSecret)
    .update(`${random}:${stamp}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `LIC-${stamp}-${random.slice(0, 8)}-${random.slice(8, 16)}-${signature}`;
}

export async function applyRenewalPaid(
  prisma: PrismaClient,
  params: { renewalId: string; transactionId?: string; paidAt?: Date; periodMonths?: number },
  config: LicenseConfig
): Promise<void> {
  const renewal = await prisma.licenseRenewal.findUnique({
    where: { id: params.renewalId },
    include: { license: true },
  });
  if (!renewal) throw new Error("Renewal not found");
  if (renewal.paymentStatus === "PAID") return;

  const paidAt = params.paidAt || new Date();
  const base = renewal.license.expiresAt > paidAt ? renewal.license.expiresAt : paidAt;
  const periodMonths = params.periodMonths || renewal.periodMonths || 12;
  const endsAt = addMonths(base, periodMonths);
  const graceEndsAt = addDays(endsAt, config.graceDays);

  await prisma.$transaction([
    prisma.licenseRenewal.update({
      where: { id: renewal.id },
      data: {
        paymentStatus: "PAID",
        transactionId: params.transactionId || renewal.transactionId,
        paidAt,
        startsAt: base,
        endsAt,
      },
    }),
    prisma.license.update({
      where: { id: renewal.licenseId },
      data: {
        status: "ACTIVE",
        expiresAt: endsAt,
        graceEndsAt,
        latestRenewalFailedAt: null,
      },
    }),
  ]);

  writeAuditLog({
    action: "LICENSE_RENEWAL_SUCCESS",
    targetId: renewal.licenseId,
    targetType: "license",
    details: { renewalId: renewal.id, endsAt: endsAt.toISOString() },
  });
}

export async function applyRenewalFailed(
  prisma: PrismaClient,
  params: { renewalId: string; reason?: string },
  config: LicenseConfig
): Promise<void> {
  const renewal = await prisma.licenseRenewal.findUnique({
    where: { id: params.renewalId },
    include: { license: true },
  });
  if (!renewal) throw new Error("Renewal not found");

  const now = new Date();
  const graceEndsAt = renewal.license.graceEndsAt || addDays(now, config.graceDays);

  await prisma.$transaction([
    prisma.licenseRenewal.update({
      where: { id: renewal.id },
      data: {
        paymentStatus: "FAILED",
        failedAt: now,
        failureReason: params.reason || "payment_failed",
      },
    }),
    prisma.license.update({
      where: { id: renewal.licenseId },
      data: {
        status: "GRACE",
        graceEndsAt,
        latestRenewalFailedAt: now,
      },
    }),
  ]);

  writeAuditLog({
    action: "LICENSE_RENEWAL_FAILED",
    targetId: renewal.licenseId,
    targetType: "license",
    details: { renewalId: renewal.id, reason: params.reason || "payment_failed" },
  });
}
