"use client";

/**
 * Public registration page with email/phone OTP verification.
 */

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Step = "form" | "verify-email" | "verify-phone" | "complete";

interface VerificationSettings {
  emailVerificationEnabled: boolean;
  phoneVerificationEnabled: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);

  // OTP
  const [otp, setOtp] = useState("");
  const [otpType, setOtpType] = useState<"email" | "phone">("email");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Verification settings
  const [verifySettings, setVerifySettings] = useState<VerificationSettings>({
    emailVerificationEnabled: true,
    phoneVerificationEnabled: false,
  });

  // Verification requirements after registration
  const [verificationRequired, setVerificationRequired] = useState({
    email: false,
    phone: false,
  });

  // Fetch verification settings on mount
  useEffect(() => {
    fetch(`${API_URL}/auth/verification-settings`)
      .then((r) => r.json())
      .then((data) => {
        setVerifySettings({
          emailVerificationEnabled: data.emailVerificationEnabled ?? true,
          phoneVerificationEnabled: data.phoneVerificationEnabled ?? false,
        });
      })
      .catch(() => {});
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (user) {
    router.replace("/dashboard");
    return null;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!acceptTerms || !acceptPrivacy || !acceptDpa) {
      setError("You must accept all agreements to create an account");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, password, acceptTerms, acceptPrivacy, acceptDpa }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setVerificationRequired(data.verificationRequired || { email: false, phone: false });

      if (data.verificationRequired?.email) {
        setOtpType("email");
        setStep("verify-email");
        setSuccess("Registration successful! Please verify your email.");
        setResendCooldown(60);
      } else if (data.verificationRequired?.phone) {
        setOtpType("phone");
        setStep("verify-phone");
        setSuccess("Registration successful! Please verify your phone.");
        setResendCooldown(60);
      } else {
        setStep("complete");
        setSuccess("Registration complete! You can now sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: otpType,
          email: otpType === "email" ? email : undefined,
          phone: otpType === "phone" ? phone : undefined,
          otp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setOtp("");

      // Check if phone verification is also needed
      if (otpType === "email" && verificationRequired.phone) {
        setOtpType("phone");
        setStep("verify-phone");
        setSuccess("Email verified! Now verify your phone.");
        setResendCooldown(60);
        // Send phone OTP
        await fetch(`${API_URL}/auth/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "phone", phone }),
        });
      } else {
        setStep("complete");
        setSuccess("All verifications complete! You can now sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: otpType,
          email: otpType === "email" ? email : undefined,
          phone: otpType === "phone" ? phone : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setSuccess("OTP sent successfully!");
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSubmitting(false);
    }
  }

  // Registration Form
  if (step === "form") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
            Create Account
          </h1>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number <span className="text-slate-400">(optional)</span>
              </label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-3 rounded-l-xl bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium min-h-[48px] flex items-center">
                  🇦🇺 +61
                </span>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone.startsWith("+61") ? phone.substring(3) : phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").substring(0, 9);
                    setPhone(digits ? "+61" + digits : "");
                  }}
                  placeholder="4XX XXX XXX"
                  maxLength={11}
                  className="flex-1 rounded-r-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Min 8 chars, uppercase, lowercase, number, special char
              </p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            {/* Legal Agreements */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Legal Agreements</p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  I agree to the{" "}
                  <Link href="/p/terms-of-service" target="_blank" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">Terms of Service</Link>
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  I have read and accept the{" "}
                  <Link href="/p/privacy-policy" target="_blank" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">Privacy Policy</Link>
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={acceptDpa} onChange={(e) => setAcceptDpa(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  I consent to the{" "}
                  <Link href="/p/data-processing-agreement" target="_blank" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">Data Processing Agreement</Link>
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
            <button
              type="submit"
              disabled={submitting || !acceptTerms || !acceptPrivacy || !acceptDpa}
              className="w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.99] transition-transform"
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // OTP Verification
  if (step === "verify-email" || step === "verify-phone") {
    const isEmail = step === "verify-email";
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {isEmail ? "Verify Email" : "Verify Phone"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            We sent a verification code to{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {isEmail ? email : phone}
            </span>
          </p>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-xl tracking-[0.5em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length < 4}
              className="w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.99] transition-transform"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || submitting}
              className="text-sm text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete
  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 sm:p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Registration Complete!
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Your account has been created and verified. You can now sign in.
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 active:scale-[0.99] transition-transform"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
