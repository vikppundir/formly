"use client";

/**
 * Forgot Password Page
 * Step 1: Enter email or phone → send OTP
 * Step 2: Enter OTP
 * Step 3: Enter new password → reset
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Step = "request" | "verify" | "success";
type Method = "email" | "phone";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(""); // 9 digits after +61
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const phone = phoneDigits ? `+61${phoneDigits}` : "";

  // Step 1: Request OTP
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (method === "email") {
      if (!email) {
        setError("Please enter your email address");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Please enter a valid email address");
        return;
      }
    }
    if (method === "phone" && phoneDigits.length !== 9) {
      setError("Please enter a valid 9-digit Australian phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: method,
          ...(method === "email" ? { email } : { phone }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setInfo(data.message || "OTP sent successfully");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP + Reset Password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!otp || otp.length < 4) {
      setError("Please enter the OTP");
      return;
    }
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: method,
          ...(method === "email" ? { email } : { phone }),
          otp,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function handleResend() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: method,
          ...(method === "email" ? { email } : { phone }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      setInfo("OTP resent successfully");
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 sm:p-8">

        {/* Success State */}
        {step === "success" && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Password Reset</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {/* Step 1: Request OTP */}
        {step === "request" && (
          <>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Forgot Password
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Enter your email or verified phone number to receive a reset code.
            </p>

            {/* Method Toggle */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5">
              <button
                type="button"
                onClick={() => { setMethod("email"); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  method === "email"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => { setMethod("phone"); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  method === "phone"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                Phone
              </button>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-4">
              {method === "email" ? (
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="reset-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number <span className="text-xs text-slate-400">(verified only)</span>
                  </label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-3 rounded-l-xl bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium min-h-[48px] flex items-center">
                      🇦🇺 +61
                    </span>
                    <input
                      id="reset-phone"
                      type="tel"
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").substring(0, 9))}
                      placeholder="4XX XXX XXX"
                      maxLength={9}
                      className="flex-1 rounded-r-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Only verified phone numbers can be used for password reset.
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {info && <p className="text-sm text-green-600 dark:text-green-400">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? "Sending..." : "Send Reset Code"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Remember your password?{" "}
              <Link href="/login" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}

        {/* Step 2: Verify + Reset */}
        {step === "verify" && (
          <>
            <button
              onClick={() => { setStep("request"); setOtp(""); setError(""); setInfo(""); }}
              className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Reset Password
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Enter the code sent to{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {method === "email" ? email : phone}
              </span>{" "}
              and your new password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").substring(0, 6))}
                  placeholder="Enter OTP"
                  maxLength={6}
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {info && <p className="text-sm text-green-600 dark:text-green-400">{info}</p>}

              <button
                type="submit"
                disabled={loading || !otp || !newPassword || !confirmPassword}
                className="w-full rounded-xl bg-teal-600 text-white py-3 min-h-[48px] text-base font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
