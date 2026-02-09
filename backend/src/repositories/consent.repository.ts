/**
 * Consent Repository - Legal consent tracking
 * Audit trail for authority and consent acceptance (SOC 2 compliant)
 */

import type { PrismaClient, ConsentType } from "@prisma/client";

export function createConsentRepository(prisma: PrismaClient) {
  return {
    // Record a consent acceptance
    async create(data: {
      accountId: string;
      userId: string;
      consentType: ConsentType;
      documentVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    }) {
      return prisma.legalConsent.create({
        data: {
          accountId: data.accountId,
          userId: data.userId,
          consentType: data.consentType,
          documentVersion: data.documentVersion,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    },

    // Get consents for an account
    async getForAccount(accountId: string) {
      return prisma.legalConsent.findMany({
        where: { accountId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { acceptedAt: "desc" },
      });
    },

    // Check if account has specific consent
    async hasConsent(accountId: string, consentType: ConsentType) {
      const consent = await prisma.legalConsent.findFirst({
        where: { accountId, consentType },
      });
      return !!consent;
    },

    // Get required consent types based on account type.
    // TAX_AGENT_AUTHORITY is always required.
    // ENGAGEMENT_LETTER is required for Company, Trust, Partnership — optional for Individual.
    async _getRequiredTypes(accountId: string): Promise<ConsentType[]> {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { accountType: true },
      });
      const required: ConsentType[] = ["TAX_AGENT_AUTHORITY"];
      if (account && account.accountType !== "INDIVIDUAL") {
        required.push("ENGAGEMENT_LETTER");
      }
      return required;
    },

    // Check if account has all required consents for service activation
    async hasRequiredConsents(accountId: string) {
      const requiredTypes = await this._getRequiredTypes(accountId);

      const consents = await prisma.legalConsent.findMany({
        where: {
          accountId,
          consentType: { in: requiredTypes },
        },
        select: { consentType: true },
      });

      const givenTypes = new Set(consents.map((c) => c.consentType));
      return requiredTypes.every((t) => givenTypes.has(t));
    },

    // Get missing consents for an account
    async getMissingConsents(accountId: string) {
      const requiredTypes = await this._getRequiredTypes(accountId);

      const consents = await prisma.legalConsent.findMany({
        where: {
          accountId,
          consentType: { in: requiredTypes },
        },
        select: { consentType: true },
      });

      const givenTypes = new Set(consents.map((c) => c.consentType));
      return requiredTypes.filter((t) => !givenTypes.has(t));
    },

    // Batch record consents
    async createMany(
      accountId: string,
      userId: string,
      consentTypes: ConsentType[],
      metadata: {
        ipAddress?: string;
        userAgent?: string;
        documentVersion?: string;
        signatureData?: string;
        signatureType?: string;
        signedName?: string;
      }
    ) {
      return prisma.legalConsent.createMany({
        data: consentTypes.map((type) => ({
          accountId,
          userId,
          consentType: type,
          documentVersion: metadata.documentVersion,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          signatureData: metadata.signatureData,
          signatureType: metadata.signatureType,
          signedName: metadata.signedName,
        })),
      });
    },

    // Get all consents by user
    async getByUser(userId: string) {
      return prisma.legalConsent.findMany({
        where: { userId },
        include: {
          account: { select: { id: true, name: true, accountType: true } },
        },
        orderBy: { acceptedAt: "desc" },
      });
    },

    // Admin: Get all consents with pagination
    async findAll(options?: {
      page?: number;
      limit?: number;
      consentType?: ConsentType;
      accountId?: string;
    }) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (options?.consentType) where.consentType = options.consentType;
      if (options?.accountId) where.accountId = options.accountId;

      const [consents, total] = await Promise.all([
        prisma.legalConsent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { acceptedAt: "desc" },
          include: {
            account: { select: { id: true, name: true, accountType: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.legalConsent.count({ where }),
      ]);

      return { consents, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    // Get consent statistics
    async getStats() {
      const stats = await prisma.legalConsent.groupBy({
        by: ["consentType"],
        _count: true,
      });

      return Object.fromEntries(stats.map((s) => [s.consentType, s._count]));
    },
  };
}
