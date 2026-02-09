import { OtpType, PrismaClient } from "@prisma/client";
import crypto from "crypto";

export function createOtpRepository(prisma: PrismaClient) {
  return {
    // Create OTP record
    async create(data: {
      userId?: string;
      email?: string;
      phone?: string;
      otp: string;
      type: OtpType;
      expiresAt: Date;
    }) {
      // Hash the OTP before storing
      const otpHash = crypto.createHash("sha256").update(data.otp).digest("hex");
      return prisma.otpVerification.create({
        data: {
          ...data,
          otp: otpHash,
        },
      });
    },

    // Find valid OTP
    async findValid(params: {
      email?: string;
      phone?: string;
      type: OtpType;
    }) {
      return prisma.otpVerification.findFirst({
        where: {
          ...(params.email && { email: params.email }),
          ...(params.phone && { phone: params.phone }),
          type: params.type,
          verified: false,
          expiresAt: { gte: new Date() },
          attempts: { lt: 5 }, // Max 5 attempts
        },
        orderBy: { createdAt: "desc" },
      });
    },

    // Verify OTP
    async verify(id: string, otp: string) {
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      const record = await prisma.otpVerification.findUnique({ where: { id } });
      
      if (!record || record.verified || record.expiresAt < new Date()) {
        return { success: false, error: "OTP expired or invalid" };
      }

      if (record.attempts >= 5) {
        return { success: false, error: "Too many attempts. Request a new OTP." };
      }

      if (record.otp !== otpHash) {
        await prisma.otpVerification.update({
          where: { id },
          data: { attempts: { increment: 1 } },
        });
        return { success: false, error: "Invalid OTP" };
      }

      // Delete the OTP record immediately after successful verification
      // to prevent replay attacks (instead of just marking as verified)
      await prisma.otpVerification.delete({
        where: { id },
      });

      return { success: true, record };
    },

    // Mark as verified by email/phone
    async markVerified(params: { email?: string; phone?: string; type: OtpType }) {
      return prisma.otpVerification.updateMany({
        where: {
          ...(params.email && { email: params.email }),
          ...(params.phone && { phone: params.phone }),
          type: params.type,
          verified: false,
        },
        data: { verified: true },
      });
    },

    // Delete expired OTPs (cleanup job)
    async deleteExpired() {
      return prisma.otpVerification.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { verified: true },
          ],
        },
      });
    },
  };
}
