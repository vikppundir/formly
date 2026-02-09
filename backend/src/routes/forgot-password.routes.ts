/**
 * Forgot password routes: request OTP (email or phone), verify OTP, reset password.
 * Rate-limited for security (SOC 2).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { OtpType } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";
import { createOtpService } from "../services/otp.service.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { logger, writeAuditLog } from "../utils/logger.js";

const FORGOT_RATE_LIMIT = {
  max: 5,
  timeWindow: 60000, // 5 per minute
};

// Schemas
const forgotPasswordRequestSchema = z.object({
  type: z.enum(["email", "phone"]),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+61\d{9}$/).optional(),
}).refine((data) => {
  if (data.type === "email" && !data.email) return false;
  if (data.type === "phone" && !data.phone) return false;
  return true;
}, { message: "Email or phone required based on type" });

const forgotPasswordVerifySchema = z.object({
  type: z.enum(["email", "phone"]),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+61\d{9}$/).optional(),
  otp: z.string().min(4).max(8),
}).refine((data) => {
  if (data.type === "email" && !data.email) return false;
  if (data.type === "phone" && !data.phone) return false;
  return true;
}, { message: "Email or phone required based on type" });

const forgotPasswordResetSchema = z.object({
  type: z.enum(["email", "phone"]),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+61\d{9}$/).optional(),
  otp: z.string().min(4).max(8),
  newPassword: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
}).refine((data) => {
  if (data.type === "email" && !data.email) return false;
  if (data.type === "phone" && !data.phone) return false;
  return true;
}, { message: "Email or phone required based on type" });

export async function registerForgotPasswordRoutes(
  app: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  const otpService = createOtpService(prisma);
  const refreshTokenRepo = createRefreshTokenRepository(prisma);

  /**
   * POST /auth/forgot-password
   * Send OTP to email or phone for password reset
   */
  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: FORGOT_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = forgotPasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        // Provide a user-friendly error message
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const msg = fieldErrors.email?.[0] || fieldErrors.phone?.[0] || "Please enter a valid email or phone number";
        return reply.status(400).send({ error: msg });
      }

      const { type, email, phone } = parsed.data;

      if (type === "email" && email) {
        // Find user by email
        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
        });

        if (!user) {
          return reply.status(400).send({ error: "No account found with this email address" });
        }

        const result = await otpService.sendEmailOtp({
          email,
          userId: user.id,
          name: user.name,
          type: OtpType.PASSWORD_RESET,
        });

        if (!result.success) {
          logger.error("Failed to send password-reset email OTP", { error: result.error });
          return reply.status(500).send({ error: result.error || "Failed to send OTP" });
        }

        logger.info("Password reset OTP sent via email");
        return reply.send({ ok: true, message: "OTP has been sent to your email" });
      }

      if (type === "phone" && phone) {
        // Find user by phone (must be verified)
        const user = await prisma.user.findFirst({
          where: { phone, phoneVerified: true, deletedAt: null },
        });

        if (!user) {
          return reply.status(400).send({ error: "No account found with this phone number, or phone is not verified" });
        }

        const result = await otpService.sendPhonePasswordResetOtp({
          phone,
          userId: user.id,
        });

        if (!result.success) {
          logger.error("Failed to send password-reset phone OTP", { error: result.error });
          return reply.status(500).send({ error: result.error || "Failed to send OTP" });
        }

        logger.info("Password reset OTP sent via phone");
        return reply.send({ ok: true, message: "OTP has been sent to your phone" });
      }

      return reply.status(400).send({ error: "Invalid request" });
    }
  );

  /**
   * POST /auth/forgot-password/verify
   * Verify the OTP (step before password reset, optional pre-check)
   */
  app.post(
    "/auth/forgot-password/verify",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = forgotPasswordVerifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { type, email, phone, otp } = parsed.data;

      let result: { success: boolean; error?: string };

      if (type === "email" && email) {
        result = await otpService.verifyPasswordResetOtp(email, otp);
      } else if (type === "phone" && phone) {
        result = await otpService.verifyPhonePasswordResetOtp(phone, otp);
      } else {
        return reply.status(400).send({ error: "Invalid request" });
      }

      if (!result.success) {
        return reply.status(400).send({ error: result.error || "Invalid OTP" });
      }

      return reply.send({ ok: true, message: "OTP verified. You can now reset your password." });
    }
  );

  /**
   * POST /auth/forgot-password/reset
   * Verify OTP + set new password in one step
   */
  app.post(
    "/auth/forgot-password/reset",
    { config: { rateLimit: FORGOT_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = forgotPasswordResetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { type, email, phone, otp, newPassword } = parsed.data;

      // Verify OTP first
      let result: { success: boolean; error?: string };

      if (type === "email" && email) {
        result = await otpService.verifyPasswordResetOtp(email, otp);
      } else if (type === "phone" && phone) {
        result = await otpService.verifyPhonePasswordResetOtp(phone, otp);
      } else {
        return reply.status(400).send({ error: "Invalid request" });
      }

      if (!result.success) {
        return reply.status(400).send({ error: result.error || "Invalid OTP" });
      }

      // Find user
      let user;
      if (type === "email" && email) {
        user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
      } else if (type === "phone" && phone) {
        user = await prisma.user.findFirst({ where: { phone, phoneVerified: true, deletedAt: null } });
      }

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Hash and update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      });

      // Invalidate all existing sessions to prevent continued access with old tokens
      await refreshTokenRepo.revokeAllForUser(user.id);

      writeAuditLog({
        action: "PASSWORD_RESET",
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        details: { method: type },
      });
      logger.info("Password reset successful, all sessions invalidated", { userId: user.id, type });

      return reply.send({ ok: true, message: "Password has been reset successfully. You can now login." });
    }
  );
}
