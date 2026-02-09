/**
 * User management API - CRUD, assign roles.
 * Protected by auth + manage_users permission.
 */

import type { FastifyInstance } from "fastify";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createUserRepository } from "../repositories/user.repository.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../validations/user.validation.js";
import { writeAuditLog } from "../utils/logger.js";
import type { PrismaClient } from "@prisma/client";

export async function registerUsersRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const userRepo = createUserRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  const preHandler = [authMiddleware, requirePermission("manage_users")];

  app.get("/users", { preHandler }, async (request, reply) => {
    const query = request.query as { page?: string; limit?: string };
    const skip = Math.max(0, (Number(query.page) || 1) - 1) * (Number(query.limit) || 50);
    const take = Math.min(100, Number(query.limit) || 50);
    const { users, total } = await userRepo.list(skip, take);
    const safe = users.map((u) => {
      const { password: _, ...rest } = u;
      return rest;
    });
    return reply.send({ users: safe, total });
  });

  app.get("/users/:id", { preHandler }, async (request, reply) => {
    const parsed = userIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    const user = await userRepo.findById(parsed.data.id);
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { password: _, ...safe } = user;
    return reply.send(safe);
  });

  app.post("/users", { preHandler }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { password, roleIds, ...rest } = parsed.data;
    const passwordHash = await authService.hashPassword(password);
    const existing = await userRepo.findByEmail(parsed.data.email);
    if (existing) return reply.status(409).send({ error: "Email already in use" });
    const user = await userRepo.create({
      name: rest.name,
      email: rest.email,
      passwordHash,
      status: rest.status,
    });
    if (roleIds?.length) await userRepo.setRoles(user.id, roleIds);
    const created = await userRepo.findById(user.id);
    if (!created) return reply.status(500).send({ error: "Failed to load created user" });
    const { password: _, ...safe } = created;
    const req = request as AuthenticatedRequest;
    writeAuditLog({
      action: "USER_CREATED",
      userId: req.user?.sub,
      targetId: user.id,
      targetType: "User",
      ipAddress: request.ip,
      details: { email: rest.email },
    });
    return reply.status(201).send(safe);
  });

  app.patch("/users/:id", { preHandler }, async (request, reply) => {
    const params = (request as { params: { id?: string } }).params;
    const parsedParam = userIdParamSchema.safeParse(params);
    if (!parsedParam.success) return reply.status(400).send({ error: "Invalid id" });
    const parsedBody = updateUserSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsedBody.error.flatten() });
    }
    const { password, roleIds, ...rest } = parsedBody.data;
    const update: { name?: string; email?: string; passwordHash?: string; status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" } = { ...rest };
    if (password) update.passwordHash = await authService.hashPassword(password);
    if (Object.keys(update).length > 0) await userRepo.update(parsedParam.data.id, update);
    if (roleIds !== undefined) await userRepo.setRoles(parsedParam.data.id, roleIds);
    const user = await userRepo.findById(parsedParam.data.id);
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { password: _, ...safe } = user;
    return reply.send(safe);
  });

  app.delete("/users/:id", { preHandler }, async (request, reply) => {
    const parsed = userIdParamSchema.safeParse((request as { params: { id?: string } }).params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid id" });
    await userRepo.softDelete(parsed.data.id);
    const req = request as AuthenticatedRequest;
    writeAuditLog({
      action: "USER_DELETED",
      userId: req.user?.sub,
      targetId: parsed.data.id,
      targetType: "User",
      ipAddress: request.ip,
    });
    return reply.send({ ok: true });
  });
}
