/**
 * Current user (me) - example protected API route.
 * Requires auth middleware and view_dashboard permission.
 */

import type { FastifyInstance } from "fastify";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createUserRepository } from "../repositories/user.repository.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { logger, writeAuditLog } from "../utils/logger.js";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+61\d{9}$/, "Australian phone number required (+61 followed by 9 digits)")
    .optional()
    .nullable(),
});

export async function registerMeRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const userRepo = createUserRepository(prisma);
  const refreshTokenRepo = createRefreshTokenRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  app.get(
    "/me",
    { preHandler: [authMiddleware, requirePermission("view_dashboard")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const dbUser = await userRepo.findById(req.user!.sub);
      if (!dbUser) return reply.status(404).send({ error: "User not found" });
      const permissions = req.user?.permissions ?? (await authService.getPermissionsForUser(req.user!.sub));
      const user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        phoneVerified: dbUser.phoneVerified,
        termsAcceptedAt: dbUser.termsAcceptedAt,
        privacyAcceptedAt: dbUser.privacyAcceptedAt,
        dpaAcceptedAt: dbUser.dpaAcceptedAt,
        permissions,
        roleNames: dbUser.userRoles.map((ur) => ur.role.name),
      };
      return reply.send({ user });
    }
  );

  // Update profile (name and phone)
  app.patch(
    "/me",
    { preHandler: [authMiddleware, requirePermission("view_dashboard")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const dbUser = await userRepo.findById(req.user!.sub);
      if (!dbUser) return reply.status(404).send({ error: "User not found" });

      const updateData: { name?: string; phone?: string | null; phoneVerified?: boolean } = {};

      if (parsed.data.name) {
        updateData.name = parsed.data.name;
      }

      // Handle phone update
      if (parsed.data.phone !== undefined) {
        const newPhone = parsed.data.phone || null;
        
        // If phone is being changed, check if it's already taken
        if (newPhone && newPhone !== dbUser.phone) {
          const existingUser = await prisma.user.findFirst({
            where: { phone: newPhone, id: { not: req.user!.sub }, deletedAt: null },
          });
          if (existingUser) {
            return reply.status(409).send({ error: "Phone number already registered" });
          }
          updateData.phone = newPhone;
          updateData.phoneVerified = false; // Reset verification when phone changes
        } else if (newPhone === null || newPhone === "") {
          updateData.phone = null;
          updateData.phoneVerified = false;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: req.user!.sub },
          data: updateData,
        });
      }

      return reply.send({ ok: true, message: "Profile updated" });
    }
  );

  // Change password
  app.post(
    "/me/change-password",
    { preHandler: [authMiddleware, requirePermission("view_dashboard")], config: { rateLimit: { max: 5, timeWindow: 60000 } } },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { currentPassword, newPassword } = parsed.data;

      // Get user with password
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { id: true, password: true },
      });

      if (!dbUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isValid) {
        return reply.status(400).send({ error: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: req.user!.sub },
        data: { password: newPasswordHash },
      });

      // Revoke all other active sessions for security
      await refreshTokenRepo.revokeAllForUser(req.user!.sub);

      writeAuditLog({
        action: "PASSWORD_CHANGED",
        userId: req.user!.sub,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      logger.info("Password changed, all sessions revoked", { userId: req.user!.sub });

      return reply.send({ ok: true, message: "Password changed successfully. Please login again." });
    }
  );
}
