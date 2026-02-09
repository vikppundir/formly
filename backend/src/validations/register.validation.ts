import { z } from "zod";

// Registration request
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\+61\d{9}$/, "Australian phone number required (+61 followed by 9 digits)").optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  // Terms acceptance at registration (all required)
  acceptTerms: z.boolean().refine((v) => v === true, "You must accept the Terms of Service"),
  acceptPrivacy: z.boolean().refine((v) => v === true, "You must accept the Privacy Policy"),
  acceptDpa: z.boolean().refine((v) => v === true, "You must accept the Data Processing Agreement"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Send OTP request
export const sendOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+61\d{9}$/).optional(),
  type: z.enum(["email", "phone"]),
}).refine((data) => {
  if (data.type === "email" && !data.email) return false;
  if (data.type === "phone" && !data.phone) return false;
  return true;
}, {
  message: "Email or phone required based on type",
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

// Verify OTP request
export const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+61\d{9}$/).optional(),
  otp: z.string().min(4).max(8),
  type: z.enum(["email", "phone"]),
}).refine((data) => {
  if (data.type === "email" && !data.email) return false;
  if (data.type === "phone" && !data.phone) return false;
  return true;
}, {
  message: "Email or phone required based on type",
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Resend OTP
export const resendOtpSchema = sendOtpSchema;
export type ResendOtpInput = SendOtpInput;
