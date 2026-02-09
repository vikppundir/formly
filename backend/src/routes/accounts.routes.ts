/**
 * Account Routes - Multi-account management API
 * Users can create, view, and manage multiple accounts
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, AccountType, AccountStatus } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createAccountRepository, maskAccountTfns } from "../repositories/account.repository.js";
import { createConsentRepository } from "../repositories/consent.repository.js";
import { writeAuditLog } from "../utils/logger.js";
import { safeHmacField } from "../utils/encryption.js";
import { z } from "zod";

// Validation schemas
const createAccountSchema = z.object({
  accountType: z.enum(["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"]),
  name: z.string().min(2).max(200),
});

// Strict schemas - no .passthrough() to prevent mass assignment
const individualProfileSchema = z.object({
  tfn: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  streetAddress: z.string().optional().nullable(), // Maps to 'address' in DB
  address: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  employerName: z.string().optional().nullable(),
  // ABN fields
  hasAbn: z.boolean().optional().nullable(),
  abn: z.string().optional().nullable(),
  abnRegisteredName: z.string().optional().nullable(),
  abnStatus: z.string().optional().nullable(),
  // GST
  gstRegistered: z.boolean().optional().nullable(),
  // Medical card
  hasMedicalCard: z.boolean().optional().nullable(),
  // Marital status & spouse
  maritalStatus: z.string().optional().nullable(),
  spouseInAustralia: z.boolean().optional().nullable(),
  spouseName: z.string().optional().nullable(),
  spouseFirstName: z.string().optional().nullable(),
  spouseLastName: z.string().optional().nullable(),
  spouseEmail: z.string().optional().nullable(),
  spouseDob: z.string().optional().nullable(),
  spouseIncome: z.union([z.string(), z.number()]).optional().nullable(),
  spouseUserId: z.string().optional().nullable(),
  spouseStatus: z.string().optional().nullable(),
  // Rental income flag
  hasRentalIncome: z.boolean().optional().nullable(),
}).strip();

const companyProfileSchema = z.object({
  companyName: z.string().optional().nullable(),
  tradingName: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  acn: z.string().optional().nullable(),
  tfn: z.string().optional().nullable(),
  // Registered Business Address
  businessAddress: z.string().optional().nullable(),
  businessSuburb: z.string().optional().nullable(),
  businessState: z.string().optional().nullable(),
  businessPostcode: z.string().optional().nullable(),
  // Postal Address
  postalSameAsBusiness: z.boolean().optional().nullable(),
  postalAddress: z.string().optional().nullable(),
  postalSuburb: z.string().optional().nullable(),
  postalState: z.string().optional().nullable(),
  postalPostcode: z.string().optional().nullable(),
  // Industry
  industry: z.string().optional().nullable(),
  industrySector: z.string().optional().nullable(),
  businessDescription: z.string().optional().nullable(),
  // Directors
  directorCount: z.number().int().min(1).optional().nullable(),
  // Self (account owner) director/shareholder flags
  selfIsDirector: z.boolean().optional().nullable(),
  selfIsShareholder: z.boolean().optional().nullable(),
  selfShareCount: z.number().int().min(0).optional().nullable(),
  // Other
  financialYearEnd: z.string().optional().nullable(),
  gstRegistered: z.boolean().optional().nullable(),
  // Legacy compat
  registeredAddress: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
}).strip();

const trustProfileSchema = z.object({
  trustName: z.string().optional().nullable(),
  trustType: z.enum(["DISCRETIONARY", "UNIT", "HYBRID", "SMSF", "TESTAMENTARY", "OTHER"]).optional().nullable(),
  tfn: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  trusteeDetails: z.union([
    z.array(z.object({ name: z.string(), type: z.string() }).strip()),
    z.string(), // Also accept JSON string
  ]).optional().nullable(),
  beneficiaries: z.union([
    z.array(z.object({ name: z.string(), allocation: z.number().optional() }).strip()),
    z.string(), // Also accept JSON string
  ]).optional().nullable(),
}).strip();

const partnershipProfileSchema = z.object({
  partnershipName: z.string().optional().nullable(),
  tradingName: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  tfn: z.string().optional().nullable(),
  businessAddress: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  // Self (account owner) partner details
  selfRole: z.string().optional().nullable(),
  selfOwnershipPercent: z.number().min(0).max(100).optional().nullable(),
  partners: z.union([
    z.array(z.object({ name: z.string(), email: z.string(), ownership: z.number() }).strip()),
    z.string(), // Also accept JSON string
  ]).optional().nullable(),
}).strip();

export async function registerAccountsRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const accountRepo = createAccountRepository(prisma);
  const consentRepo = createConsentRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // =========================================================================
  // User Account Endpoints
  // =========================================================================

  // Get all accounts for current user
  app.get(
    "/accounts",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const accounts = await accountRepo.findByUser(req.user!.sub);
      // Mask TFN for user-facing API — only last 2 digits visible
      const masked = accounts.map((a) => maskAccountTfns(a as unknown as Record<string, unknown>));
      return reply.send({ accounts: masked });
    }
  );

  // Get single account by ID
  app.get(
    "/accounts/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }

      // Check ownership
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Get missing consents
      const missingConsents = await consentRepo.getMissingConsents(id);

      // Mask TFN for user-facing API — only last 2 digits visible
      const maskedAccount = maskAccountTfns(account as unknown as Record<string, unknown>);
      return reply.send({ account: maskedAccount, missingConsents });
    }
  );

  // Create new account
  app.post(
    "/accounts",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const account = await accountRepo.create({
        userId: req.user!.sub,
        accountType: parsed.data.accountType as AccountType,
        name: parsed.data.name,
      });

      return reply.status(201).send({ account });
    }
  );

  // Update account profile (type-specific) - supports both PUT and PATCH
  app.patch(
    "/accounts/:id/profile",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Support both { profile: {...} } and direct body format
      const body = request.body as Record<string, unknown>;
      const profileData = body.profile ? (body.profile as Record<string, unknown>) : body;

      try {
        let profile;
        switch (account.accountType) {
          case "INDIVIDUAL": {
            // For PATCH, make all fields optional
            const parsed = individualProfileSchema.partial().safeParse(profileData);
            if (!parsed.success) {
              return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
            }
            // Map frontend fields to DB fields
            const { streetAddress, dateOfBirth, spouseDob, spouseIncome, ...rest } = parsed.data;
            
            // Handle address mapping - prefer streetAddress, fallback to address
            const addressValue = streetAddress ?? rest.address;
            
            // Handle dateOfBirth - convert valid string to Date, empty/null to null
            let dateValue: Date | null | undefined = undefined;
            if (dateOfBirth !== undefined) {
              dateValue = dateOfBirth && dateOfBirth.trim() !== '' ? new Date(dateOfBirth) : null;
            }

            // Handle spouseDob - same conversion
            let spouseDobValue: Date | null | undefined = undefined;
            if (spouseDob !== undefined) {
              spouseDobValue = spouseDob && String(spouseDob).trim() !== '' ? new Date(String(spouseDob)) : null;
            }

            // Handle spouseIncome - convert to number
            let spouseIncomeValue: number | null | undefined = undefined;
            if (spouseIncome !== undefined) {
              spouseIncomeValue = spouseIncome ? Number(spouseIncome) : null;
            }

            // TFN uniqueness check - one TFN per active account only
            // Uses HMAC-SHA256 hash for lookup (TFN is encrypted in DB, can't search plaintext)
            const tfnValue = rest.tfn;
            if (tfnValue && tfnValue.trim() !== "") {
              const cleanTfn = tfnValue.replace(/\s/g, "");
              const tfnHash = safeHmacField(cleanTfn);
              if (tfnHash) {
                const existingTfn = await prisma.individualProfile.findFirst({
                  where: {
                    tfnHash: tfnHash,
                    accountId: { not: id },
                  },
                  include: {
                    account: { select: { id: true, name: true, status: true } },
                  },
                });
                if (existingTfn) {
                  const acctStatus = existingTfn.account.status;
                  const acctName = existingTfn.account.name;
                  if (acctStatus === "CLOSED") {
                    // TFN is on a closed account - allow reuse (it's disabled)
                  } else {
                    return reply.status(409).send({
                      error: "TFN already in use",
                      message: `This TFN is already linked to account "${acctName}" (${acctStatus}). Only one active account can use the same TFN. Please disable/close that account first, then you can add the TFN here.`,
                      existingAccountId: existingTfn.account.id,
                      existingAccountName: acctName,
                      existingAccountStatus: acctStatus,
                    });
                  }
                }
              }
              // Pass cleaned plaintext TFN to repository (repo handles encryption)
              rest.tfn = cleanTfn;
            }
            
            profile = await accountRepo.upsertIndividualProfile(id, {
              ...rest,
              address: addressValue,
              dateOfBirth: dateValue,
              spouseDob: spouseDobValue,
              spouseIncome: spouseIncomeValue,
            });
            break;
          }
          case "COMPANY": {
            const parsed = companyProfileSchema.partial().safeParse(profileData);
            if (!parsed.success) {
              return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
            }

            // Handle TFN encryption for Company (same pattern as Individual)
            const companyData = { ...parsed.data };
            const companyTfn = companyData.tfn;
            if (companyTfn && companyTfn.trim() !== "") {
              const cleanTfn = companyTfn.replace(/\s/g, "");
              const tfnHash = safeHmacField(cleanTfn);
              if (tfnHash) {
                const existingTfn = await prisma.companyProfile.findFirst({
                  where: { tfnHash, accountId: { not: id } },
                  include: { account: { select: { id: true, name: true, status: true } } },
                });
                if (existingTfn && existingTfn.account.status !== "CLOSED") {
                  return reply.status(409).send({
                    error: "TFN already in use",
                    message: `This TFN is already linked to company "${existingTfn.account.name}".`,
                  });
                }
              }
              companyData.tfn = cleanTfn;
            }

            profile = await accountRepo.upsertCompanyProfile(id, companyData as Record<string, unknown>);
            break;
          }
          case "TRUST": {
            const parsed = trustProfileSchema.partial().safeParse(profileData);
            if (!parsed.success) {
              return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
            }
            // Stringify arrays if needed for DB storage
            const trustData = {
              ...parsed.data,
              trusteeDetails: Array.isArray(parsed.data.trusteeDetails) ? JSON.stringify(parsed.data.trusteeDetails) : parsed.data.trusteeDetails,
              beneficiaries: Array.isArray(parsed.data.beneficiaries) ? JSON.stringify(parsed.data.beneficiaries) : parsed.data.beneficiaries,
            };
            profile = await accountRepo.upsertTrustProfile(id, trustData);
            break;
          }
          case "PARTNERSHIP": {
            const parsed = partnershipProfileSchema.partial().safeParse(profileData);
            if (!parsed.success) {
              return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
            }
            // Stringify arrays if needed for DB storage
            const partnershipData = {
              ...parsed.data,
              partners: Array.isArray(parsed.data.partners) ? JSON.stringify(parsed.data.partners) : parsed.data.partners,
            };
            profile = await accountRepo.upsertPartnershipProfile(id, partnershipData);
            break;
          }
        }

        // Mask TFN in returned profile for user-facing API
        if (profile && typeof profile === "object" && "tfn" in profile) {
          const p = profile as Record<string, unknown>;
          const tfnVal = p.tfn as string | null;
          if (tfnVal && tfnVal.length > 2) {
            p.tfn = "*".repeat(tfnVal.length - 2) + tfnVal.slice(-2);
          }
        }
        return reply.send({ profile });
      } catch (err) {
        const logger = await import("../utils/logger.js");
        logger.logger.error("Failed to update profile", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          accountId: id,
          accountType: account.accountType,
        });
        return reply.status(500).send({ error: "Failed to update profile" });
      }
    }
  );

  // Set default account
  app.post(
    "/accounts/:id/set-default",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await accountRepo.setDefault(req.user!.sub, id);
      return reply.send({ ok: true });
    }
  );

  // Submit account for review
  app.post(
    "/accounts/:id/submit",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.status !== "DRAFT") {
        return reply.status(400).send({ error: "Account already submitted" });
      }

      await accountRepo.updateStatus(id, "PENDING_REVIEW");
      return reply.send({ ok: true, status: "PENDING_REVIEW" });
    }
  );

  // Close / remove account (soft delete — sets status to CLOSED)
  app.post(
    "/accounts/:id/close",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.status === "CLOSED") {
        return reply.status(400).send({ error: "Account is already closed" });
      }

      await accountRepo.close(id);
      writeAuditLog({
        action: "ACCOUNT_CLOSED_BY_USER",
        userId: req.user?.sub,
        targetId: id,
        targetType: "Account",
        ipAddress: request.ip,
        details: { previousStatus: account.status, accountName: account.name },
      });
      return reply.send({ ok: true });
    }
  );

  // Reopen a closed account (user can self-serve)
  app.post(
    "/accounts/:id/reopen",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.status !== "CLOSED") {
        return reply.status(400).send({ error: "Only closed accounts can be reopened" });
      }

      await accountRepo.reopen(id);
      writeAuditLog({
        action: "ACCOUNT_REOPENED_BY_USER",
        userId: req.user?.sub,
        targetId: id,
        targetType: "Account",
        ipAddress: request.ip,
        details: { accountName: account.name },
      });
      return reply.send({ ok: true });
    }
  );

  // Permanent delete — removes account and ALL data from the system
  app.delete(
    "/accounts/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await accountRepo.permanentDelete(id);
      writeAuditLog({
        action: "ACCOUNT_PERMANENTLY_DELETED",
        userId: req.user?.sub,
        targetId: id,
        targetType: "Account",
        ipAddress: request.ip,
        details: { accountName: account.name, accountType: account.accountType },
      });

      return reply.send({ ok: true, deleted: true });
    }
  );

  // Get default account
  app.get(
    "/accounts/default",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const account = await accountRepo.getDefault(req.user!.sub);
      // Mask TFN for user-facing API
      const maskedAccount = account ? maskAccountTfns(account as unknown as Record<string, unknown>) : null;
      return reply.send({ account: maskedAccount });
    }
  );

  // =========================================================================
  // Rental Property CRUD (for Individual accounts)
  // =========================================================================

  const rentalPropertySchema = z.object({
    address: z.string().min(3, "Property address is required"),
    suburb: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    ownershipPercent: z.number().min(0.01, "Ownership must be > 0").max(100, "Ownership cannot exceed 100%"),
  });

  // Add a rental property to an individual account
  app.post(
    "/accounts/:id/rental-properties",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const account = await accountRepo.findById(id);
      if (!account) return reply.status(404).send({ error: "Account not found" });
      if (account.userId !== req.user!.sub) return reply.status(403).send({ error: "Access denied" });
      if (account.accountType !== "INDIVIDUAL") return reply.status(400).send({ error: "Rental properties are only for Individual accounts" });

      const indProfile = (account as unknown as Record<string, unknown>).individualProfile as { id: string } | null;
      if (!indProfile) return reply.status(400).send({ error: "Individual profile not found. Please save your profile first." });

      const parsed = rentalPropertySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });

      const property = await accountRepo.addRentalProperty(indProfile.id, parsed.data);
      return reply.status(201).send({ property });
    }
  );

  // Update a rental property
  app.patch(
    "/accounts/:id/rental-properties/:propertyId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id, propertyId } = request.params as { id: string; propertyId: string };

      const account = await accountRepo.findById(id);
      if (!account) return reply.status(404).send({ error: "Account not found" });
      if (account.userId !== req.user!.sub) return reply.status(403).send({ error: "Access denied" });

      // Verify property belongs to this account's profile
      const existing = await accountRepo.getRentalProperty(propertyId);
      const indProfile = (account as unknown as Record<string, unknown>).individualProfile as { id: string } | null;
      if (!existing || !indProfile || existing.individualProfileId !== indProfile.id) {
        return reply.status(404).send({ error: "Property not found" });
      }

      const parsed = rentalPropertySchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });

      const property = await accountRepo.updateRentalProperty(propertyId, parsed.data);
      return reply.send({ property });
    }
  );

  // Delete a rental property
  app.delete(
    "/accounts/:id/rental-properties/:propertyId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id, propertyId } = request.params as { id: string; propertyId: string };

      const account = await accountRepo.findById(id);
      if (!account) return reply.status(404).send({ error: "Account not found" });
      if (account.userId !== req.user!.sub) return reply.status(403).send({ error: "Access denied" });

      // Verify property belongs to this account's profile
      const existing = await accountRepo.getRentalProperty(propertyId);
      const indProfile = (account as unknown as Record<string, unknown>).individualProfile as { id: string } | null;
      if (!existing || !indProfile || existing.individualProfileId !== indProfile.id) {
        return reply.status(404).send({ error: "Property not found" });
      }

      await accountRepo.deleteRentalProperty(propertyId);
      return reply.send({ ok: true });
    }
  );

  // =========================================================================
  // Admin Account Endpoints
  // =========================================================================

  // Get all accounts (admin)
  app.get(
    "/admin/accounts",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        accountType?: AccountType;
        status?: AccountStatus;
        search?: string;
      };

      const result = await accountRepo.findAll({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        accountType: query.accountType,
        status: query.status,
        search: query.search,
      });

      return reply.send(result);
    }
  );

  // Get account stats (admin)
  app.get(
    "/admin/accounts/stats",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (_request, reply) => {
      const stats = await accountRepo.getStats();
      return reply.send({ stats });
    }
  );

  // Update account status (admin)
  const updateAccountStatusSchema = z.object({
    status: z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "CLOSED"]),
  });

  app.patch(
    "/admin/accounts/:id/status",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateAccountStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const account = await accountRepo.updateStatus(id, parsed.data.status);
      const req = request as AuthenticatedRequest;
      writeAuditLog({
        action: "ACCOUNT_STATUS_CHANGED",
        userId: req.user?.sub,
        targetId: id,
        targetType: "Account",
        ipAddress: request.ip,
        details: { newStatus: parsed.data.status },
      });
      return reply.send({ account });
    }
  );

  // Get account details (admin)
  app.get(
    "/admin/accounts/:id",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const account = await accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      return reply.send({ account });
    }
  );
}
