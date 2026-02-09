import { OtpType, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { createOtpRepository } from "../repositories/otp.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createEmailService } from "./email.service.js";
import { createSmsService } from "./sms.service.js";
import { logger } from "../utils/logger.js";

export function createOtpService(prisma: PrismaClient) {
  const otpRepo = createOtpRepository(prisma);
  const settingsRepo = createSettingsRepository(prisma);
  const emailService = createEmailService(prisma);
  const smsService = createSmsService(prisma);

  // Generate cryptographically secure OTP
  function generateOtp(length: number): string {
    const bytes = crypto.randomBytes(length);
    let otp = "";
    for (let i = 0; i < length; i++) {
      otp += (bytes[i] % 10).toString();
    }
    return otp;
  }

  return {
    // Send email OTP
    async sendEmailOtp(params: {
      email: string;
      userId?: string;
      name?: string;
      type?: OtpType;
    }): Promise<{ success: boolean; error?: string }> {
      try {
        const [otpLength, expiryMinutes, emailEnabled] = await Promise.all([
          settingsRepo.getValue("otp_length", "6"),
          settingsRepo.getValue("otp_expiry_minutes", "10"),
          settingsRepo.getValue("email_verification_enabled", "true"),
        ]);

        if (emailEnabled !== "true") {
          return { success: false, error: "Email verification is disabled" };
        }

        const otp = generateOtp(parseInt(otpLength, 10));
        const expiresAt = new Date(Date.now() + parseInt(expiryMinutes, 10) * 60 * 1000);

        // Store OTP
        await otpRepo.create({
          email: params.email,
          userId: params.userId,
          otp,
          type: params.type || OtpType.EMAIL_VERIFICATION,
          expiresAt,
        });

        // Send email
        const result = await emailService.send({
          to: params.email,
          templateCode: params.type === OtpType.PASSWORD_RESET ? "password_reset" : "email_verification",
          variables: {
            name: params.name || "User",
            otp,
            expiryMinutes,
          },
        });

        if (!result.success) {
          return result;
        }

        logger.info("OTP sent to email", { email: params.email, type: params.type || "EMAIL_VERIFICATION" });
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to send OTP";
        logger.error("Email OTP send failed", { error: msg, email: params.email });
        return { success: false, error: msg };
      }
    },

    // Send phone OTP
    async sendPhoneOtp(params: {
      phone: string;
      userId?: string;
    }): Promise<{ success: boolean; error?: string }> {
      try {
        const [otpLength, expiryMinutes, phoneEnabled] = await Promise.all([
          settingsRepo.getValue("otp_length", "6"),
          settingsRepo.getValue("otp_expiry_minutes", "10"),
          settingsRepo.getValue("phone_verification_enabled", "false"),
        ]);

        if (phoneEnabled !== "true") {
          return { success: false, error: "Phone verification is disabled" };
        }

        const otp = generateOtp(parseInt(otpLength, 10));
        const expiresAt = new Date(Date.now() + parseInt(expiryMinutes, 10) * 60 * 1000);

        // Store OTP
        await otpRepo.create({
          phone: params.phone,
          userId: params.userId,
          otp,
          type: OtpType.PHONE_VERIFICATION,
          expiresAt,
        });

        // Send SMS
        const result = await smsService.sendOtp(params.phone, otp);
        if (!result.success) {
          return result;
        }

        logger.info("OTP sent to phone", { phone: params.phone });
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to send OTP";
        logger.error("Phone OTP send failed", { error: msg, phone: params.phone });
        return { success: false, error: msg };
      }
    },

    // Verify email OTP
    async verifyEmailOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
      const record = await otpRepo.findValid({ email, type: OtpType.EMAIL_VERIFICATION });
      if (!record) {
        return { success: false, error: "No valid OTP found. Please request a new one." };
      }

      return otpRepo.verify(record.id, otp);
    },

    // Verify phone OTP
    async verifyPhoneOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
      const record = await otpRepo.findValid({ phone, type: OtpType.PHONE_VERIFICATION });
      if (!record) {
        return { success: false, error: "No valid OTP found. Please request a new one." };
      }

      return otpRepo.verify(record.id, otp);
    },

    // Verify password reset OTP (by email)
    async verifyPasswordResetOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
      const record = await otpRepo.findValid({ email, type: OtpType.PASSWORD_RESET });
      if (!record) {
        return { success: false, error: "No valid OTP found. Please request a new one." };
      }

      return otpRepo.verify(record.id, otp);
    },

    // Send password-reset OTP via phone SMS
    async sendPhonePasswordResetOtp(params: {
      phone: string;
      userId?: string;
    }): Promise<{ success: boolean; error?: string }> {
      try {
        const [otpLength, expiryMinutes] = await Promise.all([
          settingsRepo.getValue("otp_length", "6"),
          settingsRepo.getValue("otp_expiry_minutes", "10"),
        ]);

        const otp = generateOtp(parseInt(otpLength, 10));
        const expiresAt = new Date(Date.now() + parseInt(expiryMinutes, 10) * 60 * 1000);

        await otpRepo.create({
          phone: params.phone,
          userId: params.userId,
          otp,
          type: OtpType.PASSWORD_RESET,
          expiresAt,
        });

        const result = await smsService.sendOtp(params.phone, otp);
        if (!result.success) return result;

        logger.info("Password-reset OTP sent to phone", { phone: params.phone });
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to send OTP";
        logger.error("Phone password-reset OTP send failed", { error: msg, phone: params.phone });
        return { success: false, error: msg };
      }
    },

    // Verify password reset OTP (by phone)
    async verifyPhonePasswordResetOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
      const record = await otpRepo.findValid({ phone, type: OtpType.PASSWORD_RESET });
      if (!record) {
        return { success: false, error: "No valid OTP found. Please request a new one." };
      }

      return otpRepo.verify(record.id, otp);
    },

    // Check if email verification is enabled
    async isEmailVerificationEnabled(): Promise<boolean> {
      return (await settingsRepo.getValue("email_verification_enabled", "true")) === "true";
    },

    // Check if phone verification is enabled
    async isPhoneVerificationEnabled(): Promise<boolean> {
      return (await settingsRepo.getValue("phone_verification_enabled", "false")) === "true";
    },

    // Cleanup expired OTPs
    async cleanup() {
      return otpRepo.deleteExpired();
    },
  };
}
