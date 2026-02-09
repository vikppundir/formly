/**
 * Account Repository - Multi-account management
 * One user can have multiple accounts of different types
 *
 * TFN fields are encrypted at rest using AES-256-GCM (application-layer encryption).
 * A deterministic HMAC-SHA256 hash (tfnHash) is stored alongside for uniqueness lookups.
 */

import type { PrismaClient, AccountType, AccountStatus, Prisma } from "@prisma/client";
import { safeEncryptField, safeDecryptField, safeHmacField } from "../utils/encryption.js";

// Fields that contain encrypted TFN data across all profile types
const TFN_FIELD = "tfn" as const;

/**
 * Mask a TFN for user-facing display — only last 2 digits visible.
 * e.g. "987654321" → "*******21"
 */
function maskTfnValue(tfn: string | null | undefined): string | null {
  if (!tfn) return null;
  if (tfn.length <= 2) return tfn;
  return "*".repeat(tfn.length - 2) + tfn.slice(-2);
}

/**
 * Decrypt TFN in a profile object (if present).
 * Returns a new object with decrypted tfn (does not mutate input).
 */
function decryptProfileTfn<T extends Record<string, unknown>>(profile: T | null): T | null {
  if (!profile) return null;
  if (TFN_FIELD in profile && typeof profile[TFN_FIELD] === "string") {
    return { ...profile, [TFN_FIELD]: safeDecryptField(profile[TFN_FIELD] as string) };
  }
  return profile;
}

/**
 * Decrypt TFN then mask it (for user-facing endpoints).
 * Only the last 2 digits are shown: "*******21"
 */
function decryptAndMaskProfileTfn<T extends Record<string, unknown>>(profile: T | null): T | null {
  if (!profile) return null;
  if (TFN_FIELD in profile && typeof profile[TFN_FIELD] === "string") {
    const decrypted = safeDecryptField(profile[TFN_FIELD] as string);
    return { ...profile, [TFN_FIELD]: maskTfnValue(decrypted as string) };
  }
  return profile;
}

/**
 * Decrypt TFN in all profile sub-objects of an account result (full plaintext for admin).
 */
function decryptAccountTfns<T extends Record<string, unknown>>(account: T | null): T | null {
  if (!account) return null;
  const result = { ...account };
  if (result.individualProfile) {
    result.individualProfile = decryptProfileTfn(result.individualProfile as Record<string, unknown>);
  }
  if (result.companyProfile) {
    result.companyProfile = decryptProfileTfn(result.companyProfile as Record<string, unknown>);
  }
  if (result.trustProfile) {
    result.trustProfile = decryptProfileTfn(result.trustProfile as Record<string, unknown>);
  }
  if (result.partnershipProfile) {
    result.partnershipProfile = decryptProfileTfn(result.partnershipProfile as Record<string, unknown>);
  }
  return result;
}

/**
 * Mask TFN in all profile sub-objects of an account result (for user-facing APIs).
 * Only last 2 digits visible.
 */
export function maskAccountTfns<T extends Record<string, unknown>>(account: T | null): T | null {
  if (!account) return null;
  const result = { ...account };
  if (result.individualProfile) {
    result.individualProfile = decryptAndMaskProfileTfn(result.individualProfile as Record<string, unknown>);
  }
  if (result.companyProfile) {
    result.companyProfile = decryptAndMaskProfileTfn(result.companyProfile as Record<string, unknown>);
  }
  if (result.trustProfile) {
    result.trustProfile = decryptAndMaskProfileTfn(result.trustProfile as Record<string, unknown>);
  }
  if (result.partnershipProfile) {
    result.partnershipProfile = decryptAndMaskProfileTfn(result.partnershipProfile as Record<string, unknown>);
  }
  return result;
}

