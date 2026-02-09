/**
 * Service Repository - Admin-managed services
 * Services can be purchased per account, with type-specific pricing
 */

import type { PrismaClient, AccountType, ServiceStatus, Prisma } from "@prisma/client";

export function createServiceRepository(prisma: PrismaClient) {
  return {
    // =========================================================================
    // Service Management (Admin)
    // =========================================================================

    // Create a new service
    async create(data: {
      code: string;
      name: string;
      description?: string;
      category?: string;
      allowedTypes: AccountType[];
      pricing: Record<string, number>; // {INDIVIDUAL: 150, COMPANY: 300}
      requiresConsent?: boolean;
      sortOrder?: number;
    }) {
      return prisma.service.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          category: data.category,
          allowedTypes: JSON.stringify(data.allowedTypes),
          pricing: JSON.stringify(data.pricing),
          requiresConsent: data.requiresConsent ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    },

    // Update a service
    async update(
      id: string,
      data: Partial<{
        name: string;
        description: string;
        category: string;
        allowedTypes: AccountType[];
        pricing: Record<string, number>;
        requiresConsent: boolean;
        isActive: boolean;
        sortOrder: number;
      }>
    ) {
      const updateData: any = { ...data };
      if (data.allowedTypes) updateData.allowedTypes = JSON.stringify(data.allowedTypes);
      if (data.pricing) updateData.pricing = JSON.stringify(data.pricing);
      delete updateData.allowedTypes;
      delete updateData.pricing;

      return prisma.service.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.allowedTypes && { allowedTypes: JSON.stringify(data.allowedTypes) }),
          ...(data.pricing && { pricing: JSON.stringify(data.pricing) }),
        },
      });
    },

    // Get service by ID
    async findById(id: string) {
      const service = await prisma.service.findUnique({
        where: { id },
        include: { _count: { select: { accountServices: true } } },
      });
      if (!service) return null;
      return {
        ...service,
        allowedTypes: JSON.parse(service.allowedTypes) as AccountType[],
        pricing: JSON.parse(service.pricing) as Record<string, number>,
      };
    },

    // Get service by code
    async findByCode(code: string) {
      const service = await prisma.service.findUnique({ where: { code } });
      if (!service) return null;
      return {
        ...service,
        allowedTypes: JSON.parse(service.allowedTypes) as AccountType[],
        pricing: JSON.parse(service.pricing) as Record<string, number>,
      };
    },

    // Get all services (admin)
    async findAll(options?: {
      page?: number;
      limit?: number;
      category?: string;
      isActive?: boolean;
      search?: string;
    }) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 50;
      const skip = (page - 1) * limit;

      const where: Prisma.ServiceWhereInput = {};
      if (options?.category) where.category = options.category;
      if (options?.isActive !== undefined) where.isActive = options.isActive;
      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: "insensitive" } },
          { code: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
        ];
      }

      const [services, total] = await Promise.all([
        prisma.service.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { _count: { select: { accountServices: true } } },
        }),
        prisma.service.count({ where }),
      ]);

      return {
        services: services.map((s) => ({
          ...s,
          allowedTypes: JSON.parse(s.allowedTypes) as AccountType[],
          pricing: JSON.parse(s.pricing) as Record<string, number>,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },

    // Get services available for an account type
    async findForAccountType(accountType: AccountType) {
      const services = await prisma.service.findMany({
        where: {
          isActive: true,
          allowedTypes: { contains: accountType },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      return services.map((s) => ({
        ...s,
        allowedTypes: JSON.parse(s.allowedTypes) as AccountType[],
        pricing: JSON.parse(s.pricing) as Record<string, number>,
        priceForType: (JSON.parse(s.pricing) as Record<string, number>)[accountType],
      }));
    },

    // Toggle service active status
    async toggleActive(id: string) {
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return null;
      return prisma.service.update({
        where: { id },
        data: { isActive: !service.isActive },
      });
    },

    // Delete service (only if no purchases)
    async delete(id: string) {
      const purchaseCount = await prisma.accountService.count({
        where: { serviceId: id },
      });
      if (purchaseCount > 0) {
        throw new Error("Cannot delete service with existing purchases");
      }
      return prisma.service.delete({ where: { id } });
    },

    // Get service categories
    async getCategories() {
      const categories = await prisma.service.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ["category"],
      });
      return categories.map((c) => c.category).filter(Boolean) as string[];
    },

    // =========================================================================
    // Account Service (Purchases)
    // =========================================================================

    // Purchase a service for an account
    async purchase(data: {
      accountId: string;
      serviceId: string;
      price: number;
      financialYear?: string;
      notes?: string;
    }) {
      return prisma.accountService.create({
        data: {
          accountId: data.accountId,
          serviceId: data.serviceId,
          price: data.price,
          financialYear: data.financialYear,
          notes: data.notes,
          status: "PENDING",
        },
        include: { service: true, account: true },
      });
    },

    // Get services for an account
    async getAccountServices(accountId: string) {
      return prisma.accountService.findMany({
        where: { accountId },
        include: { service: true },
        orderBy: { createdAt: "desc" },
      });
    },

    // Update account service status
    async updateServiceStatus(id: string, status: ServiceStatus) {
      const data: any = { status };
      if (status === "IN_PROGRESS" || status === "COMPLETED") {
        data.activatedAt = new Date();
      }
      if (status === "COMPLETED") {
        data.completedAt = new Date();
      }
      return prisma.accountService.update({
        where: { id },
        data,
        include: { service: true },
      });
    },

    // Check if account already has service for financial year
    async hasService(accountId: string, serviceId: string, financialYear?: string) {
      return prisma.accountService.findFirst({
        where: {
          accountId,
          serviceId,
          ...(financialYear && { financialYear }),
        },
      });
    },

    // Get all purchases (admin)
    async getAllPurchases(options?: {
      page?: number;
      limit?: number;
      status?: ServiceStatus;
      accountId?: string;
      serviceId?: string;
    }) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const skip = (page - 1) * limit;

      const where: Prisma.AccountServiceWhereInput = {};
      if (options?.status) where.status = options.status;
      if (options?.accountId) where.accountId = options.accountId;
      if (options?.serviceId) where.serviceId = options.serviceId;

      const [purchases, total] = await Promise.all([
        prisma.accountService.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            service: true,
            account: {
              include: {
                user: { select: { id: true, name: true, email: true, phone: true } },
                individualProfile: true,
                companyProfile: true,
                trustProfile: true,
                partnershipProfile: true,
              },
            },
          },
        }),
        prisma.accountService.count({ where }),
      ]);

      return { purchases, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    // Get purchase stats
    async getPurchaseStats() {
      const [total, byStatus, revenue] = await Promise.all([
        prisma.accountService.count(),
        prisma.accountService.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.accountService.aggregate({
          _sum: { price: true },
        }),
      ]);

      return {
        total,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        totalRevenue: revenue._sum.price ?? 0,
      };
    },
  };
}
