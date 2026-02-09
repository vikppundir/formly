/**
 * Registration routes: register, send OTP, verify OTP.
 * Rate limiting applied for security.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { registerSchema, sendOtpSchema, verifyOtpSchema } from "../validations/register.validation.js";
import { createOtpService } from "../services/otp.service.js";
import { createEmailService } from "../services/email.service.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

const AUTH_RATE_LIMIT = {
  max: getEnv().RATE_LIMIT_AUTH_MAX,
  timeWindow: getEnv().RATE_LIMIT_AUTH_WINDOW_MS,
};

export async function registerRegisterRoutes(
  app: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  const otpService = createOtpService(prisma);
  const emailService = createEmailService(prisma);
  const settingsRepo = createSettingsRepository(prisma);

  // Register new user
  app.post(
    "/auth/register",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { name, email, phone, password, acceptTerms, acceptPrivacy, acceptDpa } = parsed.data;

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email, deletedAt: null },
            ...(phone ? [{ phone, deletedAt: null }] : []),
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return reply.status(409).send({ error: "Email already registered" });
        }
        if (phone && existingUser.phone === phone) {
          return reply.status(409).send({ error: "Phone number already registered" });
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Check verification settings
      const [emailEnabled, phoneEnabled] = await Promise.all([
        otpService.isEmailVerificationEnabled(),
        otpService.isPhoneVerificationEnabled(),
      ]);

      // Determine initial status
      const needsVerification = emailEnabled || (phone && phoneEnabled);
      const status = needsVerification ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE;

      // Create user with terms acceptance timestamps
      const now = new Date();
      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          password: passwordHash,
          status,
          emailVerified: !emailEnabled, // If email verification disabled, mark as verified
          phoneVerified: !phone || !phoneEnabled, // If phone verification disabled or no phone, mark as verified
          termsAcceptedAt: acceptTerms ? now : null,
          privacyAcceptedAt: acceptPrivacy ? now : null,
          dpaAcceptedAt: acceptDpa ? now : null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          status: true,
        },
      });

      // Assign default "User" role
      const userRole = await prisma.role.findUnique({ where: { name: "User" } });
      if (userRole) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: userRole.id },
        });
      }

      // Send verification OTP if needed
      if (emailEnabled) {
        await otpService.sendEmailOtp({ email, userId: user.id, name });
      }

      logger.info("User registered", { userId: user.id });

      return reply.status(201).send({
        user,
        message: needsVerification
          ? "Registration successful. Please verify your email/phone."
          : "Registration successful.",
        verificationRequired: {
          email: emailEnabled && !user.emailVerified,
          phone: phone && phoneEnabled && !user.phoneVerified,
        },
      });
    }
  );

  // Send OTP
  app.post(
    "/auth/send-otp",
    { config: { rateLimit: { max: 5, timeWindow: 60000 } } }, // 5 per minute
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = sendOtpSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { type, email, phone } = parsed.data;

      if (type === "email" && email) {
        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
        });

        if (!user) {
          // Don't reveal if email exists
          return reply.send({ ok: true, message: "If this email is registered, OTP has been sent." });
        }

        if (user.emailVerified) {
          return reply.status(400).send({ error: "Email already verified" });
        }

        const result = await otpService.sendEmailOtp({ email, userId: user.id, name: user.name });
        if (!result.success) {
          return reply.status(500).send({ error: result.error || "Failed to send OTP" });
        }
      } else if (type === "phone" && phone) {
        const user = await prisma.user.findFirst({
          where: { phone, deletedAt: null },
        });

        if (!user) {
          return reply.send({ ok: true, message: "If this phone is registered, OTP has been sent." });
        }

        if (user.phoneVerified) {
          return reply.status(400).send({ error: "Phone already verified" });
        }

        const result = await otpService.sendPhoneOtp({ phone, userId: user.id });
        if (!result.success) {
          return reply.status(500).send({ error: result.error || "Failed to send OTP" });
        }
      }

      return reply.send({ ok: true, message: "OTP sent successfully" });
    }
  );

  // Verify OTP
  app.post(
    "/auth/verify-otp",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, // 10 per minute
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = verifyOtpSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { type, email, phone, otp } = parsed.data;

      if (type === "email" && email) {
        const result = await otpService.verifyEmailOtp(email, otp);
        if (!result.success) {
          return reply.status(400).send({ error: result.error });
        }

        // Update user
        const user = await prisma.user.update({
          where: { email },
          data: { emailVerified: true },
        });

        // Check if all verifications complete
        const phoneEnabled = await otpService.isPhoneVerificationEnabled();
        const allVerified = user.emailVerified && (!user.phone || !phoneEnabled || user.phoneVerified);

        if (allVerified && user.status === UserStatus.PENDING_VERIFICATION) {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE },
          });

          // Send welcome email
          await emailService.send({
            to: email,
            templateCode: "welcome",
            variables: { name: user.name },
          });
        }

        logger.info("Email verified");
        return reply.send({ ok: true, message: "Email verified successfully", allVerified });
      } else if (type === "phone" && phone) {
        const result = await otpService.verifyPhoneOtp(phone, otp);
        if (!result.success) {
          return reply.status(400).send({ error: result.error });
        }

        // Update user
        const user = await prisma.user.update({
          where: { phone },
          data: { phoneVerified: true },
        });

        // Check if all verifications complete
        const emailEnabled = await otpService.isEmailVerificationEnabled();
        const allVerified = user.phoneVerified && (!emailEnabled || user.emailVerified);

        if (allVerified && user.status === UserStatus.PENDING_VERIFICATION) {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE },
          });

          // Send welcome email
          await emailService.send({
            to: user.email,
            templateCode: "welcome",
            variables: { name: user.name },
          });
        }

        logger.info("Phone verified");
        return reply.send({ ok: true, message: "Phone verified successfully", allVerified });
      }

      return reply.status(400).send({ error: "Invalid verification type" });
    }
  );

  // Get verification status - returns generic response to prevent user enumeration
  app.get(
    "/auth/verification-status",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, phone } = request.query as { email?: string; phone?: string };

      if (!email && !phone) {
        return reply.status(400).send({ error: "Email or phone required" });
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
          deletedAt: null,
        },
        select: {
          emailVerified: true,
          phoneVerified: true,
          status: true,
        },
      });

      // Return generic response whether user exists or not to prevent enumeration
      if (!user) {
        const [emailEnabled, phoneEnabled] = await Promise.all([
          otpService.isEmailVerificationEnabled(),
          otpService.isPhoneVerificationEnabled(),
        ]);
        return reply.send({
          emailVerified: false,
          phoneVerified: false,
          verificationRequired: {
            email: emailEnabled,
            phone: phoneEnabled,
          },
        });
      }

      const [emailEnabled, phoneEnabled] = await Promise.all([
        otpService.isEmailVerificationEnabled(),
        otpService.isPhoneVerificationEnabled(),
      ]);

      return reply.send({
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        verificationRequired: {
          email: emailEnabled && !user.emailVerified,
          phone: phoneEnabled && !user.phoneVerified,
        },
      });
    }
  );

  // Get verification settings (public)
  app.get(
    "/auth/verification-settings",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const [emailEnabled, phoneEnabled] = await Promise.all([
        otpService.isEmailVerificationEnabled(),
        otpService.isPhoneVerificationEnabled(),
      ]);

      return reply.send({
        emailVerificationEnabled: emailEnabled,
        phoneVerificationEnabled: phoneEnabled,
      });
    }
  );
}