export function createAccountRepository(prisma: PrismaClient) {
  return {
    // Create a new account for a user
    async create(data: {
      userId: string;
      accountType: AccountType;
      name: string;
      isDefault?: boolean;
    }) {
      // If this is the first account or set as default, unset other defaults
      if (data.isDefault) {
        await prisma.account.updateMany({
          where: { userId: data.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Check if user has any accounts
      const existingCount = await prisma.account.count({
        where: { userId: data.userId },
      });

      return prisma.account.create({
        data: {
          ...data,
          isDefault: data.isDefault ?? existingCount === 0, // First account is default
        },
      });
    },

    // Get all accounts for a user (TFN fields decrypted)
    async findByUser(userId: string) {
      const accounts = await prisma.account.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        include: {
          individualProfile: { include: { rentalProperties: { orderBy: { createdAt: "desc" } } } },
          companyProfile: true,
          trustProfile: true,
          partnershipProfile: true,
          _count: {
            select: {
              accountServices: true,
              legalConsents: true,
              companyPartners: true,
            },
          },
        },
      });
      return accounts.map((a) => decryptAccountTfns(a as unknown as Record<string, unknown>));
    },

    // Get single account by ID (TFN fields decrypted)
    async findById(id: string) {
      const account = await prisma.account.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          individualProfile: { include: { rentalProperties: { orderBy: { createdAt: "desc" } } } },
          companyProfile: true,
          trustProfile: true,
          partnershipProfile: true,
          accountServices: {
            include: { service: true },
            orderBy: { createdAt: "desc" },
          },
          legalConsents: {
            orderBy: { acceptedAt: "desc" },
          },
          companyPartners: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return decryptAccountTfns(account as unknown as Record<string, unknown>) as typeof account;
    },

    // Update account
    async update(id: string, data: Partial<{ name: string; status: AccountStatus; isDefault: boolean }>) {
      return prisma.account.update({
        where: { id },
        data,
      });
    },

    // Set default account
    async setDefault(userId: string, accountId: string) {
      await prisma.$transaction([
        prisma.account.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.account.update({
          where: { id: accountId },
          data: { isDefault: true },
        }),
      ]);
    },

    // Soft-close account (sets status to CLOSED — user can reopen later)
    async close(id: string) {
      return prisma.account.update({
        where: { id },
        data: { status: "CLOSED", isDefault: false },
      });
    },

    // Reopen a closed account (sets status back to DRAFT)
    async reopen(id: string) {
      return prisma.account.update({
        where: { id },
        data: { status: "DRAFT" },
      });
    },

    // Permanent delete — removes account and ALL related data from the system
    async permanentDelete(id: string) {
      // Cascade delete is configured in the schema, so deleting the account
      // removes all profiles, services, consents, partners, rental properties, etc.
      return prisma.account.delete({
        where: { id },
      });
    },

    // Get default account for user (TFN fields decrypted)
    async getDefault(userId: string) {
      const account = await prisma.account.findFirst({
        where: { userId, isDefault: true },
        include: {
          individualProfile: { include: { rentalProperties: { orderBy: { createdAt: "desc" } } } },
          companyProfile: true,
          trustProfile: true,
          partnershipProfile: true,
        },
      });
      return decryptAccountTfns(account as unknown as Record<string, unknown>) as typeof account;
    },

    // Update account status
    async updateStatus(id: string, status: AccountStatus) {
      return prisma.account.update({
        where: { id },
        data: { status },
      });
    },

    // =========================================================================
    // Profile Management - Type-specific profiles
    // =========================================================================

    // Create or update Individual profile (TFN encrypted before storage)
    async upsertIndividualProfile(
      accountId: string,
      data: {
        firstName?: string;
        middleName?: string | null;
        lastName?: string;
        dateOfBirth?: Date | null;
        tfn?: string;
        address?: string;
        suburb?: string;
        state?: string;
        postcode?: string;
        country?: string;
        occupation?: string;
        employerName?: string;
        // ABN fields
        hasAbn?: boolean | null;
        abn?: string | null;
        abnRegisteredName?: string | null;
        abnStatus?: string | null;
        // GST
        gstRegistered?: boolean | null;
        // Medical card
        hasMedicalCard?: boolean | null;
        // Marital status & spouse
        maritalStatus?: string | null;
        spouseInAustralia?: boolean | null;
        spouseName?: string | null;
        spouseFirstName?: string | null;
        spouseLastName?: string | null;
        spouseEmail?: string | null;
        spouseDob?: Date | null;
        spouseIncome?: number | null;
        spouseUserId?: string | null;
        spouseStatus?: string | null;
        // Rental income
        hasRentalIncome?: boolean | null;
      }
    ) {
      // Encrypt TFN before storage, compute HMAC hash for lookups
      const processedData = { ...data };
      let tfnHash: string | null | undefined = undefined;
      if (processedData.tfn !== undefined) {
        if (processedData.tfn && processedData.tfn.trim() !== "") {
          tfnHash = safeHmacField(processedData.tfn) ?? null;
          processedData.tfn = (safeEncryptField(processedData.tfn) as string) ?? processedData.tfn;
        } else {
          // Clearing TFN — also clear hash
          tfnHash = null;
          processedData.tfn = undefined;
        }
      }

      // Check if profile exists
      const existing = await prisma.individualProfile.findUnique({ where: { accountId } });
      
      if (existing) {
        // Update existing - filter out undefined values
        const updateData: Record<string, unknown> = {};
        Object.entries(processedData).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        if (tfnHash !== undefined) updateData.tfnHash = tfnHash;
        return prisma.individualProfile.update({
          where: { accountId },
          data: updateData,
        });
      } else {
        // Create new - need firstName/lastName, default to empty if not provided
        return prisma.individualProfile.create({
          data: {
            accountId,
            firstName: processedData.firstName || "",
            middleName: processedData.middleName,
            lastName: processedData.lastName || "",
            dateOfBirth: processedData.dateOfBirth,
            tfn: processedData.tfn,
            tfnHash: tfnHash ?? undefined,
            address: processedData.address,
            suburb: processedData.suburb,
            state: processedData.state,
            postcode: processedData.postcode,
            country: processedData.country,
            occupation: processedData.occupation,
            employerName: processedData.employerName,
            hasAbn: processedData.hasAbn ?? false,
            abn: processedData.abn,
            abnRegisteredName: processedData.abnRegisteredName,
            abnStatus: processedData.abnStatus,
            gstRegistered: processedData.gstRegistered ?? false,
            hasMedicalCard: processedData.hasMedicalCard ?? false,
            maritalStatus: processedData.maritalStatus,
            spouseInAustralia: processedData.spouseInAustralia,
            spouseName: processedData.spouseName,
            spouseFirstName: processedData.spouseFirstName,
            spouseLastName: processedData.spouseLastName,
            spouseEmail: processedData.spouseEmail,
            spouseDob: processedData.spouseDob,
            spouseIncome: processedData.spouseIncome,
            spouseUserId: processedData.spouseUserId,
            spouseStatus: processedData.spouseStatus,
            hasRentalIncome: processedData.hasRentalIncome ?? false,
          },
        });
      }
    },

    // Create or update Company profile
    async upsertCompanyProfile(
      accountId: string,
      data: Record<string, unknown>
    ) {
      // Handle TFN encryption (same pattern as Individual)
      const processedData = { ...data };
      if (processedData.tfn && typeof processedData.tfn === "string" && processedData.tfn.trim() !== "") {
        const encrypted = safeEncryptField(processedData.tfn as string);
        const hmac = safeHmacField(processedData.tfn as string);
        processedData.tfn = encrypted || processedData.tfn;
        processedData.tfnHash = hmac || undefined;
      }

      const existing = await prisma.companyProfile.findUnique({ where: { accountId } });

      if (existing) {
        const updateData: Record<string, unknown> = {};
        Object.entries(processedData).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        return prisma.companyProfile.update({
          where: { accountId },
          data: updateData,
        });
      } else {
        return prisma.companyProfile.create({
          data: {
            accountId,
            companyName: (processedData.companyName as string) || "",
            tradingName: processedData.tradingName as string | undefined,
            abn: processedData.abn as string | undefined,
            acn: processedData.acn as string | undefined,
            tfn: processedData.tfn as string | undefined,
            tfnHash: processedData.tfnHash as string | undefined,
            businessAddress: processedData.businessAddress as string | undefined,
            businessSuburb: processedData.businessSuburb as string | undefined,
            businessState: processedData.businessState as string | undefined,
            businessPostcode: processedData.businessPostcode as string | undefined,
            postalSameAsBusiness: processedData.postalSameAsBusiness as boolean | undefined,
            postalAddress: processedData.postalAddress as string | undefined,
            postalSuburb: processedData.postalSuburb as string | undefined,
            postalState: processedData.postalState as string | undefined,
            postalPostcode: processedData.postalPostcode as string | undefined,
            industry: processedData.industry as string | undefined,
            industrySector: processedData.industrySector as string | undefined,
            businessDescription: processedData.businessDescription as string | undefined,
            directorCount: processedData.directorCount as number | undefined,
            selfIsDirector: processedData.selfIsDirector as boolean | undefined,
            selfIsShareholder: processedData.selfIsShareholder as boolean | undefined,
            selfShareCount: processedData.selfShareCount as number | undefined,
            financialYearEnd: processedData.financialYearEnd as string | undefined,
            gstRegistered: processedData.gstRegistered as boolean | undefined,
          },
        });
      }
    },

    // Create or update Trust profile (TFN encrypted before storage)
    async upsertTrustProfile(
      accountId: string,
      data: {
        trustName?: string;
        trustType?: "DISCRETIONARY" | "UNIT" | "HYBRID" | "SMSF" | "TESTAMENTARY" | "OTHER";
        tfn?: string;
        abn?: string;
        establishedDate?: Date;
        trusteeDetails?: string; // JSON
        beneficiaries?: string; // JSON
        address?: string;
        suburb?: string;
        state?: string;
        postcode?: string;
      }
    ) {
      // Encrypt TFN before storage
      const processedData = { ...data };
      let tfnHash: string | null | undefined = undefined;
      if (processedData.tfn !== undefined) {
        if (processedData.tfn && processedData.tfn.trim() !== "") {
          tfnHash = safeHmacField(processedData.tfn) ?? null;
          processedData.tfn = (safeEncryptField(processedData.tfn) as string) ?? processedData.tfn;
        } else {
          tfnHash = null;
          processedData.tfn = undefined;
        }
      }

      // Check if profile exists
      const existing = await prisma.trustProfile.findUnique({ where: { accountId } });
      
      if (existing) {
        const updateData: Record<string, unknown> = {};
        Object.entries(processedData).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        if (tfnHash !== undefined) updateData.tfnHash = tfnHash;
        return prisma.trustProfile.update({
          where: { accountId },
          data: updateData,
        });
      } else {
        return prisma.trustProfile.create({
          data: {
            accountId,
            trustName: processedData.trustName || "",
            trustType: processedData.trustType || "DISCRETIONARY",
            tfn: processedData.tfn,
            tfnHash: tfnHash ?? undefined,
            abn: processedData.abn,
            establishedDate: processedData.establishedDate,
            trusteeDetails: processedData.trusteeDetails,
            beneficiaries: processedData.beneficiaries,
            address: processedData.address,
            suburb: processedData.suburb,
            state: processedData.state,
            postcode: processedData.postcode,
          },
        });
      }
    },

    // Create or update Partnership profile (TFN encrypted before storage)
    async upsertPartnershipProfile(
      accountId: string,
      data: {
        partnershipName?: string;
        tradingName?: string;
        abn?: string;
        tfn?: string;
        businessAddress?: string;
        suburb?: string;
        state?: string;
        postcode?: string;
        industry?: string;
        establishedDate?: Date;
        selfRole?: string;
        selfOwnershipPercent?: number;
        partners?: string; // JSON
      }
    ) {
      // Encrypt TFN before storage
      const processedData = { ...data };
      let tfnHash: string | null | undefined = undefined;
      if (processedData.tfn !== undefined) {
        if (processedData.tfn && processedData.tfn.trim() !== "") {
          tfnHash = safeHmacField(processedData.tfn) ?? null;
          processedData.tfn = (safeEncryptField(processedData.tfn) as string) ?? processedData.tfn;
        } else {
          tfnHash = null;
          processedData.tfn = undefined;
        }
      }

      // Check if profile exists
      const existing = await prisma.partnershipProfile.findUnique({ where: { accountId } });
      
      if (existing) {
        const updateData: Record<string, unknown> = {};
        Object.entries(processedData).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        if (tfnHash !== undefined) updateData.tfnHash = tfnHash;
        return prisma.partnershipProfile.update({
          where: { accountId },
          data: updateData,
        });
      } else {
        return prisma.partnershipProfile.create({
          data: {
            accountId,
            partnershipName: processedData.partnershipName || "",
            tradingName: processedData.tradingName,
            abn: processedData.abn,
            tfn: processedData.tfn,
            tfnHash: tfnHash ?? undefined,
            businessAddress: processedData.businessAddress,
            suburb: processedData.suburb,
            state: processedData.state,
            postcode: processedData.postcode,
            industry: processedData.industry,
            establishedDate: processedData.establishedDate,
            selfRole: processedData.selfRole,
            selfOwnershipPercent: processedData.selfOwnershipPercent,
            partners: processedData.partners,
          },
        });
      }
    },

    // =========================================================================
    // Admin functions
    // =========================================================================

    // Get all accounts with pagination (admin) - TFN fields decrypted
    async findAll(options: {
      page?: number;
      limit?: number;
      accountType?: AccountType;
      status?: AccountStatus;
      search?: string;
    }) {
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: Prisma.AccountWhereInput = {};
      if (options.accountType) where.accountType = options.accountType;
      if (options.status) where.status = options.status;
      if (options.search) {
        const s = options.search;
        // TFN search uses HMAC hash for exact match (encrypted field — can't do partial match).
        // Compute the hash of the search term to compare against stored tfnHash.
        const tfnHashSearch = safeHmacField(s.replace(/\s/g, ""));
        const searchConditions: Prisma.AccountWhereInput[] = [
          // Account name
          { name: { contains: s, mode: "insensitive" } },
          // Owner name / email / phone
          { user: { name: { contains: s, mode: "insensitive" } } },
          { user: { email: { contains: s, mode: "insensitive" } } },
          { user: { phone: { contains: s, mode: "insensitive" } } },
          // ABN search (not encrypted)
          { individualProfile: { abn: { contains: s, mode: "insensitive" } } },
          { companyProfile: { abn: { contains: s, mode: "insensitive" } } },
          { trustProfile: { abn: { contains: s, mode: "insensitive" } } },
          { partnershipProfile: { abn: { contains: s, mode: "insensitive" } } },
          // Individual name fields
          { individualProfile: { firstName: { contains: s, mode: "insensitive" } } },
          { individualProfile: { lastName: { contains: s, mode: "insensitive" } } },
          // Company name
          { companyProfile: { companyName: { contains: s, mode: "insensitive" } } },
          // Trust name
          { trustProfile: { trustName: { contains: s, mode: "insensitive" } } },
          // Partnership name
          { partnershipProfile: { partnershipName: { contains: s, mode: "insensitive" } } },
        ];
        // TFN search via deterministic hash (exact match only — no partial TFN search for security)
        if (tfnHashSearch) {
          searchConditions.push(
            { individualProfile: { tfnHash: tfnHashSearch } },
            { trustProfile: { tfnHash: tfnHashSearch } },
            { partnershipProfile: { tfnHash: tfnHashSearch } },
          );
        }
        where.OR = searchConditions;
      }

      const [accounts, total] = await Promise.all([
        prisma.account.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, phoneVerified: true, status: true, createdAt: true } },
            individualProfile: { include: { rentalProperties: { orderBy: { createdAt: "desc" } } } },
            companyProfile: true,
            trustProfile: true,
            partnershipProfile: true,
            _count: { select: { accountServices: true, legalConsents: true, companyPartners: true } },
          },
        }),
        prisma.account.count({ where }),
      ]);

      // Decrypt TFN fields before returning
      const decryptedAccounts = accounts.map((a) => decryptAccountTfns(a as unknown as Record<string, unknown>));

      return { accounts: decryptedAccounts, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    // Get account stats (admin)
    async getStats() {
      const [total, byType, byStatus] = await Promise.all([
        prisma.account.count(),
        prisma.account.groupBy({
          by: ["accountType"],
          _count: true,
        }),
        prisma.account.groupBy({
          by: ["status"],
          _count: true,
        }),
      ]);

      return {
        total,
        byType: Object.fromEntries(byType.map((t) => [t.accountType, t._count])),
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      };
    },

    // =========================================================================
    // Rental Property CRUD (linked to IndividualProfile)
    // =========================================================================

    /** Add a rental property to an individual profile */
    async addRentalProperty(
      individualProfileId: string,
      data: { address: string; suburb?: string; state?: string; postcode?: string; ownershipPercent: number }
    ) {
      return prisma.rentalProperty.create({
        data: {
          individualProfileId,
          address: data.address,
          suburb: data.suburb ?? null,
          state: data.state ?? null,
          postcode: data.postcode ?? null,
          ownershipPercent: data.ownershipPercent,
        },
      });
    },

    /** Update a rental property */
    async updateRentalProperty(
      propertyId: string,
      data: { address?: string; suburb?: string; state?: string; postcode?: string; ownershipPercent?: number }
    ) {
      return prisma.rentalProperty.update({
        where: { id: propertyId },
        data,
      });
    },

    /** Delete a rental property */
    async deleteRentalProperty(propertyId: string) {
      return prisma.rentalProperty.delete({
        where: { id: propertyId },
      });
    },

    /** Get a single rental property by ID */
    async getRentalProperty(propertyId: string) {
      return prisma.rentalProperty.findUnique({
        where: { id: propertyId },
      });
    },

    /** Get all rental properties for an individual profile */
    async getRentalProperties(individualProfileId: string) {
      return prisma.rentalProperty.findMany({
        where: { individualProfileId },
        orderBy: { createdAt: "desc" },
      });
    },
  };
}
