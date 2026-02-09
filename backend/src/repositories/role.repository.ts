/**
 * Role & Permission repositories - RBAC data access.
 * Pagination + search for scale (thousands of permissions, large role sets).
 */

import type { PrismaClient } from "@prisma/client";

export function createRoleRepository(prisma: PrismaClient) {
  return {
    async list() {
      return prisma.role.findMany({
        orderBy: { name: "asc" },
        include: { rolePermissions: { include: { permission: true } } },
      });
    },

    async listPaginated(skip: number, take: number, search: string) {
      const where = search.trim()
        ? { name: { contains: search.trim(), mode: "insensitive" as const } }
        : {};
      const [roles, total] = await Promise.all([
        prisma.role.findMany({
          where,
          skip,
          take,
          orderBy: { name: "asc" },
          include: { rolePermissions: { include: { permission: true } } },
        }),
        prisma.role.count({ where }),
      ]);
      return { roles, total };
    },

    async findById(id: string) {
      return prisma.role.findUnique({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    },

    async create(data: { name: string; description?: string | null }) {
      return prisma.role.create({
        data: { name: data.name, description: data.description ?? undefined },
        include: { rolePermissions: { include: { permission: true } } },
      });
    },

    async update(id: string, data: { name?: string; description?: string | null }) {
      return prisma.role.update({
        where: { id },
        data: { name: data.name, description: data.description },
        include: { rolePermissions: { include: { permission: true } } },
      });
    },

    async delete(id: string) {
      return prisma.role.delete({ where: { id } });
    },

    async setPermissions(roleId: string, permissionIds: string[]) {
      await prisma.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      return prisma.role.findUnique({
        where: { id: roleId },
        include: { rolePermissions: { include: { permission: true } } },
      });
    },
  };
}

export function createPermissionRepository(prisma: PrismaClient) {
  return {
    async list() {
      return prisma.permission.findMany({ orderBy: { code: "asc" } });
    },

    async listPaginated(skip: number, take: number, search: string) {
      const where = search.trim()
        ? {
            OR: [
              { code: { contains: search.trim(), mode: "insensitive" as const } },
              { name: { contains: search.trim(), mode: "insensitive" as const } },
            ],
          }
        : {};
      const [permissions, total] = await Promise.all([
        prisma.permission.findMany({
          where,
          skip,
          take,
          orderBy: { code: "asc" },
        }),
        prisma.permission.count({ where }),
      ]);
      return { permissions, total };
    },

    async findByCodes(codes: string[]) {
      return prisma.permission.findMany({ where: { code: { in: codes } } });
    },

    async findById(id: string) {
      return prisma.permission.findUnique({ where: { id } });
    },

    async create(data: { code: string; name: string; description?: string | null }) {
      return prisma.permission.create({
        data: { code: data.code, name: data.name, description: data.description ?? undefined },
      });
    },

    async update(id: string, data: { code?: string; name?: string; description?: string | null }) {
      return prisma.permission.update({
        where: { id },
        data: { code: data.code, name: data.name, description: data.description },
      });
    },

    async delete(id: string) {
      return prisma.permission.delete({ where: { id } });
    },
  };
}
