/**
 * User repository - data access layer.
 * Future: multi-tenant filter by tenantId; audit log on mutations.
 */

import type { PrismaClient, UserStatus } from "@prisma/client";

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  status?: UserStatus;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  passwordHash?: string;
  status?: UserStatus;
}

export function createUserRepository(prisma: PrismaClient) {
  return {
    async findByEmail(email: string) {
      return prisma.user.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });
    },

    async findById(id: string) {
      return prisma.user.findFirst({
        where: { id, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });
    },

    async create(data: CreateUserInput) {
      // Map passwordHash to password for Prisma (schema uses 'password' field)
      const { passwordHash, ...rest } = data;
      return prisma.user.create({
        data: {
          ...rest,
          email: data.email.toLowerCase(),
          password: passwordHash,
          status: data.status ?? "ACTIVE",
        },
        include: { userRoles: { include: { role: true } } },
      });
    },

    async update(id: string, data: UpdateUserInput) {
      // Map passwordHash to password for Prisma (schema uses 'password' field)
      const { passwordHash, ...rest } = data;
      const updateData: Record<string, unknown> = { ...rest };
      if (passwordHash) {
        updateData.password = passwordHash;
      }
      if (data.email) {
        updateData.email = data.email.toLowerCase();
      }
      return prisma.user.update({
        where: { id },
        data: updateData,
        include: { userRoles: { include: { role: true } } },
      });
    },

    async softDelete(id: string) {
      return prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), status: "INACTIVE" },
      });
    },

    async list(skip = 0, take = 50) {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { deletedAt: null },
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: { userRoles: { include: { role: true } } },
        }),
        prisma.user.count({ where: { deletedAt: null } }),
      ]);
      return { users, total };
    },

    async setRoles(userId: string, roleIds: string[]) {
      await prisma.userRole.deleteMany({ where: { userId } });
      if (roleIds.length > 0) {
        await prisma.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId })),
        });
      }
      return this.findById(userId);
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
