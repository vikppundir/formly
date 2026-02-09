/**
 * Roles & Permissions API - full CRUD with pagination/search.
 * Scale: thousands of permissions, large role sets (pagination + search).
 */

import type { FastifyInstance } from "fastify";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermissions } from "../middleware/permission.middleware.js";
import { createRoleRepository, createPermissionRepository } from "../repositories/role.repository.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdParamSchema,
  listQuerySchema,
} from "../validations/role.validation.js";
import type { PrismaClient } from "@prisma/client";

export async function registerRolesRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const roleRepo = createRoleRepository(prisma);
  const permRepo = createPermissionRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);
  const preHandler = [authMiddleware, requirePermissions(["manage_roles"])];
  const preHandlerRolesList = [authMiddleware, requirePermissions(["manage_roles", "manage_users"])];

  // ---- Roles (list: manage_roles or manage_users for dropdown) ----
  app.get("/roles", { preHandler: preHandlerRolesList }, async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    const { page, limit, search } = query.success ? query.data : { page: 1, limit: 20, search: "" };
    const skip = (page - 1) * limit;
    const { roles, total } = await roleRepo.listPaginated(skip, limit, search);
    return reply.send({ roles, total, page, limit });
  });

  app.get("/roles/:id", { preHandler: preHandlerRolesList }, async (request, reply) => {
    const parsed = roleIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    const role = await roleRepo.findById(parsed.data.id);
    if (!role) return reply.status(404).send({ error: "Role not found" });
    return reply.send(role);
  });

  app.post("/roles", { preHandler }, async (request, reply) => {
    const parsed = createRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { permissionIds, ...data } = parsed.data;
    const existing = await prisma.role.findUnique({ where: { name: data.name } });
    if (existing) return reply.status(409).send({ error: "Role name already exists" });
    const role = await roleRepo.create(data);
    if (permissionIds?.length) await roleRepo.setPermissions(role.id, permissionIds);
    const created = await roleRepo.findById(role.id);
    return reply.status(201).send(created);
  });

  app.patch("/roles/:id", { preHandler }, async (request, reply) => {
    const params = (request as { params: { id?: string } }).params;
    const parsedParam = roleIdParamSchema.safeParse(params);
    if (!parsedParam.success) return reply.status(400).send({ error: "Invalid id" });
    const parsedBody = updateRoleSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsedBody.error.flatten() });
    }
    const { permissionIds, ...data } = parsedBody.data;
    if (data.name) {
      const existing = await prisma.role.findFirst({
        where: { name: data.name, id: { not: parsedParam.data.id } },
      });
      if (existing) return reply.status(409).send({ error: "Role name already exists" });
    }
    if (Object.keys(data).length > 0) await roleRepo.update(parsedParam.data.id, data);
    if (permissionIds !== undefined) await roleRepo.setPermissions(parsedParam.data.id, permissionIds);
    const role = await roleRepo.findById(parsedParam.data.id);
    if (!role) return reply.status(404).send({ error: "Role not found" });
    return reply.send(role);
  });

  app.delete("/roles/:id", { preHandler }, async (request, reply) => {
    const parsed = roleIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    await roleRepo.delete(parsed.data.id);
    return reply.send({ ok: true });
  });

  // ---- Permissions (paginated + search for scale) ----
  app.get("/permissions", { preHandler }, async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    const { page, limit, search } = query.success ? query.data : { page: 1, limit: 20, search: "" };
    const skip = (page - 1) * limit;
    const { permissions, total } = await permRepo.listPaginated(skip, limit, search);
    return reply.send({ permissions, total, page, limit });
  });

  app.get("/permissions/:id", { preHandler }, async (request, reply) => {
    const parsed = permissionIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    const perm = await permRepo.findById(parsed.data.id);
    if (!perm) return reply.status(404).send({ error: "Permission not found" });
    return reply.send(perm);
  });

  app.post("/permissions", { preHandler }, async (request, reply) => {
    const parsed = createPermissionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const existing = await prisma.permission.findUnique({ where: { code: parsed.data.code } });
    if (existing) return reply.status(409).send({ error: "Permission code already exists" });
    const permission = await permRepo.create(parsed.data);
    return reply.status(201).send(permission);
  });

  app.patch("/permissions/:id", { preHandler }, async (request, reply) => {
    const params = (request as { params: { id?: string } }).params;
    const parsedParam = permissionIdParamSchema.safeParse(params);
    if (!parsedParam.success) return reply.status(400).send({ error: "Invalid id" });
    const parsedBody = updatePermissionSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsedBody.error.flatten() });
    }
    if (parsedBody.data.code) {
      const existing = await prisma.permission.findFirst({
        where: { code: parsedBody.data.code, id: { not: parsedParam.data.id } },
      });
      if (existing) return reply.status(409).send({ error: "Permission code already exists" });
    }
    const permission = await permRepo.update(parsedParam.data.id, parsedBody.data);
    return reply.send(permission);
  });

  app.delete("/permissions/:id", { preHandler }, async (request, reply) => {
    const parsed = permissionIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    await permRepo.delete(parsed.data.id);
    return reply.send({ ok: true });
  });
}
