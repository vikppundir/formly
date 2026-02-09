"use client";

/**
 * User Profile Page - Edit profile, phone verification (Twilio), change password.
 * Phone numbers are Australia-only (+61) - validated via Twilio when admin enables it.
 */

import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function UserProfilePage() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Phone change mode (separate from full edit)
  const [changingNumber, setChangingNumber] = useState(false);
  const [newPhone, setNewPhone] = useState("");

  // Phone verify states
  const [phoneVerificationEnabled, setPhoneVerificationEnabled] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState("");

  // Password modal state
  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch phone verification setting from admin
  const fetchVerificationSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/verification-settings`);
      if (res.ok) {
        const data = await res.json();
        setPhoneVerificationEnabled(data.phoneVerificationEnabled === true);
      }
    } catch {
      // Silently fail - verification just won't show
    }
  }, []);

  useEffect(() => {
    fetchVerificationSettings();
  }, [fetchVerificationSettings]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  // Validate AU phone: +61 followed by 9 digits
  function isValidAuPhone(p: string): boolean {
    return /^\+61\d{9}$/.test(p.replace(/\s/g, ""));
  }

  // Save profile (name only when editing, or name + phone)
  async function handleSaveProfile() {
    if (phone && !isValidAuPhone(phone)) {
      setError("Invalid phone number. Enter 9 digits after +61 (e.g., +61412345678)");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const cleanPhone = phone || null;
      const res = await fetch(`${API_URL}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSuccess("Profile updated successfully");
      setEditing(false);
      await refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Save changed number
  async function handleSaveNewNumber() {
    const fullNumber = newPhone ? `+61${newPhone}` : "";
    if (fullNumber && !isValidAuPhone(fullNumber)) {
      setVerifyError("Enter 9 digits (e.g., 412345678)");
      return;
    }
    setSaving(true);
    setVerifyError("");
    setVerifySuccess("");
    try {
      const res = await fetch(`${API_URL}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: fullNumber || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setVerifySuccess("Number updated");
      setChangingNumber(false);
      setNewPhone("");
      setShowOtpInput(false);
      setPhoneOtp("");
      await refresh();
      setTimeout(() => setVerifySuccess(""), 3000);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Remove number
  async function handleRemoveNumber() {
    setSaving(true);
    setVerifyError("");
    try {
      const res = await fetch(`${API_URL}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setChangingNumber(false);
      setShowOtpInput(false);
      await refresh();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  // Send phone OTP for verification (via Twilio)
  async function handleSendPhoneOtp() {
    if (!user?.phone) return;
    setSendingOtp(true);
    setVerifyError("");
    setVerifySuccess("");
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "phone", phone: user.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setShowOtpInput(true);
      setVerifySuccess("OTP sent to " + user.phone);
      setTimeout(() => setVerifySuccess(""), 5000);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  }

  // Verify phone OTP
  async function handleVerifyPhoneOtp() {
    if (!user?.phone || !phoneOtp) return;
    setVerifyingPhone(true);
    setVerifyError("");
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "phone", phone: user.phone, otp: phoneOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setVerifySuccess("Phone verified successfully!");
      setShowOtpInput(false);
      setPhoneOtp("");
      await refresh();
      setTimeout(() => setVerifySuccess(""), 3000);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingPhone(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_URL}/me/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setSuccess("Password changed successfully");
      setPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  // Format phone for display: +61 412 345 678
  function formatPhoneDisplay(p: string): string {
    if (!p) return "";
    const digits = p.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("61")) {
      const local = digits.substring(2);
      return `+61 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}`;
    }
    return p;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {error && !passwordModal && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Profile Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#2E2A5E] to-[#3d3778] p-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#E91E8C] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-[#E91E8C]/40">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
            <p className="text-white/60">{user?.email}</p>
            {user?.phone && (
              <p className="text-white/60 flex items-center justify-center sm:justify-start gap-1 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {formatPhoneDisplay(user.phone)}
                {user.phoneVerified ? (
                  <span className="ml-1 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Verified</span>
                ) : (
                  <span className="ml-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Unverified</span>
                )}
              </p>
            )}
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {user?.roleNames.join(", ") || "User"}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Account Information</h3>
          <button
            onClick={() => {
              if (editing) {
                setName(user?.name || "");
                setPhone(user?.phone || "");
              }
              setEditing(!editing);
              setError("");
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white hover:opacity-90 transition-opacity"
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-white/50 mb-2">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]"
                />
              ) : (
                <p className="text-slate-900 dark:text-white font-medium">{user?.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-white/50 mb-2">Email Address</label>
              <p className="text-slate-900 dark:text-white font-medium">{user?.email}</p>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1">Email cannot be changed</p>
            </div>

            {/* Mobile Number - full span */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-500 dark:text-white/50 mb-2">
                Mobile Number
              </label>

              {/* EDITING MODE (full profile edit) */}
              {editing ? (
                <div>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-3 py-3 rounded-l-xl bg-slate-100 dark:bg-white/10 border border-r-0 border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/60 text-sm font-medium whitespace-nowrap">
                      +61
                    </span>
                    <input
                      type="tel"
                      value={phone.startsWith("+61") ? phone.substring(3) : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").substring(0, 9);
                        setPhone(digits ? "+61" + digits : "");
                      }}
                      placeholder="4XX XXX XXX"
                      maxLength={11}
                      className="flex-1 px-4 py-3 rounded-r-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]"
                    />
                  </div>
                </div>
              ) : (
                /* VIEW MODE */
                <div>
                  {/* No phone set */}
                  {!user?.phone ? (
                    <div>
                      {!changingNumber ? (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 dark:text-white/40">Not set</span>
                          <button
                            onClick={() => { setChangingNumber(true); setNewPhone(""); setVerifyError(""); setVerifySuccess(""); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            Add Number
                          </button>
                        </div>
                      ) : (
                        /* Add number inline */
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-2.5 rounded-l-lg bg-slate-100 dark:bg-white/10 border border-r-0 border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/60 text-sm font-medium">
                              +61
                            </span>
                            <input
                              type="tel"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").substring(0, 9))}
                              placeholder="4XX XXX XXX"
                              maxLength={9}
                              autoFocus
                              className="flex-1 px-3 py-2.5 rounded-r-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E91E8C]"
                            />
                            <button
                              onClick={handleSaveNewNumber}
                              disabled={saving || newPhone.length !== 9}
                              className="px-3 py-2.5 rounded-lg text-xs font-medium bg-[#E91E8C] text-white hover:bg-[#c4177a] disabled:opacity-50 transition-colors"
                            >
                              {saving ? "..." : "Save"}
                            </button>
                            <button
                              onClick={() => { setChangingNumber(false); setVerifyError(""); }}
                              className="px-3 py-2.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                            >
                              Cancel
                            </button>
                          </div>
                          {verifyError && <p className="text-xs text-red-600 dark:text-red-400">{verifyError}</p>}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Phone IS set */
                    <div className="space-y-3">
                      {/* Display current number */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-slate-900 dark:text-white font-medium">
                          {formatPhoneDisplay(user.phone)}
                        </span>

                        {/* Verified badge */}
                        {user.phoneVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Unverified
                          </span>
                        )}

                        {/* Change Number button */}
                        <button
                          onClick={() => {
                            setChangingNumber(true);
                            setNewPhone("");
                            setShowOtpInput(false);
                            setPhoneOtp("");
                            setVerifyError("");
                            setVerifySuccess("");
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          Change Number
                        </button>
                      </div>

                      {/* Change number inline form */}
                      {changingNumber && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                          <p className="text-xs text-slate-600 dark:text-white/60 font-medium">Enter new number</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-2.5 rounded-l-lg bg-white dark:bg-white/10 border border-r-0 border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/60 text-sm font-medium">
                              +61
                            </span>
                            <input
                              type="tel"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").substring(0, 9))}
                              placeholder="4XX XXX XXX"
                              maxLength={9}
                              autoFocus
                              className="flex-1 px-3 py-2.5 rounded-r-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E91E8C]"
                            />
                            <button
                              onClick={handleSaveNewNumber}
                              disabled={saving || newPhone.length !== 9}
                              className="px-3 py-2.5 rounded-lg text-xs font-medium bg-[#E91E8C] text-white hover:bg-[#c4177a] disabled:opacity-50 transition-colors"
                            >
                              {saving ? "..." : "Save"}
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setChangingNumber(false); setVerifyError(""); }}
                              className="text-xs text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70"
                            >
                              Cancel
                            </button>
                            <span className="text-slate-300 dark:text-white/20">|</span>
                            <button
                              onClick={handleRemoveNumber}
                              disabled={saving}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              Remove Number
                            </button>
                          </div>
                          {verifyError && <p className="text-xs text-red-600 dark:text-red-400">{verifyError}</p>}
                        </div>
                      )}

                      {/* Verify button (only if admin enabled phone verification via Twilio AND phone not verified AND not changing number) */}
                      {!user.phoneVerified && phoneVerificationEnabled && !changingNumber && (
                        <div className="space-y-2">
                          {!showOtpInput ? (
                            <button
                              onClick={handleSendPhoneOtp}
                              disabled={sendingOtp}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#E91E8C] text-white hover:bg-[#c4177a] transition-colors disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              {sendingOtp ? "Sending OTP..." : "Verify Number"}
                            </button>
                          ) : (
                            /* OTP Input */
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                              <p className="text-xs text-slate-600 dark:text-white/60 mb-2">
                                Enter the OTP sent to {formatPhoneDisplay(user.phone)}
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={phoneOtp}
                                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").substring(0, 6))}
                                  placeholder="Enter OTP"
                                  maxLength={6}
                                  autoFocus
                                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#E91E8C]"
                                />
                                <button
                                  onClick={handleVerifyPhoneOtp}
                                  disabled={verifyingPhone || phoneOtp.length < 4}
                                  className="px-4 py-2.5 rounded-lg text-xs font-medium bg-[#E91E8C] text-white hover:bg-[#c4177a] disabled:opacity-50 transition-colors"
                                >
                                  {verifyingPhone ? "..." : "Verify"}
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={handleSendPhoneOtp}
                                  disabled={sendingOtp}
                                  className="text-xs text-[#E91E8C] hover:underline disabled:opacity-50"
                                >
                                  Resend OTP
                                </button>
                                <button
                                  onClick={() => { setShowOtpInput(false); setPhoneOtp(""); setVerifyError(""); }}
                                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-white/50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {verifyError && <p className="text-xs text-red-600 dark:text-red-400">{verifyError}</p>}
                          {verifySuccess && <p className="text-xs text-green-600 dark:text-green-400">{verifySuccess}</p>}
                        </div>
                      )}

                      {/* Show success/error even when verified */}
                      {(user.phoneVerified || !phoneVerificationEnabled) && verifySuccess && (
                        <p className="text-xs text-green-600 dark:text-green-400">{verifySuccess}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-white/50 mb-2">Role</label>
              <p className="text-slate-900 dark:text-white font-medium">{user?.roleNames.join(", ") || "User"}</p>
            </div>

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-white/50 mb-2">User ID</label>
              <p className="text-slate-700 dark:text-white/70 font-mono text-sm">{user?.id}</p>
            </div>
          </div>

          {editing && (
            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={handleSaveProfile}
                disabled={saving || !name.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-white/10">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E2A5E]/20 to-[#2E2A5E]/10 flex items-center justify-center text-[#2E2A5E] dark:text-white/80">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Password</p>
                <p className="text-sm text-slate-500 dark:text-white/50">Change your account password</p>
              </div>
            </div>
            <button
              onClick={() => {
                setError("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordModal(true);
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1840] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h3>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]" />
                <p className="text-xs text-slate-500 dark:text-white/40 mt-1">Min 8 characters, uppercase, lowercase, number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
              <button onClick={() => { setPasswordModal(false); setError(""); }} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10">Cancel</button>
              <button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white hover:opacity-90 disabled:opacity-50">
                {changingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
