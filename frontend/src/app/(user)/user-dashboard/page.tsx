"use client";

/**
 * User Dashboard - Beautiful modern design with Formly branding.
 * Colors: Pink #E91E8C, Navy #2E2A5E
 * Shows profile completion banner, account status, and pending partner requests.
 */

import { useAuth } from "@/contexts/auth-context";
import { useAccount } from "@/contexts/account-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface WebsiteSettings {
  app_name: string;
  website_tagline: string;
  contact_email: string;
  contact_phone: string;
}

// Partner request types
interface PartnerRequest {
  id: string;
  email: string;
  name?: string;
  role?: string;
  ownershipPercent?: number;
  beneficiaryPercent?: number;
  status: string;
  account: {
    id: string;
    name: string;
    accountType: string;
    user?: { name: string; email: string };
    companyProfile?: { companyName?: string };
    partnershipProfile?: { partnershipName?: string };
    trustProfile?: { trustName?: string };
  };
}

interface PendingRequests {
  companyRequests: PartnerRequest[];
  partnershipRequests: PartnerRequest[];
  trustRequests: PartnerRequest[];
}

// Check profile completeness based on account type
function getProfileCompletion(account: ReturnType<typeof useAccount>["currentAccount"]) {
  if (!account) return { complete: false, missingFields: ["No account selected"], percentage: 0 };
  
  const missingFields: string[] = [];
  let totalFields = 0;
  let filledFields = 0;

  if (account.accountType === "INDIVIDUAL") {
    const profile = account.individualProfile;
    // Check for minimum required fields for Individual
    totalFields = 4; // Reduced to essential fields: firstName, lastName, address (or streetAddress), and one of state/suburb/postcode
    
    // Name is required
    if (!profile?.firstName && !profile?.lastName) {
      missingFields.push("Name (First/Last)");
    } else {
      filledFields++;
    }
    
    // Address - check both field names (DB uses 'address', form uses 'streetAddress')
    const hasAddress = profile?.streetAddress || profile?.address;
    if (!hasAddress) {
      missingFields.push("Address");
    } else {
      filledFields++;
    }
    
    // Location details (suburb + state + postcode as one check)
    const hasLocation = profile?.suburb || profile?.state || profile?.postcode;
    if (!hasLocation) {
      missingFields.push("Location (Suburb/State/Postcode)");
    } else {
      filledFields++;
    }
    
    // TFN or Date of Birth (at least one identification)
    const hasIdentification = profile?.tfn || profile?.dateOfBirth;
    if (!hasIdentification) {
      missingFields.push("TFN or Date of Birth");
    } else {
      filledFields++;
    }
  } else if (account.accountType === "COMPANY") {
    const profile = account.companyProfile;
    totalFields = 3; // Reduced: companyName, ABN, businessAddress
    if (!profile?.companyName) missingFields.push("Company Name"); else filledFields++;
    if (!profile?.abn) missingFields.push("ABN"); else filledFields++;
    if (!profile?.businessAddress) missingFields.push("Business Address"); else filledFields++;
  } else if (account.accountType === "TRUST") {
    const profile = account.trustProfile;
    totalFields = 2; // Reduced: trustName, trustType
    if (!profile?.trustName) missingFields.push("Trust Name"); else filledFields++;
    if (!profile?.trustType) missingFields.push("Trust Type"); else filledFields++;
  } else if (account.accountType === "PARTNERSHIP") {
    const profile = account.partnershipProfile;
    totalFields = 2; // Reduced: partnershipName, ABN
    if (!profile?.partnershipName) missingFields.push("Partnership Name"); else filledFields++;
    if (!profile?.abn) missingFields.push("ABN"); else filledFields++;
  }

  const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  return { complete: missingFields.length === 0, missingFields, percentage };
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const { currentAccount, accounts, loading: accountLoading, refresh } = useAccount();
  const [settings, setSettings] = useState<WebsiteSettings>({
    app_name: "JAP Accountants",
    website_tagline: "In-depth Perfect Analysis",
    contact_email: "",
    contact_phone: "",
  });
  const [pendingRequests, setPendingRequests] = useState<PendingRequests>({ companyRequests: [], partnershipRequests: [], trustRequests: [] });
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const profileStatus = currentAccount ? getProfileCompletion(currentAccount) : null;

  useEffect(() => {
    // Fetch public website settings
    fetch(`${API_URL}/public/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
    
    // Load pending partner requests
    loadPendingRequests();
  }, []);

  async function loadPendingRequests() {
    setLoadingRequests(true);
    try {
      const res = await apiGet<PendingRequests>("/partners/all-requests");
      setPendingRequests(res);
    } catch (e) {
      console.error("Failed to load pending requests:", e);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleRespondToRequest(requestId: string, type: "company" | "partnership" | "trust", action: "approve" | "reject") {
    setRespondingTo(requestId);
    try {
      let endpoint: string;
      if (type === "company") {
        endpoint = `/partners/invitations/${requestId}/respond`;
      } else if (type === "partnership") {
        endpoint = `/partnership-partners/invitations/${requestId}/respond`;
      } else {
        endpoint = `/trust-partners/invitations/${requestId}/respond`;
      }
      await apiPost(endpoint, { action });
      await loadPendingRequests();
      await refresh();
    } catch (e) {
      console.error("Failed to respond to request:", e);
    } finally {
      setRespondingTo(null);
    }
  }

  const totalPendingRequests = pendingRequests.companyRequests.length + pendingRequests.partnershipRequests.length + pendingRequests.trustRequests.length;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-8">
      {/* Profile Completion Alert */}
      {!accountLoading && accounts.length === 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">Create Your First Account</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                To purchase services, you need to create an account first. Choose your account type (Individual, Company, Trust, or Partnership) to get started.
              </p>
              <Link
                href="/user-dashboard/accounts/new"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Profile Incomplete Alert */}
      {!accountLoading && currentAccount && profileStatus && !profileStatus.complete && (
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300">Complete Your Account Profile</h3>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{profileStatus.percentage}% Complete</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${profileStatus.percentage}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
                <span className="font-medium">Missing fields:</span> {profileStatus.missingFields.join(", ")}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                Complete your profile to purchase services and enable digital contract signing.
              </p>
              <Link
                href={`/user-dashboard/accounts/${currentAccount.id}`}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Complete Profile
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Pending Partner Requests */}
      {totalPendingRequests > 0 && (
        <div className="rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-800 dark:text-purple-300">
                Partner Requests ({totalPendingRequests})
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-400 mt-1 mb-4">
                You have been invited to join the following accounts as a partner.
              </p>

              <div className="space-y-3">
                {/* Company Partner Requests */}
                {pendingRequests.companyRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-white/5 rounded-xl border border-purple-100 dark:border-purple-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {request.account.companyProfile?.companyName || request.account.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-white/50">
                          Company • Invited by {request.account.user?.name || "Unknown"}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {request.role && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.role}
                            </span>
                          )}
                          {request.ownershipPercent && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.ownershipPercent}% ownership
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "company", "approve")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {respondingTo === request.id ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "company", "reject")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {/* Partnership Partner Requests */}
                {pendingRequests.partnershipRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-white/5 rounded-xl border border-purple-100 dark:border-purple-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {request.account.partnershipProfile?.partnershipName || request.account.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-white/50">
                          Partnership • Invited by {request.account.user?.name || "Unknown"}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {request.role && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.role}
                            </span>
                          )}
                          {request.ownershipPercent && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.ownershipPercent}% ownership
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "partnership", "approve")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {respondingTo === request.id ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "partnership", "reject")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {/* Trust Partner Requests (Trustees & Beneficiaries) */}
                {pendingRequests.trustRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-white/5 rounded-xl border border-purple-100 dark:border-purple-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-800 flex items-center justify-center">
                        <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {request.account.trustProfile?.trustName || request.account.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-white/50">
                          Family Trust • Invited by {request.account.user?.name || "Unknown"}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {request.role && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.role}
                            </span>
                          )}
                          {request.beneficiaryPercent && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {request.beneficiaryPercent}% distribution
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "trust", "approve")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {respondingTo === request.id ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondToRequest(request.id, "trust", "reject")}
                        disabled={respondingTo === request.id}
                        className="px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2E2A5E] via-[#3d3778] to-[#2E2A5E] p-8 sm:p-10">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#E91E8C] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#E91E8C] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[#E91E8C] text-sm font-medium mb-1">{greeting}</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                {user?.name}
              </h1>
              <p className="text-white/60 text-sm sm:text-base">
                Welcome to your personal dashboard
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-2xl shadow-[#E91E8C]/40">
                {user?.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "Account Status", value: "Active", icon: "✓", color: "from-emerald-500 to-emerald-600" },
          { label: "Member Since", value: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), icon: "📅", color: "from-blue-500 to-blue-600" },
          { label: "Email Verified", value: "Yes", icon: "✉️", color: "from-violet-500 to-violet-600" },
          { label: "Support", value: "24/7", icon: "💬", color: "from-[#E91E8C] to-[#c4177a]" },
        ].map((stat, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-[#E91E8C]/10 transition-all duration-300"
          >
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
            <div className="relative">
              <div className="text-2xl mb-3">{stat.icon}</div>
              <p className="text-slate-500 dark:text-white/50 text-sm mb-1">{stat.label}</p>
              <p className="text-slate-900 dark:text-white text-xl font-semibold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Profile</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-sm text-slate-500 dark:text-white/50">{user?.email}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-white/50 mb-1">User ID</p>
                <p className="font-mono text-sm text-slate-700 dark:text-white/80 truncate">{user?.id}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-white/50 mb-1">Role</p>
                <p className="font-medium text-slate-700 dark:text-white/80">{user?.roleNames.join(", ") || "User"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            <Link href="/user-dashboard/profile" className="w-full flex items-center gap-3 p-4 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#E91E8C]/20 to-[#E91E8C]/10 flex items-center justify-center text-[#E91E8C] group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Edit Profile</p>
                <p className="text-sm text-slate-500 dark:text-white/50">Update your information</p>
              </div>
            </Link>
            <Link href="/user-dashboard/change-password" className="w-full flex items-center gap-3 p-4 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E2A5E]/20 to-[#2E2A5E]/10 flex items-center justify-center text-[#2E2A5E] dark:text-white/80 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Change Password</p>
                <p className="text-sm text-slate-500 dark:text-white/50">Update your security</p>
              </div>
            </Link>
            <Link href="/user-dashboard/support" className="w-full flex items-center gap-3 p-4 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Get Help</p>
                <p className="text-sm text-slate-500 dark:text-white/50">Contact support</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      {(settings.contact_email || settings.contact_phone) && (
        <div className="rounded-2xl bg-gradient-to-r from-[#2E2A5E] to-[#3d3778] p-6 sm:p-8">
          <h3 className="text-white font-semibold mb-4">Need Assistance?</h3>
          <div className="flex flex-wrap gap-6">
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-white/80 hover:text-[#E91E8C] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {settings.contact_email}
              </a>
            )}
            {settings.contact_phone && (
              <a href={`tel:${settings.contact_phone}`} className="flex items-center gap-2 text-white/80 hover:text-[#E91E8C] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {settings.contact_phone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
