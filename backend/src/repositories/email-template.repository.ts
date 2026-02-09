import { PrismaClient } from "@prisma/client";

export function createEmailTemplateRepository(prisma: PrismaClient) {
  return {
    // Get all templates
    async findAll() {
      return prisma.emailTemplate.findMany({
        orderBy: { code: "asc" },
      });
    },

    // Get template by code
    async findByCode(code: string) {
      return prisma.emailTemplate.findUnique({ where: { code } });
    },

    // Get template by ID
    async findById(id: string) {
      return prisma.emailTemplate.findUnique({ where: { id } });
    },

    // Create template
    async create(data: {
      code: string;
      name: string;
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      variables?: string;
      isActive?: boolean;
    }) {
      return prisma.emailTemplate.create({ data });
    },

    // Update template
    async update(
      id: string,
      data: {
        name?: string;
        subject?: string;
        bodyHtml?: string;
        bodyText?: string;
        variables?: string;
        isActive?: boolean;
      }
    ) {
      return prisma.emailTemplate.update({ where: { id }, data });
    },

    // Delete template
    async delete(id: string) {
      return prisma.emailTemplate.delete({ where: { id } });
    },

    // Toggle active status
    async toggleActive(id: string) {
      const template = await prisma.emailTemplate.findUnique({ where: { id } });
      if (!template) throw new Error("Template not found");
      return prisma.emailTemplate.update({
        where: { id },
        data: { isActive: !template.isActive },
      });
    },

    // Paginated list
    async listPaginated(params: { page: number; limit: number; search?: string }) {
      const { page, limit, search } = params;
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.emailTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: { code: "asc" },
        }),
        prisma.emailTemplate.count({ where }),
      ]);

      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
  };
}
