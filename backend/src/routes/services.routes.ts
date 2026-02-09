/**
 * Services Routes - Admin service management & user purchase
 * Services are account-type aware and purchased per account
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, ServiceStatus } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createServiceRepository } from "../repositories/service.repository.js";
import { createAccountRepository } from "../repositories/account.repository.js";
import { createConsentRepository } from "../repositories/consent.repository.js";
import { z } from "zod";

// Validation schemas
const createServiceSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  allowedTypes: z.array(z.enum(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"])).min(1),
  pricing: z.record(z.number().min(0)),
  requiresConsent: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const updateServiceSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  allowedTypes: z.array(z.enum(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"])).optional(),
  pricing: z.record(z.number().min(0)).optional(),
  requiresConsent: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const purchaseServiceSchema = z.object({
  accountId: z.string(),
  serviceId: z.string(),
  financialYear: z.string().optional(),
  notes: z.string().optional(),
});

export async function registerServicesRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const serviceRepo = createServiceRepository(prisma);
  const accountRepo = createAccountRepository(prisma);
  const consentRepo = createConsentRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // =========================================================================
  // Public/User Endpoints
  // =========================================================================

  // Get services available for an account
  app.get(
    "/services/for-account/:accountId",
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

      const services = await serviceRepo.findForAccountType(account.accountType);

      // Get already purchased services for this account
      const purchased = await serviceRepo.getAccountServices(accountId);
      const purchasedIds = new Set(purchased.map((p) => p.serviceId));

      return reply.send({
        services: services.map((s) => ({
          ...s,
          isPurchased: purchasedIds.has(s.id),
        })),
      });
    }
  );

  // Get services purchased by an account
  app.get(
    "/services/purchased/:accountId",
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

      // Get purchased services with payment info
      const purchases = await prisma.accountService.findMany({
        where: { accountId },
        include: {
          service: true,
        },
        orderBy: { purchasedAt: "desc" },
      });
      
      return reply.send({ purchases });
    }
  );

  // Purchase a service
  app.post(
    "/services/purchase",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = purchaseServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, serviceId, financialYear, notes } = parsed.data;

      // Check account ownership
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Check if account is active
      if (account.status !== "ACTIVE") {
        return reply.status(400).send({ error: "Account must be active to purchase services" });
      }

      // Get service and check availability
      const service = await serviceRepo.findById(serviceId);
      if (!service) {
        return reply.status(404).send({ error: "Service not found" });
      }
      if (!service.isActive) {
        return reply.status(400).send({ error: "Service is not available" });
      }
      if (!service.allowedTypes.includes(account.accountType)) {
        return reply.status(400).send({ error: "Service not available for this account type" });
      }

      // Check if already purchased
      const existing = await serviceRepo.hasService(accountId, serviceId, financialYear);
      if (existing) {
        return reply.status(400).send({ error: "Service already purchased for this financial year" });
      }

      // Get price for account type
      const price = service.pricing[account.accountType];
      if (price === undefined) {
        return reply.status(400).send({ error: "Price not set for this account type" });
      }

      // Check consents if required
      let status: ServiceStatus = "PENDING";
      if (service.requiresConsent) {
        const hasConsents = await consentRepo.hasRequiredConsents(accountId);
        if (!hasConsents) {
          status = "CONSENT_REQUIRED";
        }
      }

      const purchase = await serviceRepo.purchase({
        accountId,
        serviceId,
        price,
        financialYear,
        notes,
      });

      // Update status if consent required
      if (status === "CONSENT_REQUIRED") {
        await serviceRepo.updateServiceStatus(purchase.id, status);
      }

      return reply.status(201).send({ purchase, status });
    }
  );

  // Get service categories
  app.get("/services/categories", async (_request, reply) => {
    const categories = await serviceRepo.getCategories();
    return reply.send({ categories });
  });

  // =========================================================================
  // Admin Service Management
  // =========================================================================

  // Get all services (admin)
  app.get(
    "/admin/services",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        category?: string;
        isActive?: string;
        search?: string;
      };

      const result = await serviceRepo.findAll({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 50,
        category: query.category,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
        search: query.search,
      });

      return reply.send(result);
    }
  );

  // Get service by ID (admin)
  app.get(
    "/admin/services/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const service = await serviceRepo.findById(id);
      if (!service) {
        return reply.status(404).send({ error: "Service not found" });
      }
      return reply.send({ service });
    }
  );

  // Create service (admin)
  app.post(
    "/admin/services",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parsed = createServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // Check if code exists
      const existing = await serviceRepo.findByCode(parsed.data.code);
      if (existing) {
        return reply.status(400).send({ error: "Service code already exists" });
      }

      const service = await serviceRepo.create(parsed.data as any);
      return reply.status(201).send({ service });
    }
  );

  // Update service (admin)
  app.patch(
    "/admin/services/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const service = await serviceRepo.update(id, parsed.data as any);
      return reply.send({ service });
    }
  );

  // Toggle service active (admin)
  app.post(
    "/admin/services/:id/toggle",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const service = await serviceRepo.toggleActive(id);
      if (!service) {
        return reply.status(404).send({ error: "Service not found" });
      }
      return reply.send({ service });
    }
  );

  // Delete service (admin)
  app.delete(
    "/admin/services/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await serviceRepo.delete(id);
        return reply.send({ ok: true });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Get all purchases (admin)
  app.get(
    "/admin/services/purchases",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        status?: ServiceStatus;
        accountId?: string;
        serviceId?: string;
      };

      const result = await serviceRepo.getAllPurchases({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
        status: query.status,
        accountId: query.accountId,
        serviceId: query.serviceId,
      });

      return reply.send(result);
    }
  );

  // Update purchase status (admin)
  const updatePurchaseStatusSchema = z.object({
    status: z.enum(["PENDING", "CONSENT_REQUIRED", "IN_PROGRESS", "REVIEW", "COMPLETED", "CANCELLED"]),
  });

  app.patch(
    "/admin/services/purchases/:id/status",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updatePurchaseStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const purchase = await serviceRepo.updateServiceStatus(id, parsed.data.status);
      return reply.send({ purchase });
    }
  );

  // Get purchase stats (admin)
  app.get(
    "/admin/services/stats",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      const stats = await serviceRepo.getPurchaseStats();
      return reply.send({ stats });
    }
  );
}
