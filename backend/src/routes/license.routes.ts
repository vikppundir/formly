import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { ACCESS_COOKIE } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import {
  applyRenewalFailed,
  applyRenewalPaid,
  generateLicenseKey,
  hashLicenseValue,
  loadLicenseConfig,
  normalizeDomain,
  runLicenseTransitions,
  validateLicense,
} from "../services/license.service.js";
import {
  licenceActivationSchema,
  licenceIssueSchema,
  licenceRenewalCheckoutSchema,
  licenceRenewalVerifySchema,
  licenceSettingsSchema,
  licenceStatusSchema,
  licenceValidateSchema,
} from "../validations/license.validation.js";
import { writeAuditLog } from "../utils/logger.js";
import Stripe from "stripe";

const LICENCE_KEYS = [
  "licence_signing_secret",
  "licence_default_validity_days",
  "licence_grace_days",
  "licence_enforcement_active",
  "licence_enforcement_grace",
  "licence_enforcement_suspended",
  "licence_enforcement_expired",
  "licence_enforcement_revoked",
  "licence_build_signature_policy",
  "licence_central_validate_url",
  "licence_central_api_key",
  "licence_central_timeout_ms",
  "licence_allow_offline_activation",
];

export async function registerLicenseRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const settingsRepo = createSettingsRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);
  function getOptionalUserId(request: FastifyRequest): string | null {
    const token =
      (request.cookies?.[ACCESS_COOKIE] as string | undefined) ||
      (request.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const payload = authService.verifyAccessToken(token);
    return payload?.sub || null;
  }

  const requireManageSettings = requirePermission("manage_settings");

  async function getStripe(): Promise<Stripe | null> {
    const secretKey = await settingsRepo.getValue("stripe_secret_key");
    if (!secretKey) return null;
    // @ts-ignore Stripe runtime version
    return new Stripe(secretKey);
  }

  async function getLicenseForUser(userId: string) {
    const activation = await prisma.licenseActivation.findFirst({
      where: { userId },
      include: { license: true },
      orderBy: { updatedAt: "desc" },
    });
    return activation?.license ?? null;
  }

  app.get(
    "/admin/licence/settings",
    { preHandler: [authMiddleware, requireManageSettings] },
    async (_request, reply) => {
      const config = await loadLicenseConfig(settingsRepo);
      return reply.send({
        settings: {
          licence_signing_secret: config.signingSecret,
          licence_default_validity_days: String(config.defaultValidityDays),
          licence_grace_days: String(config.graceDays),
          licence_enforcement_active: "OK",
          licence_enforcement_grace: "WARN_GRACE",
          licence_enforcement_suspended: config.enforcementMap.SUSPENDED,
          licence_enforcement_expired: "LOCKOUT",
          licence_enforcement_revoked: "LOCKOUT",
          licence_build_signature_policy: String(config.buildSignaturePolicy),
          licence_central_validate_url: config.centralValidateUrl,
          licence_central_api_key: config.centralApiKey,
          licence_central_timeout_ms: String(config.centralTimeoutMs),
          licence_allow_offline_activation: String(config.allowOfflineActivation),
        },
      });
    }
  );

  app.put(
    "/admin/licence/settings",
    { preHandler: [authMiddleware, requireManageSettings] },
    async (request, reply) => {
      const parsed = licenceSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      await settingsRepo.bulkUpdate(
        LICENCE_KEYS.map((key) => ({
          key,
          value: String((parsed.data as Record<string, unknown>)[key] ?? ""),
        }))
      );

      const req = request as AuthenticatedRequest;
      writeAuditLog({
        action: "SETTINGS_UPDATED",
        userId: req.user?.sub,
        targetType: "license_settings",
        ipAddress: request.ip,
        details: { keys: LICENCE_KEYS },
      });

      return reply.send({ ok: true, message: "Licence settings updated successfully." });
    }
  );

  app.post(
    "/admin/licence/issue",
    { preHandler: [authMiddleware, requireManageSettings] },
    async (request, reply) => {
      const parsed = licenceIssueSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const config = await loadLicenseConfig(settingsRepo);
      const validityDays = parsed.data.validityDays ?? config.defaultValidityDays;
      const key = generateLicenseKey(config.signingSecret);
      const keyHash = hashLicenseValue(key);
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + validityDays);
      const graceEndsAt = new Date(expiresAt);
      graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + config.graceDays);

      const req = request as AuthenticatedRequest;
      const record = await prisma.license.create({
        data: {
          keyHash,
          keyLast4: key.slice(-4),
          status: "ACTIVE",
          expiresAt,
          graceEndsAt,
          allowedDomains: parsed.data.allowedDomains ? JSON.stringify(parsed.data.allowedDomains.map(normalizeDomain)) : null,
          metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
          createdByUserId: req.user?.sub,
        },
      });

      writeAuditLog({
        action: "LICENSE_ISSUED",
        userId: req.user?.sub,
        targetId: record.id,
        targetType: "license",
        ipAddress: request.ip,
        details: { expiresAt: record.expiresAt.toISOString(), allowedDomains: parsed.data.allowedDomains ?? [] },
      });

      return reply.status(201).send({
        id: record.id,
        licenceKey: key,
        expiresAt: record.expiresAt,
        graceEndsAt: record.graceEndsAt,
      });
    }
  );

  const validateHandler = async (request: FastifyRequest, reply: any) => {
    const parsed = licenceValidateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const config = await loadLicenseConfig(settingsRepo);
    const result = await validateLicense(prisma, config, {
      licenceKey: parsed.data.licenceKey!,
      instanceId: parsed.data.instanceId!,
      fingerprint: parsed.data.fingerprint!,
      domain: parsed.data.domain!,
      productVersion: parsed.data.productVersion,
      buildDigest: parsed.data.buildDigest,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    if (result.status === "INVALID") {
      writeAuditLog({
        action: "LICENSE_VALIDATION_FAILED",
        targetType: "license",
        ipAddress: request.ip,
        details: { reasonCode: result.reasonCode, instanceId: parsed.data.instanceId },
      });
    }
    return reply.send({
      status: result.status,
      expiresAt: result.expiresAt,
      graceEndsAt: result.graceEndsAt,
      enforcementMode: result.enforcementMode,
      message: result.message,
      serverTime: result.serverTime,
      reasonCode: result.reasonCode,
    });
  };

  app.post("/license/validate", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    handler: validateHandler,
  });
  app.post("/api/license/validate", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    handler: validateHandler,
  });

  app.post(
    "/license/activate",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = licenceActivationSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const config = await loadLicenseConfig(settingsRepo);
      const domain = normalizeDomain(parsed.data.domain);
      const incomingKeyHash = hashLicenseValue(parsed.data.licenceKey);
      const existingByKey = await prisma.license.findUnique({ where: { keyHash: incomingKeyHash } });
      if (existingByKey && !existingByKey.boundDomain && (existingByKey.status === "REVOKED" || Boolean(existingByKey.revokedAt))) {
        await prisma.license.update({
          where: { id: existingByKey.id },
          data: {
            status: existingByKey.expiresAt > new Date() ? "ACTIVE" : "EXPIRED",
            revokedAt: null,
          },
        });
      }
      const alreadyBound = await prisma.license.findFirst({
        where: {
          boundDomain: domain,
          status: { in: ["ACTIVE", "GRACE", "SUSPENDED"] },
        },
      });
      if (alreadyBound && alreadyBound.keyHash !== incomingKeyHash) {
        return reply.status(409).send({
          error: "Domain already licensed",
          message: "This domain is already bound to another licence key.",
          enforcementMode: "LOCKOUT",
          status: "INVALID",
        });
      }
      const result = await validateLicense(prisma, config, {
        licenceKey: parsed.data.licenceKey!,
        instanceId: parsed.data.instanceId!,
        fingerprint: parsed.data.fingerprint!,
        domain: domain,
        productVersion: parsed.data.productVersion,
        buildDigest: parsed.data.buildDigest,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      if (!result.license) {
        return reply.status(400).send(result);
      }
      if (result.enforcementMode === "LOCKOUT" || result.enforcementMode === "SUSPEND_ADMIN") {
        return reply.status(400).send(result);
      }

      const fingerprintHash = hashLicenseValue(parsed.data.fingerprint);
      const activation = await prisma.licenseActivation.upsert({
        where: {
          licenseId_instanceId: {
            licenseId: result.license.id,
            instanceId: parsed.data.instanceId,
          },
        },
        update: {
          userId: getOptionalUserId(request),
          fingerprintHash,
          domain,
          productVersion: parsed.data.productVersion,
          buildDigest: parsed.data.buildDigest,
          lastValidatedAt: new Date(),
          lastValidationStatus: result.enforcementMode === "WARN_GRACE" ? "WARN_GRACE" : "OK",
        },
        create: {
          licenseId: result.license.id,
          userId: getOptionalUserId(request),
          instanceId: parsed.data.instanceId,
          fingerprintHash,
          domain,
          productVersion: parsed.data.productVersion,
          buildDigest: parsed.data.buildDigest,
          lastValidatedAt: new Date(),
          lastValidationStatus: result.enforcementMode === "WARN_GRACE" ? "WARN_GRACE" : "OK",
        },
      });

      writeAuditLog({
        action: "LICENSE_ACTIVATED",
        targetId: result.license.id,
        targetType: "license",
        ipAddress: request.ip,
        details: {
          activationId: activation.id,
          instanceId: parsed.data.instanceId,
          domain: normalizeDomain(parsed.data.domain),
        },
      });

      return reply.send({
        ...result,
        activationId: activation.id,
      });
    }
  );

  app.post(
    "/internal/license/hooks/domain-removed",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = (request.body || {}) as {
        licenceKey?: string;
        domain?: string;
        reason?: string;
        ts?: string;
      };
      const hookSecret =
        (await settingsRepo.getValue("licence_internal_hook_secret", process.env.LICENSE_INTERNAL_HOOK_SECRET || "")).trim();
      if (!hookSecret) {
        return reply.status(403).send({ error: "Hook secret not configured" });
      }

      const providedSig = String(request.headers["x-license-hook-signature"] || "");
      const ts = String(body.ts || request.headers["x-license-hook-ts"] || "");
      const licenceKey = body.licenceKey?.trim() || "";
      const domain = body.domain ? normalizeDomain(body.domain) : "";

      if (!providedSig || !ts || (!licenceKey && !domain)) {
        return reply.status(400).send({ error: "Invalid hook payload" });
      }
      const ageMs = Math.abs(Date.now() - Number(ts));
      if (!Number.isFinite(Number(ts)) || ageMs > 5 * 60 * 1000) {
        return reply.status(401).send({ error: "Hook timestamp invalid" });
      }
      const payloadToSign = `${licenceKey}:${domain}:${ts}`;
      const expectedSig = crypto.createHmac("sha256", hookSecret).update(payloadToSign).digest("hex");
      const validSig =
        expectedSig.length === providedSig.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig));
      if (!validSig) {
        return reply.status(401).send({ error: "Invalid hook signature" });
      }

      const keyHash = licenceKey ? hashLicenseValue(licenceKey) : null;
      const target = await prisma.license.findFirst({
        where: keyHash
          ? { keyHash }
          : { boundDomain: domain },
      });
      if (!target) return reply.send({ ok: true, updated: false });

      await prisma.$transaction([
        prisma.license.update({
          where: { id: target.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            boundDomain: null,
            suspendedAt: null,
            metadata: JSON.stringify({
              reason: body.reason || "domain_removed_by_manager",
              removedDomain: domain || target.boundDomain || null,
              hook: true,
              at: new Date().toISOString(),
            }),
          },
        }),
        prisma.licenseActivation.deleteMany({
          where: { licenseId: target.id },
        }),
      ]);

      writeAuditLog({
        action: "LICENSE_STATUS_CHANGED",
        targetId: target.id,
        targetType: "license",
        ipAddress: request.ip,
        details: {
          from: target.status,
          to: "REVOKED",
          reason: body.reason || "domain_removed_by_manager",
          domain,
          hook: true,
        },
      });

      return reply.send({ ok: true, updated: true });
    }
  );

  app.post(
    "/license/deactivate",
    { preHandler: [authMiddleware, requireManageSettings], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = (request.body || {}) as { licenceKey?: string };
      const key = body.licenceKey?.trim();
      if (!key) {
        return reply.status(400).send({ error: "licenceKey is required" });
      }

      const keyHash = hashLicenseValue(key);
      const existing = await prisma.license.findUnique({ where: { keyHash } });
      if (!existing) {
        return reply.status(404).send({ error: "Licence not found" });
      }

      const now = new Date();
      const nextStatus = existing.expiresAt > now ? "ACTIVE" : "EXPIRED";

      await prisma.$transaction([
        prisma.license.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            revokedAt: null,
            boundDomain: null,
            suspendedAt: null,
            metadata: JSON.stringify({ reason: "manual_deactivate", at: now.toISOString() }),
          },
        }),
        prisma.licenseActivation.deleteMany({
          where: { licenseId: existing.id },
        }),
      ]);

      const req = request as AuthenticatedRequest;
      writeAuditLog({
        action: "LICENSE_STATUS_CHANGED",
        userId: req.user?.sub,
        targetId: existing.id,
        targetType: "license",
        ipAddress: request.ip,
        details: { from: existing.status, to: nextStatus, reason: "manual_deactivate" },
      });

      // Optional notify central manager to unbind same key/domain.
      try {
        const centralValidateUrl = (await settingsRepo.getValue("licence_central_validate_url", "")).trim();
        const explicitDeactivateUrl = (await settingsRepo.getValue("licence_central_deactivate_url", "")).trim();
        const centralApiKey = (await settingsRepo.getValue("licence_central_api_key", "")).trim();
        const hookTs = String(Date.now());
        const deactivateUrl =
          explicitDeactivateUrl ||
          (centralValidateUrl ? centralValidateUrl.replace(/\/validate$/i, "/hooks/domain-removed") : "");
        if (deactivateUrl) {
          const sigBase = `${key}:${normalizeDomain(existing.boundDomain || "")}:${hookTs}`;
          const signature = centralApiKey
            ? crypto.createHmac("sha256", centralApiKey).update(sigBase).digest("hex")
            : "";
          await fetch(deactivateUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(centralApiKey ? { "x-license-api-key": centralApiKey } : {}),
              ...(signature ? { "x-license-hook-signature": signature } : {}),
              "x-license-hook-ts": hookTs,
            },
            body: JSON.stringify({
              licenceKey: key,
              domain: normalizeDomain(existing.boundDomain || ""),
              reason: "manual_deactivate_local",
              ts: hookTs,
            }),
          });
        }
      } catch {
        // Best effort central sync; local deactivate is source of truth for this app.
      }

      return reply.send({ ok: true, message: "Licence removed. Re-activation required." });
    }
  );

  app.post(
    "/license/status",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = licenceStatusSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const config = await loadLicenseConfig(settingsRepo);
      const result = await validateLicense(prisma, config, {
        licenceKey: parsed.data.licenceKey!,
        instanceId: parsed.data.instanceId!,
        fingerprint: parsed.data.fingerprint!,
        domain: parsed.data.domain!,
        productVersion: parsed.data.productVersion,
        buildDigest: parsed.data.buildDigest,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return reply.send(result);
    }
  );

  app.get(
    "/license/portal/status",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const license = await getLicenseForUser(req.user!.sub);
      if (!license) {
        return reply.send({ hasLicense: false });
      }
      const latestRenewal = await prisma.licenseRenewal.findFirst({
        where: { licenseId: license.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({
        hasLicense: true,
        license: {
          id: license.id,
          status: license.status,
          expiresAt: license.expiresAt,
          graceEndsAt: license.graceEndsAt,
          boundDomain: license.boundDomain,
        },
        latestRenewal,
      });
    }
  );

  app.post(
    "/license/renewal/checkout",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = licenceRenewalCheckoutSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const license = parsed.data.licenceId
        ? await prisma.license.findUnique({ where: { id: parsed.data.licenceId } })
        : await getLicenseForUser(req.user!.sub);
      if (!license) return reply.status(404).send({ error: "Licence not found" });

      const stripe = await getStripe();
      if (!stripe) return reply.status(400).send({ error: "Stripe not configured" });

      const amountSetting = await settingsRepo.getValue("licence_renewal_amount", "299");
      const currency = (await settingsRepo.getValue("payment_currency", "AUD")).toLowerCase();
      const amount = Number.parseFloat(amountSetting);
      if (!Number.isFinite(amount) || amount <= 0) {
        return reply.status(400).send({ error: "Invalid renewal amount configuration" });
      }

      const renewal = await prisma.licenseRenewal.create({
        data: {
          licenseId: license.id,
          paymentStatus: "PENDING",
          amount,
          currency: currency.toUpperCase(),
          periodMonths: 12,
          metadata: JSON.stringify({ requestedByUserId: req.user!.sub }),
        },
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${parsed.data.successUrl}?session_id={CHECKOUT_SESSION_ID}&renewal_id=${renewal.id}`,
        cancel_url: `${parsed.data.cancelUrl}?renewal_id=${renewal.id}`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: "Licence Renewal (12 months)",
                description: `Licence ${license.keyLast4} renewal`,
              },
            },
          },
        ],
        metadata: {
          type: "license_renewal",
          renewalId: renewal.id,
          licenseId: license.id,
          userId: req.user!.sub,
        },
      });

      await prisma.licenseRenewal.update({
        where: { id: renewal.id },
        data: { stripeSessionId: session.id },
      });

      return reply.send({
        renewalId: renewal.id,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }
  );

  app.post(
    "/license/renewal/verify",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = licenceRenewalVerifySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const stripe = await getStripe();
      if (!stripe) return reply.status(400).send({ error: "Stripe not configured" });

      const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
        expand: ["payment_intent"],
      });

      const renewal = await prisma.licenseRenewal.findUnique({
        where: { id: parsed.data.renewalId },
      });
      if (!renewal) {
        return reply.status(404).send({ error: "Renewal not found" });
      }
      const config = await loadLicenseConfig(settingsRepo);

      if (session.payment_status === "paid") {
        const intent = session.payment_intent as Stripe.PaymentIntent | undefined;
        await applyRenewalPaid(
          prisma,
          {
            renewalId: renewal.id,
            transactionId: intent?.id || session.id,
            paidAt: new Date(),
            periodMonths: renewal.periodMonths,
          },
          config
        );
        return reply.send({ ok: true, status: "PAID" });
      }

      await applyRenewalFailed(prisma, { renewalId: renewal.id, reason: session.payment_status }, config);
      return reply.send({ ok: false, status: session.payment_status });
    }
  );

  app.post(
    "/license/cron/transitions",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const expectedSecret = await settingsRepo.getValue("licence_cron_secret", process.env.LICENSE_CRON_SECRET || "");
      if (!expectedSecret || request.headers["x-cron-secret"] !== expectedSecret) {
        return reply.status(401).send({ error: "Unauthorized cron request" });
      }
      const config = await loadLicenseConfig(settingsRepo);
      const changed = await runLicenseTransitions(prisma, config);
      return reply.send({ ok: true, changed });
    }
  );
}
