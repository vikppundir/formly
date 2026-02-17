"use client";

/**
 * Account detail page - View and edit account profile based on type.
 * Dynamic form rendering based on account type.
 * Partnership accounts support multi-partner invitation workflow.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import type { Account, AccountType, IndividualProfile, CompanyProfile, TrustProfile, PartnershipProfile, LegalConsent, RentalProperty } from "@/contexts/account-context";
import { useAccount } from "@/contexts/account-context";
import { useAuth } from "@/contexts/auth-context";

type TrustType = "DISCRETIONARY" | "UNIT" | "HYBRID" | "SMSF" | "OTHER";

// Partnership Partner type for the UI
interface PartnershipPartner {
  id: string;
  email: string;
  name?: string;
  role?: string;
  ownershipPercent?: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
  user?: { id: string; name: string; email: string } | null;
  invitedAt: string;
  respondedAt?: string;
}

// Trust Partner type for the UI (Trustees & Beneficiaries)
interface TrustPartner {
  id: string;
  email: string;
  name?: string;
  role?: string;
  beneficiaryPercent?: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
  user?: { id: string; name: string; email: string } | null;
  invitedAt: string;
  respondedAt?: string;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { refresh } = useAccount();
  const { user } = useAuth();
  const accountId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state for different profile types
  const [individualForm, setIndividualForm] = useState<Partial<IndividualProfile>>({});
  const [companyForm, setCompanyForm] = useState<Partial<CompanyProfile>>({});
  const [trustForm, setTrustForm] = useState<Partial<TrustProfile & { trusteeDetails: string; beneficiaries: string }>>({});
  const [partnershipForm, setPartnershipForm] = useState<Partial<PartnershipProfile & { partners: string }>>({});

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  async function loadAccount() {
    setLoading(true);
    try {
      const res = await apiGet<{ account: Account }>(`/accounts/${accountId}`);
      setAccount(res.account);
      
      // Initialize form based on account type
      if (res.account.accountType === "INDIVIDUAL" && res.account.individualProfile) {
        const profile = res.account.individualProfile;
        setIndividualForm({
          ...profile,
          // Map DB 'address' field to form 'streetAddress' field
          streetAddress: profile.streetAddress || profile.address || "",
          // Convert ISO date to YYYY-MM-DD format for date input
          dateOfBirth: profile.dateOfBirth 
            ? (typeof profile.dateOfBirth === 'string' ? profile.dateOfBirth.split('T')[0] : '')
            : "",
          // Convert spouseDob date format
          spouseDob: profile.spouseDob
            ? (typeof profile.spouseDob === 'string' ? profile.spouseDob.split('T')[0] : '')
            : "",
        });
      } else if (res.account.accountType === "COMPANY" && res.account.companyProfile) {
        setCompanyForm(res.account.companyProfile);
      } else if (res.account.accountType === "TRUST" && res.account.trustProfile) {
        setTrustForm({
          ...res.account.trustProfile,
          trusteeDetails: JSON.stringify(res.account.trustProfile.trusteeDetails || [], null, 2),
          beneficiaries: JSON.stringify(res.account.trustProfile.beneficiaries || [], null, 2),
        });
      } else if (res.account.accountType === "PARTNERSHIP" && res.account.partnershipProfile) {
        setPartnershipForm({
          ...res.account.partnershipProfile,
          partners: JSON.stringify(res.account.partnershipProfile.partners || [], null, 2),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!account) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let profile: Record<string, unknown> = {};
      
      if (account.accountType === "INDIVIDUAL") {
        const rawTfn = (individualForm.tfn || "").replace(/\s/g, "");
        const isMaskedTfn = rawTfn.includes("*"); // Masked from API e.g. "*******21"

        // If TFN is not masked (user entered a new one), validate it
        if (!isMaskedTfn) {
          if (!rawTfn) {
            setError("Tax File Number (TFN) is required for Individual accounts.");
            setSaving(false);
            return;
          }
          if (!/^\d{8,9}$/.test(rawTfn)) {
            setError("TFN must be 8 or 9 digits.");
            setSaving(false);
            return;
          }
        }

        // Ensure boolean and date fields are properly typed
        profile = {
          ...individualForm,
          // Only send TFN if user entered a new value (not masked)
          tfn: isMaskedTfn ? undefined : rawTfn,
          hasAbn: !!individualForm.hasAbn,
          gstRegistered: !!individualForm.gstRegistered,
          hasMedicalCard: !!individualForm.hasMedicalCard,
          hasRentalIncome: !!individualForm.hasRentalIncome,
        };
      } else if (account.accountType === "COMPANY") {
        const companyTfn = (companyForm.tfn || "").replace(/\s/g, "");
        const isMaskedCompanyTfn = companyTfn.includes("*");

        // Validate TFN if user entered a new one (not masked)
        if (!isMaskedCompanyTfn && companyTfn) {
          if (!/^\d{8,9}$/.test(companyTfn)) {
            setError("TFN must be 8 or 9 digits.");
            setSaving(false);
            return;
          }
        }

        profile = {
          ...companyForm,
          // Only send TFN if user entered a new value (not masked)
          tfn: isMaskedCompanyTfn ? undefined : (companyTfn || undefined),
          gstRegistered: !!companyForm.gstRegistered,
          postalSameAsBusiness: companyForm.postalSameAsBusiness !== false,
          directorCount: companyForm.directorCount || 1,
        };
      } else if (account.accountType === "TRUST") {
        const trustTfn = (trustForm.tfn || "").replace(/\s/g, "");
        const isMaskedTrustTfn = trustTfn.includes("*");
        profile = {
          ...trustForm,
          tfn: isMaskedTrustTfn ? undefined : (trustTfn || undefined),
          trusteeDetails: trustForm.trusteeDetails ? JSON.parse(trustForm.trusteeDetails) : [],
          beneficiaries: trustForm.beneficiaries ? JSON.parse(trustForm.beneficiaries) : [],
        };
      } else if (account.accountType === "PARTNERSHIP") {
        const partnerTfn = (partnershipForm.tfn || "").replace(/\s/g, "");
        const isMaskedPartnerTfn = partnerTfn.includes("*");
        profile = {
          ...partnershipForm,
          tfn: isMaskedPartnerTfn ? undefined : (partnerTfn || undefined),
          partners: partnershipForm.partners ? JSON.parse(partnershipForm.partners) : [],
        };
      }

      await apiPatch(`/accounts/${accountId}/profile`, { profile });
      setSuccess("Profile saved successfully");
      await loadAccount();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!account || account.status !== "DRAFT") return;
    setSubmitting(true);
    setError("");

    try {
      await apiPost(`/accounts/${accountId}/submit`, {});
      setSuccess("Account submitted for review");
      await loadAccount();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit account");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-white/60">Account not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push("/user-dashboard/accounts")}
          className="flex items-center gap-2 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Accounts
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{account.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500 dark:text-white/60">{account.accountType}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                account.status === "ACTIVE" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                account.status === "PENDING" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                {account.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Profile Details</h2>
        
        {account.accountType === "INDIVIDUAL" && (
          <IndividualForm form={individualForm} setForm={setIndividualForm} accountId={accountId} />
        )}
        {account.accountType === "COMPANY" && (
          <CompanyForm form={companyForm} setForm={setCompanyForm} accountId={accountId} ownerName={user?.name || ""} ownerEmail={user?.email || ""} />
        )}
        {account.accountType === "TRUST" && (
          <TrustForm form={trustForm} setForm={setTrustForm} accountId={accountId} />
        )}
        {account.accountType === "PARTNERSHIP" && (
          <PartnershipForm form={partnershipForm} setForm={setPartnershipForm} accountId={accountId} ownerName={user?.name || ""} ownerEmail={user?.email || ""} />
        )}

        <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {account.status === "DRAFT" && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 rounded-xl border border-[#0891b2] text-[#0891b2] font-medium hover:bg-[#0891b2]/10 transition-all disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          )}
        </div>
      </div>

      {/* Agreements & Signed Documents Section */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agreements & Signed Documents</h2>
          <a href="/user-dashboard/consents" className="text-sm text-[#0891b2] hover:underline">
            Manage Consents
          </a>
        </div>

        {/* Registration-time agreements (user-level, read-only) */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Accepted at Registration</p>
          <div className="space-y-2">
            {[
              { label: "Terms of Service", date: user?.termsAcceptedAt, link: "/p/terms-of-service" },
              { label: "Privacy Policy", date: user?.privacyAcceptedAt, link: "/p/privacy-policy" },
              { label: "Data Processing Agreement", date: user?.dpaAcceptedAt, link: "/p/data-processing-agreement" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div>
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-slate-900 dark:text-white hover:text-[#0891b2] transition-colors">{item.label}</a>
                    {item.date && (
                      <p className="text-xs text-slate-400 dark:text-white/40">Accepted on {new Date(item.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Accepted</span>
              </div>
            ))}
          </div>
        </div>

        {/* Account-level consents (Tax Agent Authority, Engagement Letter) */}
        {account.legalConsents && account.legalConsents.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3">Account Consents</p>
            <div className="space-y-2">
              {account.legalConsents
                .filter((c) => ["TAX_AGENT_AUTHORITY", "ENGAGEMENT_LETTER"].includes(c.consentType))
                .map((consent) => (
                <div key={consent.id} className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-500 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">
                        {consent.consentType === "TAX_AGENT_AUTHORITY" && "Tax Agent Authority"}
                        {consent.consentType === "ENGAGEMENT_LETTER" && "Engagement Letter"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-white/40">
                        Signed on {new Date(consent.acceptedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Signed</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to sign pending consents */}
        {(!account.legalConsents || !account.legalConsents.some((c) => c.consentType === "TAX_AGENT_AUTHORITY")) && (
          <div className="mt-3">
            <a href="/user-dashboard/consents" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0891b2] text-white text-sm font-medium hover:bg-[#0e7490] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Sign Required Documents
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual Profile Form - Enhanced with ABN lookup, GST, Medical Card, Marital Status, Spouse, Rental Income
function IndividualForm({
  form,
  setForm,
  accountId,
}: {
  form: Partial<IndividualProfile>;
  setForm: React.Dispatch<React.SetStateAction<Partial<IndividualProfile>>>;
  accountId: string;
}) {
  const [abnLookupEnabled, setAbnLookupEnabled] = useState(false);
  const [lookingUpAbn, setLookingUpAbn] = useState(false);
  const [abnLookupResult, setAbnLookupResult] = useState<{
    valid: boolean;
    businessName?: string;
    abnStatus?: string;
    gstRegistered?: boolean;
    entityType?: string;
    error?: string;
    message?: string;
  } | null>(null);

  // Spouse invitation states
  const [sendingSpouseInvite, setSendingSpouseInvite] = useState(false);
  const [spouseInviteResult, setSpouseInviteResult] = useState("");
  const [checkingSpouseEmail, setCheckingSpouseEmail] = useState(false);
  const [spouseEmailExists, setSpouseEmailExists] = useState<{ exists: boolean; name?: string } | null>(null);

  // Check if ABN lookup is enabled
  useEffect(() => {
    apiGet<{ enabled: boolean }>("/abn/settings")
      .then((res) => setAbnLookupEnabled(res.enabled))
      .catch(() => setAbnLookupEnabled(false));
  }, []);

  // ABN Lookup handler
  async function handleAbnLookup() {
    const abn = form.abn?.replace(/\D/g, "");
    if (!abn || abn.length !== 11) {
      setAbnLookupResult({ valid: false, error: "ABN must be exactly 11 digits" });
      return;
    }
    setLookingUpAbn(true);
    setAbnLookupResult(null);
    try {
      const res = await apiPost<{
        valid: boolean;
        businessName?: string;
        entityName?: string;
        abnStatus?: string;
        gstRegistered?: boolean;
        entityType?: string;
        error?: string;
        message?: string;
      }>("/abn/lookup", { abn });
      setAbnLookupResult(res);
      if (res.valid) {
        setForm((f) => ({
          ...f,
          abnRegisteredName: res.businessName || res.entityName || "",
          abnStatus: res.abnStatus || "",
          gstRegistered: res.gstRegistered ?? f.gstRegistered,
        }));
      }
    } catch (e) {
      setAbnLookupResult({
        valid: false,
        error: e instanceof Error ? e.message : "ABN lookup failed",
      });
    } finally {
      setLookingUpAbn(false);
    }
  }

  // Check spouse email
  async function checkSpouseEmail(email: string) {
    if (!email || !email.includes("@")) {
      setSpouseEmailExists(null);
      return;
    }
    setCheckingSpouseEmail(true);
    try {
      const res = await apiGet<{ exists: boolean; name?: string }>(`/partners/check-email?email=${encodeURIComponent(email)}`);
      setSpouseEmailExists(res);
      if (res.exists && res.name && !form.spouseName) {
        setForm((f) => ({ ...f, spouseName: res.name || "" }));
      }
    } catch {
      // Ignore check errors
    } finally {
      setCheckingSpouseEmail(false);
    }
  }

  // Send spouse invitation (when in Australia)
  async function handleSendSpouseInvite() {
    if (!form.spouseName || !form.spouseEmail) return;
    setSendingSpouseInvite(true);
    setSpouseInviteResult("");
    try {
      const res = await apiPost<{ ok: boolean; message: string }>("/spouse/invite", {
        accountId,
        name: form.spouseName,
        email: form.spouseEmail,
      });
      setSpouseInviteResult(res.message);
      setForm((f) => ({ ...f, spouseStatus: "PENDING" }));
    } catch (e) {
      setSpouseInviteResult(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setSendingSpouseInvite(false);
    }
  }

  const isMarried = form.maritalStatus === "MARRIED" || form.maritalStatus === "DE_FACTO";

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2";
  const sectionHeader = "text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* ============================================================ */}
      {/* PERSONAL DETAILS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3">
        <h3 className={sectionHeader}>Personal Details</h3>
      </div>
      <div>
        <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.firstName || ""} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="John" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Middle Name <span className="text-slate-400">(optional)</span></label>
        <input type="text" value={form.middleName || ""} onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))} placeholder="William" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.lastName || ""} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Date of Birth</label>
        <input type="date" value={form.dateOfBirth || ""} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>TFN <span className="text-red-500">*</span></label>
        {form.tfn && form.tfn.includes("*") ? (
          /* TFN is masked from server — show read-only with change option */
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono tracking-widest">
              {form.tfn}
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, tfn: "" }))}
              className="px-3 py-3 rounded-xl text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Change TFN
            </button>
          </div>
        ) : (
          /* No TFN or user is entering a new one */
          <input
            type="text"
            value={form.tfn || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, "");
              setForm((f) => ({ ...f, tfn: val }));
            }}
            maxLength={14}
            placeholder="XXX XXX XXX"
            className={inputClass}
            required
          />
        )}
        <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Tax File Number (required, unique per account). Stored encrypted.</p>
      </div>

      {/* ============================================================ */}
      {/* ABN SECTION */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-6">
        <h3 className={sectionHeader}>Business Registration</h3>
      </div>
      <div className="sm:col-span-3">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.hasAbn || false}
            onChange={(e) => {
              setForm((f) => ({
                ...f,
                hasAbn: e.target.checked,
                ...(e.target.checked ? {} : { abn: "", abnRegisteredName: "", abnStatus: "" }),
              }));
              setAbnLookupResult(null);
            }}
            className="w-5 h-5 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-white">Do you have an ABN?</span>
            <p className="text-xs text-slate-500 dark:text-white/50">Australian Business Number - required if you run a business as a sole trader</p>
          </div>
        </label>
      </div>

      {form.hasAbn && (
        <>
          <div className="sm:col-span-2">
            <label className={labelClass}>ABN (11 digits)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.abn || ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d\s]/g, "");
                  setForm((f) => ({ ...f, abn: val }));
                  setAbnLookupResult(null);
                }}
                maxLength={14}
                placeholder="XX XXX XXX XXX"
                className={inputClass}
              />
              {abnLookupEnabled && (
                <button
                  type="button"
                  onClick={handleAbnLookup}
                  disabled={lookingUpAbn || !form.abn || form.abn.replace(/\D/g, "").length !== 11}
                  className="px-4 py-3 rounded-xl bg-[#1B1464] text-white text-sm font-medium hover:bg-[#1B1464]/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {lookingUpAbn ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify ABN"
                  )}
                </button>
              )}
            </div>
            {!abnLookupEnabled && (
              <p className="text-xs text-slate-400 dark:text-white/40 mt-1">ABN auto-validation is not enabled. Enter your ABN manually.</p>
            )}
          </div>

          {/* ABN Lookup Result */}
          {abnLookupResult && (
            <div className="sm:col-span-3">
              {abnLookupResult.valid ? (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-green-700 dark:text-green-400">ABN Verified</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      abnLookupResult.abnStatus?.toLowerCase() === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {abnLookupResult.abnStatus}
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <span className="font-medium">Business:</span> {abnLookupResult.businessName}
                  </p>
                  {abnLookupResult.entityType && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">Entity type: {abnLookupResult.entityType}</p>
                  )}
                  {abnLookupResult.gstRegistered && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">GST Registered</p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {abnLookupResult.error || "Invalid ABN"}
                    </span>
                  </div>
                  {abnLookupResult.message && (
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">{abnLookupResult.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelClass}>Registered Business Name</label>
            <input
              type="text"
              value={form.abnRegisteredName || ""}
              onChange={(e) => setForm((f) => ({ ...f, abnRegisteredName: e.target.value }))}
              placeholder="Auto-filled from ABN lookup"
              readOnly={!!abnLookupResult?.valid}
              className={`${inputClass} ${abnLookupResult?.valid ? "bg-slate-50 dark:bg-white/10" : ""}`}
            />
          </div>
          <div>
            <label className={labelClass}>ABN Status</label>
            <input
              type="text"
              value={form.abnStatus || ""}
              readOnly
              placeholder="Active / Cancelled"
              className={`${inputClass} bg-slate-50 dark:bg-white/10`}
            />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* GST REGISTRATION */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-2">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.gstRegistered || false}
            onChange={(e) => setForm((f) => ({ ...f, gstRegistered: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-white">Are you registered for GST?</span>
            <p className="text-xs text-slate-500 dark:text-white/50">Goods and Services Tax registration</p>
          </div>
        </label>
      </div>

      {/* ============================================================ */}
      {/* MEDICAL CARD */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-2">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.hasMedicalCard || false}
            onChange={(e) => setForm((f) => ({ ...f, hasMedicalCard: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-white">Do you have a Health Care / Medicare Card?</span>
            <p className="text-xs text-slate-500 dark:text-white/50">Concession card, Health Care Card, or Medicare card</p>
          </div>
        </label>
      </div>

      {/* ============================================================ */}
      {/* EMPLOYMENT */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-6">
        <h3 className={sectionHeader}>Employment Details</h3>
      </div>
      <div>
        <label className={labelClass}>Occupation</label>
        <input type="text" value={form.occupation || ""} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} placeholder="Software Engineer" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Employer Name</label>
        <input type="text" value={form.employerName || ""} onChange={(e) => setForm((f) => ({ ...f, employerName: e.target.value }))} placeholder="Company Pty Ltd" className={inputClass} />
      </div>

      {/* ============================================================ */}
      {/* ADDRESS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-6">
        <h3 className={sectionHeader}>Address Details</h3>
      </div>
      <div className="sm:col-span-3">
        <label className={labelClass}>Street Address</label>
        <input type="text" value={form.streetAddress || ""} onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))} placeholder="123 Main Street" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Suburb</label>
        <input type="text" value={form.suburb || ""} onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))} placeholder="Sydney" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>State</label>
        <select value={form.state || ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={inputClass}>
          <option value="">Select State</option>
          <option value="NSW">New South Wales</option>
          <option value="VIC">Victoria</option>
          <option value="QLD">Queensland</option>
          <option value="WA">Western Australia</option>
          <option value="SA">South Australia</option>
          <option value="TAS">Tasmania</option>
          <option value="ACT">ACT</option>
          <option value="NT">Northern Territory</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Postcode</label>
        <input type="text" value={form.postcode || ""} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} maxLength={4} placeholder="2000" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Country</label>
        <input type="text" value={form.country || "Australia"} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputClass} />
      </div>

      {/* ============================================================ */}
      {/* MARITAL STATUS & SPOUSE */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-6">
        <h3 className={sectionHeader}>Marital Status</h3>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Marital Status</label>
        <select
          value={form.maritalStatus || ""}
          onChange={(e) => {
            const val = e.target.value;
            setForm((f) => ({
              ...f,
              maritalStatus: val,
              // Reset spouse fields when changing to single
              ...(val !== "MARRIED" && val !== "DE_FACTO" ? {
                spouseInAustralia: undefined,
                spouseName: "",
                spouseEmail: "",
                spouseDob: "",
              } : {}),
            }));
          }}
          className={inputClass}
        >
          <option value="">Select Status</option>
          <option value="SINGLE">Single</option>
          <option value="MARRIED">Married</option>
          <option value="DE_FACTO">De Facto</option>
          <option value="DIVORCED">Divorced</option>
          <option value="SEPARATED">Separated</option>
          <option value="WIDOWED">Widowed</option>
        </select>
      </div>

      {/* Spouse Details - Only show when married/de facto */}
      {isMarried && (
        <>
          <div className="sm:col-span-3 mt-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <label className={labelClass}>
                Is your spouse/partner currently residing in Australia?
              </label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="spouseInAustralia"
                    checked={form.spouseInAustralia === true}
                    onChange={() => setForm((f) => ({ ...f, spouseInAustralia: true }))}
                    className="w-4 h-4 text-[#0891b2] focus:ring-[#0891b2]"
                  />
                  <span className="text-sm text-slate-700 dark:text-white/80">Yes, in Australia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="spouseInAustralia"
                    checked={form.spouseInAustralia === false}
                    onChange={() => setForm((f) => ({ ...f, spouseInAustralia: false, spouseStatus: undefined }))}
                    className="w-4 h-4 text-[#0891b2] focus:ring-[#0891b2]"
                  />
                  <span className="text-sm text-slate-700 dark:text-white/80">No, overseas</span>
                </label>
              </div>
            </div>
          </div>

          {/* Spouse in Australia - Send invitation */}
          {form.spouseInAustralia === true && (
            <div className="sm:col-span-3">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Spouse / Partner Details (in Australia)</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">
                  Enter your spouse&apos;s details. If they already have an account, they will receive a linking request. Otherwise, they will be invited to register.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Spouse Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.spouseName || ""}
                      onChange={(e) => setForm((f) => ({ ...f, spouseName: e.target.value }))}
                      placeholder="Full Name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Spouse Email <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="email"
                        value={form.spouseEmail || ""}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, spouseEmail: e.target.value }));
                          setSpouseEmailExists(null);
                        }}
                        onBlur={() => checkSpouseEmail(form.spouseEmail || "")}
                        placeholder="spouse@example.com"
                        className={inputClass}
                      />
                      {checkingSpouseEmail && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {spouseEmailExists && (
                      <p className={`text-xs mt-1 ${spouseEmailExists.exists ? "text-green-600" : "text-amber-600"}`}>
                        {spouseEmailExists.exists
                          ? `Existing user: ${spouseEmailExists.name}. They will see the request in their account.`
                          : "New user - they will be invited to create an account."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Invitation Status */}
                {form.spouseStatus === "PENDING" && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 px-2 py-0.5 bg-amber-100 rounded-full">PENDING</span>
                    <span className="text-sm text-amber-700 dark:text-amber-300">Invitation sent, waiting for spouse approval</span>
                  </div>
                )}
                {form.spouseStatus === "APPROVED" && (
                  <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-2">
                    <span className="text-xs font-medium text-green-700 dark:text-green-400 px-2 py-0.5 bg-green-100 rounded-full">APPROVED</span>
                    <span className="text-sm text-green-700 dark:text-green-300">Spouse linked successfully</span>
                  </div>
                )}
                {form.spouseStatus === "REJECTED" && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
                    <span className="text-xs font-medium text-red-700 dark:text-red-400 px-2 py-0.5 bg-red-100 rounded-full">REJECTED</span>
                    <span className="text-sm text-red-700 dark:text-red-300">Spouse declined the invitation</span>
                  </div>
                )}

                {/* Send/Resend Invitation Button */}
                {form.spouseStatus !== "APPROVED" && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleSendSpouseInvite}
                      disabled={sendingSpouseInvite || !form.spouseName || !form.spouseEmail}
                      className="px-4 py-2 rounded-xl bg-[#0891b2] text-white text-sm font-medium hover:bg-[#0e7490] transition-colors disabled:opacity-50"
                    >
                      {sendingSpouseInvite ? "Sending..." : form.spouseStatus === "PENDING" ? "Resend Invitation" : "Send Invitation"}
                    </button>
                    {spouseInviteResult && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">{spouseInviteResult}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Spouse Overseas - First Name, Last Name, DOB, Income */}
          {form.spouseInAustralia === false && (
            <div className="sm:col-span-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-slate-600 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-slate-900 dark:text-white">Spouse / Partner Details (Overseas)</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      type="text"
                      value={form.spouseFirstName || ""}
                      onChange={(e) => setForm((f) => ({ ...f, spouseFirstName: e.target.value }))}
                      placeholder="First Name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      type="text"
                      value={form.spouseLastName || ""}
                      onChange={(e) => setForm((f) => ({ ...f, spouseLastName: e.target.value }))}
                      placeholder="Last Name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date of Birth</label>
                    <input
                      type="date"
                      value={form.spouseDob || ""}
                      onChange={(e) => setForm((f) => ({ ...f, spouseDob: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Annual Income (AUD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.spouseIncome || ""}
                      onChange={(e) => setForm((f) => ({ ...f, spouseIncome: e.target.value }))}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* RENTAL INCOME */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-6">
        <h3 className={sectionHeader}>Additional Information</h3>
      </div>
      <div className="sm:col-span-3">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.hasRentalIncome || false}
            onChange={(e) => setForm((f) => ({ ...f, hasRentalIncome: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
          />
          <div>
            <span className="font-medium text-slate-900 dark:text-white">Do you have rental property income?</span>
            <p className="text-xs text-slate-500 dark:text-white/50">
              Add your rental properties below. Service fees may vary based on the number of properties.
            </p>
          </div>
        </label>
      </div>

      {/* Rental Properties Management — shown when checkbox is checked */}
      {form.hasRentalIncome && (
        <div className="sm:col-span-3 mt-2">
          <RentalPropertiesSection accountId={accountId} properties={form.rentalProperties || []} onUpdate={(props) => setForm((f) => ({ ...f, rentalProperties: props }))} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rental Properties Section — Add / Edit / Delete rental properties
// ============================================================================
const AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

function RentalPropertiesSection({
  accountId,
  properties,
  onUpdate,
}: {
  accountId: string;
  properties: RentalProperty[];
  onUpdate: (props: RentalProperty[]) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // New property form state
  const emptyProp = { address: "", suburb: "", state: "", postcode: "", ownershipPercent: 100 };
  const [newProp, setNewProp] = useState(emptyProp);
  const [editProp, setEditProp] = useState(emptyProp);

  const handleAdd = async () => {
    if (!newProp.address.trim()) { setError("Property address is required"); return; }
    if (newProp.ownershipPercent <= 0 || newProp.ownershipPercent > 100) { setError("Ownership must be between 0.01% and 100%"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await apiPost(`/accounts/${accountId}/rental-properties`, newProp);
      if (res.error) { setError(res.error); setSaving(false); return; }
      onUpdate([res.property, ...properties]);
      setNewProp(emptyProp);
      setShowAddForm(false);
    } catch { setError("Failed to add property"); }
    setSaving(false);
  };

  const handleUpdate = async (propId: string) => {
    if (!editProp.address.trim()) { setError("Property address is required"); return; }
    if (editProp.ownershipPercent <= 0 || editProp.ownershipPercent > 100) { setError("Ownership must be between 0.01% and 100%"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await apiPatch(`/accounts/${accountId}/rental-properties/${propId}`, editProp);
      if (res.error) { setError(res.error); setSaving(false); return; }
      onUpdate(properties.map((p) => (p.id === propId ? { ...p, ...res.property } : p)));
      setEditingId(null);
    } catch { setError("Failed to update property"); }
    setSaving(false);
  };

  const handleDelete = async (propId: string) => {
    if (!confirm("Are you sure you want to remove this property?")) return;
    setDeletingId(propId);
    try {
      const res = await apiDelete(`/accounts/${accountId}/rental-properties/${propId}`);
      if (res.error) { setError(res.error); setDeletingId(null); return; }
      onUpdate(properties.filter((p) => p.id !== propId));
    } catch { setError("Failed to delete property"); }
    setDeletingId(null);
  };

  const startEdit = (p: RentalProperty) => {
    setEditingId(p.id);
    setEditProp({
      address: p.address || "",
      suburb: p.suburb || "",
      state: p.state || "",
      postcode: p.postcode || "",
      ownershipPercent: Number(p.ownershipPercent) || 100,
    });
    setError("");
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm";
  const lblCls = "block text-xs font-medium text-slate-600 dark:text-white/70 mb-1";

  const PropertyForm = ({ data, setData, onSubmit, submitLabel, onCancel }: {
    data: typeof emptyProp;
    setData: React.Dispatch<React.SetStateAction<typeof emptyProp>>;
    onSubmit: () => void;
    submitLabel: string;
    onCancel: () => void;
  }) => (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-3">
      <div>
        <label className={lblCls}>Property Address *</label>
        <input
          className={inputCls}
          placeholder="e.g. 42 Wallaby Way, Sydney"
          value={data.address}
          onChange={(e) => setData((d) => ({ ...d, address: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lblCls}>Suburb</label>
          <input className={inputCls} placeholder="Suburb" value={data.suburb} onChange={(e) => setData((d) => ({ ...d, suburb: e.target.value }))} />
        </div>
        <div>
          <label className={lblCls}>State</label>
          <select className={inputCls} value={data.state} onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))}>
            <option value="">Select</option>
            {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lblCls}>Postcode</label>
          <input className={inputCls} placeholder="0000" maxLength={4} value={data.postcode} onChange={(e) => setData((d) => ({ ...d, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
        </div>
      </div>
      <div>
        <label className={lblCls}>Ownership Percentage *</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            className={inputCls + " w-32"}
            value={data.ownershipPercent}
            onChange={(e) => setData((d) => ({ ...d, ownershipPercent: parseFloat(e.target.value) || 0 }))}
          />
          <span className="text-sm text-slate-500 dark:text-white/50">%</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Enter your ownership share (e.g. 100 for sole owner, 50 for 50%)</p>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-xl bg-[#0891b2] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : submitLabel}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {error && <div className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}

      {/* Existing properties list */}
      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
              {editingId === p.id ? (
                <div className="p-3">
                  <PropertyForm
                    data={editProp}
                    setData={setEditProp}
                    onSubmit={() => handleUpdate(p.id)}
                    submitLabel="Update Property"
                    onCancel={() => { setEditingId(null); setError(""); }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#0891b2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      <span className="font-medium text-slate-900 dark:text-white text-sm truncate">{p.address}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-white/50">
                      {p.suburb && <span>{p.suburb}</span>}
                      {p.state && <span>{p.state}</span>}
                      {p.postcode && <span>{p.postcode}</span>}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0891b2]/10 text-[#0891b2] font-medium">
                        {Number(p.ownershipPercent)}% ownership
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#0891b2] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      {deletingId === p.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add property form / button */}
      {showAddForm ? (
        <PropertyForm
          data={newProp}
          setData={setNewProp}
          onSubmit={handleAdd}
          submitLabel="Add Property"
          onCancel={() => { setShowAddForm(false); setNewProp(emptyProp); setError(""); }}
        />
      ) : (
        <button
          onClick={() => { setShowAddForm(true); setError(""); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#0891b2] hover:text-[#0891b2] transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add Property
        </button>
      )}

      {properties.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-white/40 text-center">
          {properties.length} propert{properties.length === 1 ? "y" : "ies"} added
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Company Profile Form — TFN, Addresses, Industry, Directors/Shareholders
// ============================================================================
const AU_STATES_COMPANY = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

const INDUSTRY_SECTORS = [
  "Agriculture", "Arts & Recreation", "Construction", "Education & Training",
  "Electricity, Gas, Water", "Financial Services", "Healthcare", "Hospitality & Tourism",
  "Information Technology", "Manufacturing", "Mining", "Professional Services",
  "Property & Real Estate", "Retail Trade", "Transport & Logistics", "Wholesale Trade", "Other",
];

interface CompanyPartnerItem {
  id: string;
  name?: string;
  email: string;
  role?: string;
  isDirector?: boolean;
  isShareholder?: boolean;
  shareCount?: number;
  status: string;
}

function CompanyForm({
  form,
  setForm,
  accountId,
  ownerName,
  ownerEmail,
}: {
  form: Partial<CompanyProfile>;
  setForm: React.Dispatch<React.SetStateAction<Partial<CompanyProfile>>>;
  accountId: string;
  ownerName: string;
  ownerEmail: string;
}) {
  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2";
  const sectionHeader = "text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3";

  // Directors/Shareholders
  const [partners, setPartners] = useState<CompanyPartnerItem[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showAddDirector, setShowAddDirector] = useState(false);
  const [newDirector, setNewDirector] = useState({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0 });
  const [addingDirector, setAddingDirector] = useState(false);
  const [directorError, setDirectorError] = useState("");
  const [directorSuccess, setDirectorSuccess] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; isDirector: boolean; isShareholder: boolean; shareCount: number }>({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0 });
  const [savingEdit, setSavingEdit] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");

  // Email check state
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ exists: boolean; name?: string } | null>(null);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPartners();
  }, [accountId]);

  async function loadPartners() {
    setLoadingPartners(true);
    try {
      const res = await apiGet<{ partners: CompanyPartnerItem[] }>(`/partners/account/${accountId}`);
      setPartners(res.partners || []);
    } catch { /* ignore */ } finally { setLoadingPartners(false); }
  }

  // Debounced email check
  function handleEmailChange(email: string) {
    setNewDirector((d) => ({ ...d, email }));
    setEmailStatus(null);
    setDirectorError("");
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    if (!email || !email.includes("@") || !email.includes(".")) return;
    emailCheckTimer.current = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await apiGet<{ exists: boolean; name?: string }>(`/partners/check-email?email=${encodeURIComponent(email)}`);
        setEmailStatus(res);
        // Auto-fill name if user exists and name field is empty
        if (res.exists && res.name) {
          setNewDirector((d) => ({ ...d, name: d.name || res.name || "" }));
        }
      } catch { /* ignore */ }
      setCheckingEmail(false);
    }, 500);
  }

  async function handleAddDirector() {
    if (!newDirector.email || !newDirector.email.includes("@")) { setDirectorError("Valid email is required"); return; }
    if (newDirector.email.toLowerCase() === ownerEmail.toLowerCase()) { setDirectorError("You are already listed as the account owner above"); return; }
    if (partners.some((p) => p.email.toLowerCase() === newDirector.email.toLowerCase())) { setDirectorError("This email is already added"); return; }
    if (!newDirector.name) { setDirectorError("Name is required"); return; }
    if (!newDirector.isDirector && !newDirector.isShareholder) { setDirectorError("Select Director and/or Shareholder"); return; }
    setDirectorError("");
    setDirectorSuccess("");
    setAddingDirector(true);
    try {
      const res = await apiPost<{ partner: CompanyPartnerItem; isExistingUser?: boolean }>("/partners", {
        accountId,
        email: newDirector.email,
        name: newDirector.name,
        isDirector: newDirector.isDirector,
        isShareholder: newDirector.isShareholder,
        shareCount: newDirector.isShareholder ? newDirector.shareCount : undefined,
      });
      if ((res as unknown as { error?: string }).error) { setDirectorError((res as unknown as { error: string }).error); setAddingDirector(false); return; }
      setPartners((p) => [...p, res.partner]);
      // Show success message based on whether user exists
      if (res.isExistingUser) {
        setDirectorSuccess(`Invitation sent to ${newDirector.email}. They will see an Accept/Reject request on their dashboard.`);
      } else {
        setDirectorSuccess(`Registration invitation sent to ${newDirector.email}. Once they register, they can accept the request from their dashboard.`);
      }
      setNewDirector({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0 });
      setEmailStatus(null);
      setShowAddDirector(false);
    } catch (e) { setDirectorError(e instanceof Error ? e.message : "Failed to add"); }
    setAddingDirector(false);
  }

  async function handleRemoveDirector(id: string) {
    if (!confirm("Are you sure you want to delete this director/shareholder? This cannot be undone.")) return;
    setRemovingId(id);
    setDirectorError("");
    try {
      await apiDelete(`/partners/${id}`);
      setPartners((p) => p.filter((d) => d.id !== id));
      setDirectorSuccess("Director/shareholder removed successfully.");
    } catch { setDirectorError("Failed to remove director/shareholder."); }
    setRemovingId(null);
  }

  function startEdit(p: CompanyPartnerItem) {
    setEditingId(p.id);
    setOriginalEmail(p.email);
    setEditForm({
      name: p.name || "",
      email: p.email,
      isDirector: p.isDirector ?? true,
      isShareholder: p.isShareholder ?? false,
      shareCount: p.shareCount ?? 0,
    });
    setDirectorError("");
    setDirectorSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0 });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    if (!editForm.name) { setDirectorError("Name is required"); return; }
    if (!editForm.email || !editForm.email.includes("@")) { setDirectorError("Valid email is required"); return; }
    if (!editForm.isDirector && !editForm.isShareholder) { setDirectorError("Select Director and/or Shareholder"); return; }

    setSavingEdit(true);
    setDirectorError("");
    setDirectorSuccess("");
    try {
      const res = await apiPatch<{ partner: CompanyPartnerItem; emailChanged?: boolean; invitationSent?: boolean }>(`/partners/${editingId}`, {
        name: editForm.name,
        email: editForm.email,
        isDirector: editForm.isDirector,
        isShareholder: editForm.isShareholder,
        shareCount: editForm.isShareholder ? editForm.shareCount : null,
      });
      // Update local state
      setPartners((prev) => prev.map((p) => p.id === editingId ? { ...p, ...res.partner } : p));
      if (res.emailChanged && res.invitationSent) {
        setDirectorSuccess(`Updated successfully. New invitation sent to ${editForm.email}.`);
      } else {
        setDirectorSuccess("Updated successfully.");
      }
      setEditingId(null);
    } catch (e) { setDirectorError(e instanceof Error ? e.message : "Failed to update"); }
    setSavingEdit(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* ============================================================ */}
      {/* COMPANY DETAILS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3">
        <h3 className={sectionHeader}>Company Details</h3>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Company Name</label>
        <input type="text" value={form.companyName || ""} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="ABC Pty Ltd" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Trading Name</label>
        <input type="text" value={form.tradingName || ""} onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))} placeholder="Trading as..." className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>ABN</label>
        <input type="text" value={form.abn || ""} onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="11 digit ABN" maxLength={11} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>ACN</label>
        <input type="text" value={form.acn || ""} onChange={(e) => setForm((f) => ({ ...f, acn: e.target.value.replace(/\D/g, "").slice(0, 9) }))} placeholder="9 digit ACN" maxLength={9} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>TFN</label>
        {form.tfn && form.tfn.includes("*") ? (
          /* TFN is masked from server — show read-only with change option */
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono tracking-widest">
              {form.tfn}
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, tfn: "" }))}
              className="px-3 py-3 rounded-xl text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Change TFN
            </button>
          </div>
        ) : (
          /* No TFN or user is entering a new one */
          <input
            type="text"
            value={form.tfn || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, "");
              setForm((f) => ({ ...f, tfn: val }));
            }}
            maxLength={14}
            placeholder="XXX XXX XXX"
            className={inputClass}
          />
        )}
      </div>

      {/* ============================================================ */}
      {/* REGISTERED BUSINESS ADDRESS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-4">
        <h3 className={sectionHeader}>Registered Business Address</h3>
      </div>
      <div className="sm:col-span-3">
        <label className={labelClass}>Street Address</label>
        <input type="text" value={form.businessAddress || ""} onChange={(e) => setForm((f) => ({ ...f, businessAddress: e.target.value }))} placeholder="e.g. 123 Collins Street" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Suburb</label>
        <input type="text" value={form.businessSuburb || ""} onChange={(e) => setForm((f) => ({ ...f, businessSuburb: e.target.value }))} placeholder="Suburb" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>State</label>
        <select value={form.businessState || ""} onChange={(e) => setForm((f) => ({ ...f, businessState: e.target.value }))} className={inputClass}>
          <option value="">Select</option>
          {AU_STATES_COMPANY.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Postcode</label>
        <input type="text" value={form.businessPostcode || ""} onChange={(e) => setForm((f) => ({ ...f, businessPostcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="0000" maxLength={4} className={inputClass} />
      </div>

      {/* ============================================================ */}
      {/* POSTAL ADDRESS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-4">
        <h3 className={sectionHeader}>Postal Address</h3>
      </div>
      <div className="sm:col-span-3">
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.postalSameAsBusiness !== false}
            onChange={(e) => setForm((f) => ({ ...f, postalSameAsBusiness: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
          />
          <span className="text-sm text-slate-700 dark:text-white/80">Same as business address</span>
        </label>
      </div>
      {form.postalSameAsBusiness === false && (
        <>
          <div className="sm:col-span-3">
            <label className={labelClass}>Postal Street Address</label>
            <input type="text" value={form.postalAddress || ""} onChange={(e) => setForm((f) => ({ ...f, postalAddress: e.target.value }))} placeholder="Postal address" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Suburb</label>
            <input type="text" value={form.postalSuburb || ""} onChange={(e) => setForm((f) => ({ ...f, postalSuburb: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <select value={form.postalState || ""} onChange={(e) => setForm((f) => ({ ...f, postalState: e.target.value }))} className={inputClass}>
              <option value="">Select</option>
              {AU_STATES_COMPANY.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Postcode</label>
            <input type="text" value={form.postalPostcode || ""} onChange={(e) => setForm((f) => ({ ...f, postalPostcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} maxLength={4} className={inputClass} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* INDUSTRY / SECTOR */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-4">
        <h3 className={sectionHeader}>Business Industry &amp; Sector</h3>
      </div>
      <div>
        <label className={labelClass}>Industry</label>
        <select value={form.industry || ""} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className={inputClass}>
          <option value="">Select industry</option>
          {INDUSTRY_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Sub-sector</label>
        <input type="text" value={form.industrySector || ""} onChange={(e) => setForm((f) => ({ ...f, industrySector: e.target.value }))} placeholder="e.g. Software Development" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>GST Registered</label>
        <select value={form.gstRegistered ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, gstRegistered: e.target.value === "yes" }))} className={inputClass}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className={labelClass}>Business Description</label>
        <textarea value={form.businessDescription || ""} onChange={(e) => setForm((f) => ({ ...f, businessDescription: e.target.value }))} rows={2} placeholder="Brief description of business activities..." className={inputClass} />
      </div>

      {/* ============================================================ */}
      {/* DIRECTORS & SHAREHOLDERS */}
      {/* ============================================================ */}
      <div className="sm:col-span-3 mt-4">
        <h3 className={sectionHeader}>Directors &amp; Shareholders</h3>
      </div>

      {/* Self (account owner) — always first in the list, not removable */}
      <div className="sm:col-span-3">
        <div className="p-4 rounded-xl border-2 border-[#0891b2]/30 bg-gradient-to-r from-[#0891b2]/5 to-transparent dark:from-[#0891b2]/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#0891b2]/10 flex items-center justify-center text-[#0891b2] font-bold text-sm shrink-0">
              {ownerName ? ownerName.charAt(0).toUpperCase() : "Y"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">{ownerName || "You"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0891b2]/10 text-[#0891b2] font-medium uppercase tracking-wider">Owner</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-white/40">{ownerEmail}</span>
            </div>
          </div>
          {/* Role toggles for self */}
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.selfIsDirector !== false}
                onChange={(e) => setForm((f) => ({ ...f, selfIsDirector: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
              />
              <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.selfIsShareholder === true}
                onChange={(e) => setForm((f) => ({ ...f, selfIsShareholder: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]"
              />
              <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
            </label>
          </div>
          {/* Share count for self (only if shareholder) */}
          {form.selfIsShareholder && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs font-medium text-slate-600 dark:text-white/70">Number of Shares</label>
              <input
                type="number"
                min={0}
                value={form.selfShareCount ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, selfShareCount: parseInt(e.target.value) || 0 }))}
                className={inputClass + " !py-2 text-sm w-32"}
              />
            </div>
          )}
        </div>
      </div>

      {/* Other directors/shareholders list */}
      <div className="sm:col-span-3">
        {loadingPartners ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Loading...</div>
        ) : partners.length > 0 ? (
          <div className="space-y-2 mb-3">
            {partners.map((p) => (
              editingId === p.id ? (
                /* ── Inline edit mode ── */
                <div key={p.id} className="p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Edit Director / Shareholder</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Full Name *</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputClass + " !py-2.5 text-sm"} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Email *</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputClass + " !py-2.5 text-sm"} />
                      {editForm.email !== originalEmail && editForm.email.includes("@") && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Email changed — a new invitation will be sent</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.isDirector} onChange={(e) => setEditForm((f) => ({ ...f, isDirector: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]" />
                      <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.isShareholder} onChange={(e) => setEditForm((f) => ({ ...f, isShareholder: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]" />
                      <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
                    </label>
                  </div>
                  {editForm.isShareholder && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Number of Shares</label>
                      <input type="number" min={0} value={editForm.shareCount} onChange={(e) => setEditForm((f) => ({ ...f, shareCount: parseInt(e.target.value) || 0 }))} className={inputClass + " !py-2.5 text-sm w-40"} />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                /* ── Read-only view ── */
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-white/5 ${p.status === "APPROVED" ? "border-green-200 dark:border-green-800" : p.status === "REJECTED" ? "border-red-200 dark:border-red-800" : "border-slate-200 dark:border-white/10"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-900 dark:text-white">{p.name || p.email}</span>
                      {p.isDirector && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Director</span>}
                      {p.isShareholder && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Shareholder{p.shareCount ? ` (${p.shareCount} shares)` : ""}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 dark:text-white/40">{p.email}</span>
                      <span className="text-xs text-slate-300 dark:text-white/20">|</span>
                      {p.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
                          Accepted
                        </span>
                      ) : p.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Invitation pending
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Edit & Delete buttons */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(p)} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleRemoveDirector(p.id)} disabled={removingId === p.id} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50" title="Delete">
                      {removingId === p.id ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        ) : null}

        {directorError && <div className="px-4 py-2 mb-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{directorError}</div>}
        {directorSuccess && <div className="px-4 py-2 mb-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {directorSuccess}
        </div>}

        {/* Add director form */}
        {showAddDirector ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-3">
            {/* Email first — triggers lookup */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={newDirector.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="john@example.com"
                  className={inputClass + " !py-2.5 text-sm" + (emailStatus?.exists ? " !border-green-400" : "")}
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                )}
              </div>
              {/* Email check result */}
              {emailStatus && !checkingEmail && (
                <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${emailStatus.exists ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {emailStatus.exists ? (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>Already registered as <strong>{emailStatus.name}</strong> — invitation will be sent for approval</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                      <span>Not registered — registration invitation will be sent</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Name — auto-filled for existing users, editable */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Full Name *</label>
              <input
                type="text"
                value={newDirector.name}
                onChange={(e) => setNewDirector((d) => ({ ...d, name: e.target.value }))}
                placeholder="John Smith"
                className={inputClass + " !py-2.5 text-sm" + (emailStatus?.exists && emailStatus.name ? " !bg-green-50 dark:!bg-green-900/10" : "")}
                readOnly={!!emailStatus?.exists && !!emailStatus.name}
              />
              {emailStatus?.exists && emailStatus.name && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Name auto-filled from registered account</p>
              )}
            </div>

            {/* Role checkboxes: Director / Shareholder / Both */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-2">Role *</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newDirector.isDirector} onChange={(e) => setNewDirector((d) => ({ ...d, isDirector: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]" />
                  <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newDirector.isShareholder} onChange={(e) => setNewDirector((d) => ({ ...d, isShareholder: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#0891b2] focus:ring-[#0891b2]" />
                  <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
                </label>
              </div>
            </div>

            {/* Share count (only if shareholder) */}
            {newDirector.isShareholder && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Number of Shares</label>
                <input type="number" min={0} value={newDirector.shareCount} onChange={(e) => setNewDirector((d) => ({ ...d, shareCount: parseInt(e.target.value) || 0 }))} className={inputClass + " !py-2.5 text-sm w-40"} />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleAddDirector} disabled={addingDirector} className="px-4 py-2 text-sm rounded-xl bg-[#0891b2] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors">
                {addingDirector ? "Sending Invitation..." : emailStatus?.exists ? "Send Invitation" : "Send Registration Invite"}
              </button>
              <button onClick={() => { setShowAddDirector(false); setDirectorError(""); setEmailStatus(null); }} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddDirector(true); setDirectorError(""); setDirectorSuccess(""); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#0891b2] hover:text-[#0891b2] transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Add Director / Shareholder
          </button>
        )}

        {/* Summary count */}
        <p className="text-xs text-slate-400 dark:text-white/40 text-center mt-2">
          {1 + partners.length} total (1 owner + {partners.length} added)
        </p>
      </div>
    </div>
  );
}

// Trust Profile Form with Partner (Trustees & Beneficiaries) Invitation System
function TrustForm({
  form,
  setForm,
  accountId,
}: {
  form: Partial<TrustProfile & { trusteeDetails: string; beneficiaries: string }>;
  setForm: React.Dispatch<React.SetStateAction<Partial<TrustProfile & { trusteeDetails: string; beneficiaries: string }>>>;
  accountId: string;
}) {
  const [partners, setPartners] = useState<TrustPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ email: "", name: "", role: "", beneficiaryPercent: "" });
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState<{ exists: boolean; name?: string } | null>(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [partnerSuccess, setPartnerSuccess] = useState("");

  // Load partners on mount
  useEffect(() => {
    loadPartners();
  }, [accountId]);

  async function loadPartners() {
    setLoadingPartners(true);
    try {
      const res = await apiGet<{ partners: TrustPartner[] }>(`/trust-partners/account/${accountId}`);
      setPartners(res.partners || []);
    } catch (e) {
      console.error("Failed to load trust partners:", e);
    } finally {
      setLoadingPartners(false);
    }
  }

  // Check if email exists in the system
  async function checkEmail(email: string) {
    if (!email || !email.includes("@")) {
      setEmailExists(null);
      return;
    }
    setCheckingEmail(true);
    try {
      const res = await apiGet<{ exists: boolean; name?: string }>(`/partners/check-email?email=${encodeURIComponent(email)}`);
      setEmailExists(res);
      if (res.exists && res.name && !newPartner.name) {
        setNewPartner((p) => ({ ...p, name: res.name || "" }));
      }
    } catch (e) {
      console.error("Failed to check email:", e);
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleAddPartner() {
    if (!newPartner.email) {
      setPartnerError("Email is required");
      return;
    }
    setAddingPartner(true);
    setPartnerError("");
    setPartnerSuccess("");

    try {
      await apiPost("/trust-partners", {
        accountId,
        email: newPartner.email,
        name: newPartner.name || undefined,
        role: newPartner.role || undefined,
        beneficiaryPercent: newPartner.beneficiaryPercent ? Number(newPartner.beneficiaryPercent) : undefined,
      });
      setPartnerSuccess(
        emailExists?.exists
          ? `Invitation sent to ${newPartner.email}. They will see the request in their account.`
          : `Invitation sent to ${newPartner.email}. They will be asked to create an account.`
      );
      setNewPartner({ email: "", name: "", role: "", beneficiaryPercent: "" });
      setEmailExists(null);
      setShowAddPartner(false);
      await loadPartners();
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : "Failed to add partner");
    } finally {
      setAddingPartner(false);
    }
  }

  async function handleRemovePartner(partnerId: string) {
    if (!confirm("Are you sure you want to remove this trustee/beneficiary?")) return;
    try {
      await apiDelete(`/trust-partners/${partnerId}`);
      await loadPartners();
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : "Failed to remove partner");
    }
  }

  async function handleResendInvitation(partnerId: string) {
    try {
      await apiPost(`/trust-partners/${partnerId}/resend`, {});
      setPartnerSuccess("Invitation resent successfully");
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : "Failed to resend invitation");
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    APPROVED: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    REJECTED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    REMOVED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  };

  return (
    <div className="grid gap-6">
      {/* Basic Trust Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Trust Name</label>
          <input
            type="text"
            value={form.trustName || ""}
            onChange={(e) => setForm((f) => ({ ...f, trustName: e.target.value }))}
            placeholder="Family Trust"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Trust Type</label>
          <select
            value={form.trustType || ""}
            onChange={(e) => setForm((f) => ({ ...f, trustType: e.target.value as TrustType }))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          >
            <option value="">Select Type</option>
            <option value="DISCRETIONARY">Discretionary (Family) Trust</option>
            <option value="UNIT">Unit Trust</option>
            <option value="HYBRID">Hybrid Trust</option>
            <option value="SMSF">Self-Managed Super Fund</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">TFN</label>
          {form.tfn && form.tfn.includes("*") ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono tracking-widest">
                {form.tfn}
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, tfn: "" }))} className="px-3 py-3 rounded-xl text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap">
                Change
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={form.tfn || ""}
              onChange={(e) => setForm((f) => ({ ...f, tfn: e.target.value.replace(/[^\d\s]/g, "") }))}
              placeholder="Trust Tax File Number"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
            />
          )}
          <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Stored encrypted</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">ABN</label>
          <input
            type="text"
            value={form.abn || ""}
            onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))}
            placeholder="Australian Business Number"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Address</label>
        <input
          type="text"
          value={form.address || ""}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Trust address"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Suburb</label>
          <input
            type="text"
            value={form.suburb || ""}
            onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
            placeholder="Suburb"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">State</label>
          <select
            value={form.state || ""}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          >
            <option value="">Select State</option>
            <option value="NSW">New South Wales</option>
            <option value="VIC">Victoria</option>
            <option value="QLD">Queensland</option>
            <option value="WA">Western Australia</option>
            <option value="SA">South Australia</option>
            <option value="TAS">Tasmania</option>
            <option value="ACT">ACT</option>
            <option value="NT">Northern Territory</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Postcode</label>
          <input
            type="text"
            value={form.postcode || ""}
            onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
            maxLength={4}
            placeholder="2000"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Trustees & Beneficiaries Section */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">
              Trustees & Beneficiaries
            </h3>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">
              Add trustees and beneficiaries to your trust. They will receive an invitation to join.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPartner(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0891b2] text-white text-sm font-medium hover:bg-[#0e7490] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Trustee/Beneficiary
          </button>
        </div>

        {/* Partner Alerts */}
        {partnerError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{partnerError}</p>
          </div>
        )}
        {partnerSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-600 dark:text-green-400">{partnerSuccess}</p>
          </div>
        )}

        {/* Add Partner Modal */}
        {showAddPartner && (
          <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h4 className="font-medium text-slate-900 dark:text-white mb-4">Add Trustee or Beneficiary</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={newPartner.email}
                    onChange={(e) => {
                      setNewPartner((p) => ({ ...p, email: e.target.value }));
                      setEmailExists(null);
                    }}
                    onBlur={() => checkEmail(newPartner.email)}
                    placeholder="trustee@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                  />
                  {checkingEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {emailExists && (
                  <p className={`text-xs mt-1 ${emailExists.exists ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {emailExists.exists 
                      ? `✓ Existing user: ${emailExists.name || newPartner.email}. They will see the request in their account.`
                      : "New user - they will be invited to create an account first."
                    }
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Name</label>
                <input
                  type="text"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full Name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Role</label>
                <select
                  value={newPartner.role}
                  onChange={(e) => setNewPartner((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                >
                  <option value="">Select Role</option>
                  <option value="Trustee">Trustee</option>
                  <option value="Beneficiary">Beneficiary</option>
                  <option value="Appointor">Appointor</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Settlor">Settlor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">Distribution % (for Beneficiaries)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newPartner.beneficiaryPercent}
                  onChange={(e) => setNewPartner((p) => ({ ...p, beneficiaryPercent: e.target.value }))}
                  placeholder="50"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={handleAddPartner}
                disabled={addingPartner || !newPartner.email}
                className="px-4 py-2 rounded-xl bg-[#0891b2] text-white text-sm font-medium hover:bg-[#0e7490] transition-colors disabled:opacity-50"
              >
                {addingPartner ? "Sending Invitation..." : "Send Invitation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddPartner(false);
                  setNewPartner({ email: "", name: "", role: "", beneficiaryPercent: "" });
                  setEmailExists(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Partners List */}
        {loadingPartners ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
            <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-slate-500 dark:text-white/50 mb-2">No trustees or beneficiaries added yet</p>
            <p className="text-xs text-slate-400 dark:text-white/40">Click &quot;Add Trustee/Beneficiary&quot; to invite people to your trust</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-white font-medium">
                    {(partner.name || partner.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {partner.name || partner.email}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[partner.status]}`}>
                        {partner.status}
                      </span>
                      {partner.user && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          ✓ Registered
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-white/50">{partner.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-white/40">
                      {partner.role && <span>{partner.role}</span>}
                      {partner.beneficiaryPercent && <span>{partner.beneficiaryPercent}% distribution</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {partner.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => handleResendInvitation(partner.id)}
                      className="text-xs text-[#0891b2] hover:underline"
                    >
                      Resend
                    </button>
                  )}
                  {partner.status !== "REMOVED" && (
                    <button
                      type="button"
                      onClick={() => handleRemovePartner(partner.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Partnership Profile Form with Partner Invitation System
function PartnershipForm({
  form,
  setForm,
  accountId,
  ownerName,
  ownerEmail,
}: {
  form: Partial<PartnershipProfile & { partners: string }>;
  setForm: React.Dispatch<React.SetStateAction<Partial<PartnershipProfile & { partners: string }>>>;
  accountId: string;
  ownerName: string;
  ownerEmail: string;
}) {
  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2";
  const sectionHeader = "text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3";

  const [partners, setPartners] = useState<PartnershipPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ email: "", name: "", role: "", ownershipPercent: "" });
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState<{ exists: boolean; name?: string } | null>(null);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [partnerSuccess, setPartnerSuccess] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", ownershipPercent: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");

  useEffect(() => {
    loadPartners();
  }, [accountId]);

  async function loadPartners() {
    setLoadingPartners(true);
    try {
      const res = await apiGet<{ partners: PartnershipPartner[] }>(`/partnership-partners/account/${accountId}`);
      setPartners(res.partners || []);
    } catch { /* ignore */ } finally { setLoadingPartners(false); }
  }

  // Debounced email check
  function handleEmailChange(email: string) {
    setNewPartner((p) => ({ ...p, email }));
    setEmailExists(null);
    setPartnerError("");
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    if (!email || !email.includes("@") || !email.includes(".")) return;
    emailCheckTimer.current = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await apiGet<{ exists: boolean; name?: string }>(`/partners/check-email?email=${encodeURIComponent(email)}`);
        setEmailExists(res);
        if (res.exists && res.name) {
          setNewPartner((p) => ({ ...p, name: p.name || res.name || "" }));
        }
      } catch { /* ignore */ }
      setCheckingEmail(false);
    }, 500);
  }

  async function handleAddPartner() {
    if (!newPartner.email || !newPartner.email.includes("@")) { setPartnerError("Valid email is required"); return; }
    if (newPartner.email.toLowerCase() === ownerEmail.toLowerCase()) { setPartnerError("You are already listed as the account owner above"); return; }
    if (partners.some((p) => p.email.toLowerCase() === newPartner.email.toLowerCase())) { setPartnerError("This email is already added"); return; }
    if (!newPartner.name) { setPartnerError("Name is required"); return; }
    setAddingPartner(true);
    setPartnerError("");
    setPartnerSuccess("");
    try {
      await apiPost("/partnership-partners", {
        accountId,
        email: newPartner.email,
        name: newPartner.name || undefined,
        role: newPartner.role || undefined,
        ownershipPercent: newPartner.ownershipPercent ? Number(newPartner.ownershipPercent) : undefined,
      });
      setPartnerSuccess(
        emailExists?.exists
          ? `Invitation sent to ${newPartner.email}. They will see an Accept/Reject request on their dashboard.`
          : `Registration invitation sent to ${newPartner.email}. Once they register, they can accept the request.`
      );
      setNewPartner({ email: "", name: "", role: "", ownershipPercent: "" });
      setEmailExists(null);
      setShowAddPartner(false);
      await loadPartners();
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : "Failed to add partner");
    } finally { setAddingPartner(false); }
  }

  async function handleRemovePartner(partnerId: string) {
    if (!confirm("Are you sure you want to delete this partner? This cannot be undone.")) return;
    setRemovingId(partnerId);
    setPartnerError("");
    try {
      await apiDelete(`/partnership-partners/${partnerId}`);
      setPartners((p) => p.filter((d) => d.id !== partnerId));
      setPartnerSuccess("Partner removed successfully.");
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : "Failed to remove partner");
    }
    setRemovingId(null);
  }

  function startEdit(p: PartnershipPartner) {
    setEditingId(p.id);
    setOriginalEmail(p.email);
    setEditForm({
      name: p.name || "",
      email: p.email,
      role: p.role || "",
      ownershipPercent: p.ownershipPercent ? String(p.ownershipPercent) : "",
    });
    setPartnerError("");
    setPartnerSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", email: "", role: "", ownershipPercent: "" });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    if (!editForm.name) { setPartnerError("Name is required"); return; }
    if (!editForm.email || !editForm.email.includes("@")) { setPartnerError("Valid email is required"); return; }
    setSavingEdit(true);
    setPartnerError("");
    setPartnerSuccess("");
    try {
      const res = await apiPatch<{ partner: PartnershipPartner; emailChanged?: boolean; invitationSent?: boolean }>(`/partnership-partners/${editingId}`, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role || undefined,
        ownershipPercent: editForm.ownershipPercent ? Number(editForm.ownershipPercent) : null,
      });
      setPartners((prev) => prev.map((p) => p.id === editingId ? { ...p, ...res.partner } : p));
      if (res.emailChanged && res.invitationSent) {
        setPartnerSuccess(`Updated. New invitation sent to ${editForm.email}.`);
      } else {
        setPartnerSuccess("Updated successfully.");
      }
      setEditingId(null);
    } catch (e) { setPartnerError(e instanceof Error ? e.message : "Failed to update"); }
    setSavingEdit(false);
  }

  // TFN formatting helpers (same as Individual/Company)
  const tfnIsMasked = !!(form.tfn && form.tfn.includes("*"));

  return (
    <div className="grid gap-6">
      {/* Basic Partnership Info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Partnership Name</label>
          <input type="text" value={form.partnershipName || ""} onChange={(e) => setForm((f) => ({ ...f, partnershipName: e.target.value }))} placeholder="Smith & Jones Partnership" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Trading Name</label>
          <input type="text" value={form.tradingName || ""} onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))} placeholder="Trading as..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>ABN</label>
          <input type="text" value={form.abn || ""} onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))} placeholder="Australian Business Number" className={inputClass} />
        </div>

        {/* TFN — same UI as Individual & Company */}
        <div>
          <label className={labelClass}>TFN</label>
          {tfnIsMasked ? (
            <div className="flex items-center gap-2">
              <div className={"flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono tracking-widest"}>
                {form.tfn}
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, tfn: "" }))} className="px-3 py-3 rounded-xl text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap">
                Change TFN
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={form.tfn || ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
                const formatted = raw.length > 6 ? `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}` : raw.length > 3 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;
                setForm((f) => ({ ...f, tfn: formatted }));
              }}
              maxLength={14}
              placeholder="XXX XXX XXX"
              className={inputClass + " font-mono tracking-widest"}
            />
          )}
          <p className="text-xs text-slate-400 dark:text-white/40 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            AES-256-GCM encrypted &bull; Masked for display
          </p>
        </div>

        <div>
          <label className={labelClass}>Industry</label>
          <input type="text" value={form.industry || ""} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="e.g., Consulting, Construction" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className={labelClass}>Business Address</label>
          <input type="text" value={form.businessAddress || ""} onChange={(e) => setForm((f) => ({ ...f, businessAddress: e.target.value }))} placeholder="Street address" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Suburb</label>
          <input type="text" value={form.suburb || ""} onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <select value={form.state || ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={inputClass}>
            <option value="">Select</option>
            {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Postcode</label>
          <input type="text" value={form.postcode || ""} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} maxLength={4} className={inputClass} />
        </div>
      </div>

      {/* ============================================================ */}
      {/* PARTNERS SECTION */}
      {/* ============================================================ */}
      <div className="mt-2">
        <h3 className={sectionHeader}>Partners</h3>
        <p className="text-xs text-slate-400 dark:text-white/40 mb-4">
          A partnership requires at least 2 partners (you + minimum 1 more).
        </p>
      </div>

      {/* Self (account owner) — always first, not removable */}
      <div className="p-4 rounded-xl border-2 border-[#0891b2]/30 bg-gradient-to-r from-[#0891b2]/5 to-transparent dark:from-[#0891b2]/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#0891b2]/10 flex items-center justify-center text-[#0891b2] font-bold text-sm shrink-0">
            {ownerName ? ownerName.charAt(0).toUpperCase() : "Y"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{ownerName || "You"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0891b2]/10 text-[#0891b2] font-medium uppercase tracking-wider">Owner</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-white/40">{ownerEmail}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Role</label>
            <select value={form.selfRole || ""} onChange={(e) => setForm((f) => ({ ...f, selfRole: e.target.value }))} className={inputClass + " !py-2.5 text-sm"}>
              <option value="">Select Role</option>
              <option value="General Partner">General Partner</option>
              <option value="Limited Partner">Limited Partner</option>
              <option value="Managing Partner">Managing Partner</option>
              <option value="Silent Partner">Silent Partner</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Ownership %</label>
            <input type="number" min={0} max={100} step={0.01} value={form.selfOwnershipPercent ?? ""} onChange={(e) => setForm((f) => ({ ...f, selfOwnershipPercent: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 50" className={inputClass + " !py-2.5 text-sm"} />
          </div>
        </div>
      </div>

      {/* Other partners list */}
      <div>
        {loadingPartners ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Loading...</div>
        ) : partners.length > 0 ? (
          <div className="space-y-2 mb-3">
            {partners.map((p) => (
              editingId === p.id ? (
                /* ── Inline edit mode ── */
                <div key={p.id} className="p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Edit Partner</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Full Name *</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputClass + " !py-2.5 text-sm"} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Email *</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputClass + " !py-2.5 text-sm"} />
                      {editForm.email !== originalEmail && editForm.email.includes("@") && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Email changed — a new invitation will be sent</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Role</label>
                      <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className={inputClass + " !py-2.5 text-sm"}>
                        <option value="">Select Role</option>
                        <option value="General Partner">General Partner</option>
                        <option value="Limited Partner">Limited Partner</option>
                        <option value="Managing Partner">Managing Partner</option>
                        <option value="Silent Partner">Silent Partner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Ownership %</label>
                      <input type="number" min={0} max={100} step={0.01} value={editForm.ownershipPercent} onChange={(e) => setEditForm((f) => ({ ...f, ownershipPercent: e.target.value }))} className={inputClass + " !py-2.5 text-sm"} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                /* ── Read-only view ── */
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-white/5 ${p.status === "APPROVED" ? "border-green-200 dark:border-green-800" : p.status === "REJECTED" ? "border-red-200 dark:border-red-800" : "border-slate-200 dark:border-white/10"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-900 dark:text-white">{p.name || p.email}</span>
                      {p.role && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{p.role}</span>}
                      {p.ownershipPercent != null && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{p.ownershipPercent}%</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 dark:text-white/40">{p.email}</span>
                      <span className="text-xs text-slate-300 dark:text-white/20">|</span>
                      {p.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
                          Accepted
                        </span>
                      ) : p.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Invitation pending
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Edit & Delete buttons */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(p)} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleRemovePartner(p.id)} disabled={removingId === p.id} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50" title="Delete">
                      {removingId === p.id ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        ) : null}

        {partnerError && <div className="px-4 py-2 mb-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{partnerError}</div>}
        {partnerSuccess && <div className="px-4 py-2 mb-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {partnerSuccess}
        </div>}

        {/* Minimum partner warning */}
        {partners.length === 0 && !showAddPartner && (
          <div className="px-4 py-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            A partnership requires at least 2 partners. Please add at least 1 more partner.
          </div>
        )}

        {/* Add partner form */}
        {showAddPartner ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-3">
            {/* Email — triggers lookup */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={newPartner.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="partner@example.com"
                  className={inputClass + " !py-2.5 text-sm" + (emailExists?.exists ? " !border-green-400" : "")}
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                )}
              </div>
              {emailExists && !checkingEmail && (
                <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${emailExists.exists ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {emailExists.exists ? (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>Already registered as <strong>{emailExists.name}</strong> — invitation will be sent for approval</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                      <span>Not registered — registration invitation will be sent</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Full Name *</label>
              <input
                type="text"
                value={newPartner.name}
                onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))}
                placeholder="John Smith"
                className={inputClass + " !py-2.5 text-sm" + (emailExists?.exists && emailExists.name ? " !bg-green-50 dark:!bg-green-900/10" : "")}
                readOnly={!!emailExists?.exists && !!emailExists.name}
              />
              {emailExists?.exists && emailExists.name && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Name auto-filled from registered account</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Role</label>
                <select value={newPartner.role} onChange={(e) => setNewPartner((p) => ({ ...p, role: e.target.value }))} className={inputClass + " !py-2.5 text-sm"}>
                  <option value="">Select Role</option>
                  <option value="General Partner">General Partner</option>
                  <option value="Limited Partner">Limited Partner</option>
                  <option value="Managing Partner">Managing Partner</option>
                  <option value="Silent Partner">Silent Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Ownership %</label>
                <input type="number" min={0} max={100} step={0.01} value={newPartner.ownershipPercent} onChange={(e) => setNewPartner((p) => ({ ...p, ownershipPercent: e.target.value }))} placeholder="50" className={inputClass + " !py-2.5 text-sm"} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleAddPartner} disabled={addingPartner} className="px-4 py-2 text-sm rounded-xl bg-[#0891b2] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors">
                {addingPartner ? "Sending Invitation..." : emailExists?.exists ? "Send Invitation" : "Send Registration Invite"}
              </button>
              <button onClick={() => { setShowAddPartner(false); setPartnerError(""); setEmailExists(null); setNewPartner({ email: "", name: "", role: "", ownershipPercent: "" }); }} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddPartner(true); setPartnerError(""); setPartnerSuccess(""); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#0891b2] hover:text-[#0891b2] transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Add Partner
          </button>
        )}

        {/* Summary count */}
        <p className="text-xs text-slate-400 dark:text-white/40 text-center mt-2">
          {1 + partners.length} total partner{1 + partners.length !== 1 ? "s" : ""} (1 owner + {partners.length} added)
        </p>
      </div>
    </div>
  );
}
