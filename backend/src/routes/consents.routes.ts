/**
 * Consents Routes - Legal consent tracking
 * Audit trail for authority and consent acceptance (SOC 2 compliant)
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, ConsentType } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createConsentRepository } from "../repositories/consent.repository.js";
import { createAccountRepository } from "../repositories/account.repository.js";
import { createServiceRepository } from "../repositories/service.repository.js";
import { z } from "zod";

// Only account-level consents remain here.
// Terms of Service, Privacy Policy, and DPA are now accepted at registration (User model).
const CONSENT_TYPES: ConsentType[] = [
  "TAX_AGENT_AUTHORITY",
  "ENGAGEMENT_LETTER",
];

// Validation schemas
const acceptConsentSchema = z.object({
  accountId: z.string(),
  consentTypes: z.array(z.enum([
    "TERMS_OF_SERVICE",
    "PRIVACY_POLICY",
    "TAX_AGENT_AUTHORITY",
    "ENGAGEMENT_LETTER",
    "DATA_PROCESSING",
  ])).min(1),
  documentVersion: z.string().optional(),
  signatureData: z.string().optional(), // Base64 encoded signature image
  signatureType: z.enum(["draw", "type"]).optional(),
  signedName: z.string().optional(), // Name if typed signature
});

export async function registerConsentsRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const consentRepo = createConsentRepository(prisma);
  const accountRepo = createAccountRepository(prisma);
  const serviceRepo = createServiceRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // =========================================================================
  // User Consent Endpoints
  // =========================================================================

  // Get consents for an account
  app.get(
    "/consents/account/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const consents = await consentRepo.getForAccount(accountId);
      const givenTypes = new Set(consents.map((c) => c.consentType));
      const missingTypes = CONSENT_TYPES.filter((t) => !givenTypes.has(t));

      return reply.send({
        consents,
        givenTypes: Array.from(givenTypes),
        missingTypes,
        hasAllRequired: await consentRepo.hasRequiredConsents(accountId),
      });
    }
  );

  // Accept consents
  app.post(
    "/consents/accept",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = acceptConsentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, consentTypes, documentVersion, signatureData, signatureType, signedName } = parsed.data;

      // Check account ownership
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Get IP and user agent for audit
      const ipAddress = request.ip || request.headers["x-forwarded-for"]?.toString() || "unknown";
      const userAgent = request.headers["user-agent"] || "unknown";

      // Record consents
      await consentRepo.createMany(
        accountId,
        req.user!.sub,
        consentTypes as ConsentType[],
        { ipAddress, userAgent, documentVersion, signatureData, signatureType, signedName }
      );

      // Check if this enables any pending services
      const hasAllRequired = await consentRepo.hasRequiredConsents(accountId);
      if (hasAllRequired) {
        // Update any CONSENT_REQUIRED services to PENDING
        const services = await serviceRepo.getAccountServices(accountId);
        for (const svc of services) {
          if (svc.status === "CONSENT_REQUIRED") {
            await serviceRepo.updateServiceStatus(svc.id, "PENDING");
          }
        }
      }

      return reply.status(201).send({
        ok: true,
        hasAllRequired,
      });
    }
  );

  // Get required consent types
  app.get(
    "/consents/required",
    async (_request, reply) => {
      return reply.send({
        alwaysRequired: ["TAX_AGENT_AUTHORITY"],
        requiredForNonIndividual: ["ENGAGEMENT_LETTER"],
        all: CONSENT_TYPES,
        note: "TAX_AGENT_AUTHORITY is required for all. ENGAGEMENT_LETTER is required for Company/Trust/Partnership, optional for Individual. Terms of Service, Privacy Policy, and DPA are accepted at registration (user-level).",
      });
    }
  );

  // Check if account has required consents
  app.get(
    "/consents/check/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const hasRequired = await consentRepo.hasRequiredConsents(accountId);
      const missing = await consentRepo.getMissingConsents(accountId);

      return reply.send({ hasRequired, missing, accountType: account.accountType });
    }
  );

  // Get user's consents across all accounts
  app.get(
    "/consents/my",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const consents = await consentRepo.getByUser(req.user!.sub);
      return reply.send({ consents });
    }
  );

  // =========================================================================
  // Admin Consent Endpoints
  // =========================================================================

  // Get consents for a specific account (admin)
  app.get(
    "/admin/consents/account/:accountId",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      const consents = await consentRepo.getForAccount(accountId);
      return reply.send({ consents });
    }
  );

  // Get all consents (admin)
  app.get(
    "/admin/consents",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        consentType?: ConsentType;
        accountId?: string;
      };

      const result = await consentRepo.findAll({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
        consentType: query.consentType,
        accountId: query.accountId,
      });

      return reply.send(result);
    }
  );

  // Get consent statistics (admin)
  app.get(
    "/admin/consents/stats",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (_request, reply) => {
      const stats = await consentRepo.getStats();
      return reply.send({ stats });
    }
  );
}
