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

type TrustType = "DISCRETIONARY" | "UNIT" | "HYBRID" | "SMSF" | "TESTAMENTARY" | "OTHER";

type TrustFormState = Partial<Omit<TrustProfile, "trusteeDetails" | "beneficiaries">> & {
  trusteeDetails?: string;
  beneficiaries?: string;
};
type PartnershipFormState = Partial<Omit<PartnershipProfile, "partners">> & { partners?: string };

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
  const [trustForm, setTrustForm] = useState<TrustFormState>({});
  const [partnershipForm, setPartnershipForm] = useState<PartnershipFormState>({});

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  async function loadAccount() {
    setLoading(true);
    try {
      const res = await apiGet<{ account: Account }>(`/accounts/${accountId}`);
      setAccount(res.account);
      
      // Initialize form based on account type
      if (res.account.accountType === "INDIVIDUAL") {
        const profile = res.account.individualProfile;
        if (profile) {
          setIndividualForm({
            ...profile,
            streetAddress: profile.streetAddress || profile.address || "",
            dateOfBirth: profile.dateOfBirth
              ? (typeof profile.dateOfBirth === "string" ? profile.dateOfBirth.split("T")[0] : "")
              : "",
            spouseDob: profile.spouseDob
              ? (typeof profile.spouseDob === "string" ? profile.spouseDob.split("T")[0] : "")
              : "",
          });
        } else {
          setIndividualForm({});
        }
      } else if (res.account.accountType === "COMPANY") {
        const cp = res.account.companyProfile;
        setCompanyForm(
          cp
            ? { ...cp }
            : {
                postalSameAsBusiness: true,
                directorCount: 1,
                selfIsDirector: true,
                selfIsShareholder: false,
              }
        );
      } else if (res.account.accountType === "TRUST") {
        const tp = res.account.trustProfile;
        if (tp) {
          const rawTrustee = tp.trusteeDetails;
          const rawBens = tp.beneficiaries;
          setTrustForm({
            ...tp,
            trusteeDetails: typeof rawTrustee === "string" ? rawTrustee : JSON.stringify(rawTrustee || [], null, 2),
            beneficiaries: typeof rawBens === "string" ? rawBens : JSON.stringify(rawBens || [], null, 2),
          });
        } else {
          setTrustForm({
            trusteeDetails: JSON.stringify(
              [{ type: "INDIVIDUAL", fullName: "", address: { street: "", suburb: "", state: "", postcode: "", country: "Australia" } }],
              null,
              2
            ),
            beneficiaries: JSON.stringify([], null, 2),
          });
        }
      } else if (res.account.accountType === "PARTNERSHIP") {
        const pp = res.account.partnershipProfile;
        if (pp) {
          setPartnershipForm({
            ...pp,
            partners: JSON.stringify(pp.partners || [], null, 2),
          });
        } else {
          setPartnershipForm({ partners: JSON.stringify([], null, 2) });
        }
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
        const firstName = (individualForm.firstName || "").trim();
        const lastName = (individualForm.lastName || "").trim();
        const gender = (individualForm.gender || "").trim();
        const rawTfn = (individualForm.tfn || "").replace(/\s/g, "");
        const isMaskedTfn = rawTfn.includes("*"); // Masked from API e.g. "*******21"

        if (!firstName) {
          setError("First name is required for Individual accounts.");
          setSaving(false);
          return;
        }
        if (!lastName) {
          setError("Last name is required for Individual accounts.");
          setSaving(false);
          return;
        }
        if (!gender) {
          setError("Gender is required for Individual accounts.");
          setSaving(false);
          return;
        }

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
          firstName,
          lastName,
          gender,
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

        // TFN is required for Company accounts
        if (!isMaskedCompanyTfn) {
          if (!companyTfn) {
            setError("Tax File Number (TFN) is required for Company accounts.");
            setSaving(false);
            return;
          }
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
          selfDirectorId: companyForm.selfDirectorId?.replace(/\s/g, "").trim()
            ? companyForm.selfDirectorId.replace(/\s/g, "").trim()
            : null,
        };
      } else if (account.accountType === "TRUST") {
        const trustTfnRaw = (trustForm.tfn || "").replace(/\s/g, "");
        const isMaskedTrustTfn = trustTfnRaw.includes("*");

        if (!isMaskedTrustTfn) {
          if (!trustTfnRaw) {
            setError("Tax File Number (TFN) is required for Trust accounts.");
            setSaving(false);
            return;
          }
          if (!/^\d{8,9}$/.test(trustTfnRaw)) {
            setError("TFN must be 8 or 9 digits.");
            setSaving(false);
            return;
          }
        }

        let trusteeDetailsParsed: unknown = [];
        let beneficiariesParsed: unknown = [];
        try {
          trusteeDetailsParsed = trustForm.trusteeDetails
            ? typeof trustForm.trusteeDetails === "string"
              ? JSON.parse(trustForm.trusteeDetails)
              : trustForm.trusteeDetails
            : [];
          if (!Array.isArray(trusteeDetailsParsed)) trusteeDetailsParsed = [];
        } catch {
          setError("Trustee details contain invalid JSON.");
          setSaving(false);
          return;
        }
        try {
          beneficiariesParsed = trustForm.beneficiaries
            ? typeof trustForm.beneficiaries === "string"
              ? JSON.parse(trustForm.beneficiaries)
              : trustForm.beneficiaries
            : [];
          if (!Array.isArray(beneficiariesParsed)) beneficiariesParsed = [];
        } catch {
          setError("Beneficiaries contain invalid JSON.");
          setSaving(false);
          return;
        }

        const abnDigits = (trustForm.abn || "").replace(/\D/g, "").slice(0, 11);

        profile = {
          trustName: trustForm.trustName,
          trustType: trustForm.trustType,
          tfn: isMaskedTrustTfn ? undefined : trustTfnRaw || undefined,
          abn: abnDigits || null,
          trusteeDetails: trusteeDetailsParsed,
          beneficiaries: beneficiariesParsed,
        };
      } else if (account.accountType === "PARTNERSHIP") {
        const partnerTfn = (partnershipForm.tfn || "").replace(/\s/g, "");
        const isMaskedPartnerTfn = partnerTfn.includes("*");

        // TFN is required for Partnership accounts
        if (!isMaskedPartnerTfn) {
          if (!partnerTfn) {
            setError("Tax File Number (TFN) is required for Partnership accounts.");
            setSaving(false);
            return;
          }
          if (!/^\d{8,9}$/.test(partnerTfn)) {
            setError("TFN must be 8 or 9 digits.");
            setSaving(false);
            return;
          }
        }

        const rawSelfPct = partnershipForm.selfOwnershipPercent as number | string | undefined | null;
        const selfPct =
          rawSelfPct === undefined || rawSelfPct === null || rawSelfPct === ""
            ? undefined
            : Number(rawSelfPct);

        profile = {
          ...partnershipForm,
          tfn: isMaskedPartnerTfn ? undefined : (partnerTfn || undefined),
          ...(selfPct !== undefined && !Number.isNaN(selfPct) ? { selfOwnershipPercent: selfPct } : {}),
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
        <div className="w-10 h-10 border-4 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
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
          <IndividualForm form={individualForm} setForm={setIndividualForm} accountId={accountId} formError={error} />
        )}
        {account.accountType === "COMPANY" && (
          <CompanyForm form={companyForm} setForm={setCompanyForm} accountId={accountId} ownerName={user?.name || ""} ownerEmail={user?.email || ""} formError={error} />
        )}
        {account.accountType === "TRUST" && (
          <TrustForm form={trustForm} setForm={setTrustForm} accountId={accountId} />
        )}
        {account.accountType === "PARTNERSHIP" && (
          <PartnershipForm form={partnershipForm} setForm={setPartnershipForm} accountId={accountId} ownerName={user?.name || ""} ownerEmail={user?.email || ""} formError={error} />
        )}

        <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:shadow-lg hover:shadow-[#E91E8C]/30 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {account.status === "DRAFT" && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 rounded-xl border border-[#E91E8C] text-[#E91E8C] font-medium hover:bg-[#E91E8C]/10 transition-all disabled:opacity-50"
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
          <a href="/user-dashboard/consents" className="text-sm text-[#E91E8C] hover:underline">
            Manage Consents
          </a>
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
            <a href="/user-dashboard/consents" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E91E8C] text-white text-sm font-medium hover:bg-[#c4177a] transition-colors">
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
  formError,
}: {
  form: Partial<IndividualProfile>;
  setForm: React.Dispatch<React.SetStateAction<Partial<IndividualProfile>>>;
  accountId: string;
  formError?: string;
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
  const firstNameError = formError && formError.toLowerCase().includes("first name") ? formError : "";
  const lastNameError = formError && formError.toLowerCase().includes("last name") ? formError : "";
  const genderError = formError && formError.toLowerCase().includes("gender") ? formError : "";
  const tfnError = formError && formError.toLowerCase().includes("tfn") ? formError : "";
  const postcodeError = formError && formError.toLowerCase().includes("postcode") ? formError : "";

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
        {firstNameError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{firstNameError}</p>}
      </div>
      <div>
        <label className={labelClass}>Middle Name <span className="text-slate-400">(optional)</span></label>
        <input type="text" value={form.middleName || ""} onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))} placeholder="William" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.lastName || ""} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" className={inputClass} />
        {lastNameError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{lastNameError}</p>}
      </div>
      <div>
        <label className={labelClass}>Date of Birth</label>
        <input type="date" value={form.dateOfBirth || ""} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Gender <span className="text-red-500">*</span></label>
        <select value={form.gender || ""} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className={inputClass}>
          <option value="">Select Gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
        </select>
        {genderError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{genderError}</p>}
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
        {tfnError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{tfnError}</p>}
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
            className="w-5 h-5 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
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
            className="w-5 h-5 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
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
            className="w-5 h-5 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
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
        <input
          type="text"
          value={form.postcode || ""}
          onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
          maxLength={4}
          placeholder="2000"
          className={inputClass}
        />
        {postcodeError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{postcodeError}</p>}
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
                    className="w-4 h-4 text-[#E91E8C] focus:ring-[#E91E8C]"
                  />
                  <span className="text-sm text-slate-700 dark:text-white/80">Yes, in Australia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="spouseInAustralia"
                    checked={form.spouseInAustralia === false}
                    onChange={() => setForm((f) => ({ ...f, spouseInAustralia: false, spouseStatus: undefined }))}
                    className="w-4 h-4 text-[#E91E8C] focus:ring-[#E91E8C]"
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
                          <div className="w-5 h-5 border-2 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
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
                      className="px-4 py-2 rounded-xl bg-[#E91E8C] text-white text-sm font-medium hover:bg-[#c4177a] transition-colors disabled:opacity-50"
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
            className="w-5 h-5 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
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

type RentalPropertyDraft = {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  ownershipPercent: number;
};

const RENTAL_PROPERTY_DRAFT_EMPTY: RentalPropertyDraft = {
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  ownershipPercent: 100,
};

/** Module-level form so React identity stays stable — avoids input blur on each parent re-render. */
function RentalPropertyForm({
  data,
  setData,
  onSubmit,
  submitLabel,
  onCancel,
  saving,
}: {
  data: RentalPropertyDraft;
  setData: React.Dispatch<React.SetStateAction<RentalPropertyDraft>>;
  onSubmit: () => void;
  submitLabel: string;
  onCancel: () => void;
  saving: boolean;
}) {
  const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm";
  const lblCls = "block text-xs font-medium text-slate-600 dark:text-white/70 mb-1";

  return (
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
          <input
            className={inputCls}
            placeholder="Suburb"
            value={data.suburb}
            onChange={(e) => setData((d) => ({ ...d, suburb: e.target.value }))}
          />
        </div>
        <div>
          <label className={lblCls}>State</label>
          <select className={inputCls} value={data.state} onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))}>
            <option value="">Select</option>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lblCls}>Postcode</label>
          <input
            className={inputCls}
            placeholder="0000"
            maxLength={4}
            value={data.postcode}
            onChange={(e) => setData((d) => ({ ...d, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
          />
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
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-xl bg-[#E91E8C] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

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

  const [newProp, setNewProp] = useState<RentalPropertyDraft>(RENTAL_PROPERTY_DRAFT_EMPTY);
  const [editProp, setEditProp] = useState<RentalPropertyDraft>(RENTAL_PROPERTY_DRAFT_EMPTY);

  const handleAdd = async () => {
    if (!newProp.address.trim()) { setError("Property address is required"); return; }
    if (newProp.ownershipPercent <= 0 || newProp.ownershipPercent > 100) { setError("Ownership must be between 0.01% and 100%"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await apiPost(`/accounts/${accountId}/rental-properties`, newProp);
      if (res.error) { setError(res.error); setSaving(false); return; }
      onUpdate([res.property, ...properties]);
      setNewProp(RENTAL_PROPERTY_DRAFT_EMPTY);
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
                  <RentalPropertyForm
                    data={editProp}
                    setData={setEditProp}
                    onSubmit={() => handleUpdate(p.id)}
                    submitLabel="Update Property"
                    onCancel={() => { setEditingId(null); setError(""); }}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#E91E8C] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      <span className="font-medium text-slate-900 dark:text-white text-sm truncate">{p.address}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-white/50">
                      {p.suburb && <span>{p.suburb}</span>}
                      {p.state && <span>{p.state}</span>}
                      {p.postcode && <span>{p.postcode}</span>}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] font-medium">
                        {Number(p.ownershipPercent)}% ownership
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#E91E8C] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
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
        <RentalPropertyForm
          data={newProp}
          setData={setNewProp}
          onSubmit={handleAdd}
          submitLabel="Add Property"
          onCancel={() => { setShowAddForm(false); setNewProp(RENTAL_PROPERTY_DRAFT_EMPTY); setError(""); }}
          saving={saving}
        />
      ) : (
        <button
          onClick={() => { setShowAddForm(true); setError(""); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors text-sm font-medium"
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
  directorId?: string;
  status: string;
}

function CompanyForm({
  form,
  setForm,
  accountId,
  ownerName,
  ownerEmail,
  formError,
}: {
  form: Partial<CompanyProfile>;
  setForm: React.Dispatch<React.SetStateAction<Partial<CompanyProfile>>>;
  accountId: string;
  ownerName: string;
  ownerEmail: string;
  formError?: string;
}) {
  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2";
  const sectionHeader = "text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-3";

  // Directors/Shareholders
  const [partners, setPartners] = useState<CompanyPartnerItem[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showAddDirector, setShowAddDirector] = useState(false);
  const [newDirector, setNewDirector] = useState({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0, directorId: "" });
  const [addingDirector, setAddingDirector] = useState(false);
  const [directorError, setDirectorError] = useState("");
  const [directorSuccess, setDirectorSuccess] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; isDirector: boolean; isShareholder: boolean; shareCount: number; directorId: string }>({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0, directorId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");

  // Email check state
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ exists: boolean; name?: string } | null>(null);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tfnError = formError && formError.toLowerCase().includes("tfn") ? formError : "";
  const postalCodeError = formError && formError.toLowerCase().includes("postal") && formError.toLowerCase().includes("postcode") ? formError : "";

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
        directorId: newDirector.directorId || undefined,
      });
      if ((res as unknown as { error?: string }).error) { setDirectorError((res as unknown as { error: string }).error); setAddingDirector(false); return; }
      setPartners((p) => [...p, res.partner]);
      // Show success message based on whether user exists
      if (res.isExistingUser) {
        setDirectorSuccess(`Invitation sent to ${newDirector.email}. They will see an Accept/Reject request on their dashboard.`);
      } else {
        setDirectorSuccess(`Registration invitation sent to ${newDirector.email}. Once they register, they can accept the request from their dashboard.`);
      }
      setNewDirector({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0, directorId: "" });
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
      directorId: p.directorId || "",
    });
    setDirectorError("");
    setDirectorSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", email: "", isDirector: true, isShareholder: false, shareCount: 0, directorId: "" });
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
        directorId: editForm.directorId || null,
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
          />
        )}
        {tfnError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{tfnError}</p>}
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
            checked={form.postalSameAsBusiness === true}
            onChange={(e) => setForm((f) => ({ ...f, postalSameAsBusiness: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
          />
          <span className="text-sm text-slate-700 dark:text-white/80">Same as business address</span>
        </label>
      </div>
      {!form.postalSameAsBusiness && (
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
            {postalCodeError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{postalCodeError}</p>}
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
        <div className="p-4 rounded-xl border-2 border-[#E91E8C]/30 bg-gradient-to-r from-[#E91E8C]/5 to-transparent dark:from-[#E91E8C]/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#E91E8C]/10 flex items-center justify-center text-[#E91E8C] font-bold text-sm shrink-0">
              {ownerName ? ownerName.charAt(0).toUpperCase() : "Y"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">{ownerName || "You"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] font-medium uppercase tracking-wider">Owner</span>
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
                className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
              />
              <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.selfIsShareholder === true}
                onChange={(e) => setForm((f) => ({ ...f, selfIsShareholder: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]"
              />
              <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
            </label>
          </div>
          {/* Director ID for self (only if director) */}
          {form.selfIsDirector !== false && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-white/70">Director ID (DIN)</label>
                <span className="text-[10px] text-slate-400 dark:text-white/30 italic">Optional</span>
              </div>
              <input
                type="text"
                value={form.selfDirectorId || ""}
                onChange={(e) => setForm((f) => ({ ...f, selfDirectorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) }))}
                placeholder="e.g. 036 123 456 789"
                maxLength={18}
                className={inputClass + " !py-2 text-sm w-64 font-mono tracking-wider mt-1"}
              />
              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-1">
                Australian Director Identification Number.{" "}
                <a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline font-medium">
                  Don&apos;t have one? Apply here &rarr;
                </a>
              </p>
            </div>
          )}
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
                      <input type="checkbox" checked={editForm.isDirector} onChange={(e) => setEditForm((f) => ({ ...f, isDirector: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]" />
                      <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.isShareholder} onChange={(e) => setEditForm((f) => ({ ...f, isShareholder: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]" />
                      <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
                    </label>
                  </div>
                  {editForm.isDirector && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic font-normal">Optional</span></label>
                      <input type="text" value={editForm.directorId} onChange={(e) => setEditForm((f) => ({ ...f, directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) }))} placeholder="e.g. 036 123 456 789" maxLength={18} className={inputClass + " !py-2.5 text-sm w-56 font-mono tracking-wider"} />
                      <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                        <a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a>
                      </p>
                    </div>
                  )}
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
                      {p.isDirector && p.directorId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 font-mono">DIN: {p.directorId}</span>}
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
                  <input type="checkbox" checked={newDirector.isDirector} onChange={(e) => setNewDirector((d) => ({ ...d, isDirector: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]" />
                  <span className="text-sm text-slate-700 dark:text-white/80">Director</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newDirector.isShareholder} onChange={(e) => setNewDirector((d) => ({ ...d, isShareholder: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#E91E8C] focus:ring-[#E91E8C]" />
                  <span className="text-sm text-slate-700 dark:text-white/80">Shareholder</span>
                </label>
              </div>
            </div>

            {/* Director ID (only if director) */}
            {newDirector.isDirector && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic font-normal">Optional</span></label>
                <input type="text" value={newDirector.directorId} onChange={(e) => setNewDirector((d) => ({ ...d, directorId: e.target.value.replace(/[^\d\s]/g, "").slice(0, 15) }))} placeholder="e.g. 036 123 456 789" maxLength={18} className={inputClass + " !py-2.5 text-sm w-56 font-mono tracking-wider"} />
                <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                  Australian Director Identification Number.{" "}
                  <a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline font-medium">
                    Don&apos;t have one? Apply here &rarr;
                  </a>
                </p>
              </div>
            )}

            {/* Share count (only if shareholder) */}
            {newDirector.isShareholder && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">Number of Shares</label>
                <input type="number" min={0} value={newDirector.shareCount} onChange={(e) => setNewDirector((d) => ({ ...d, shareCount: parseInt(e.target.value) || 0 }))} className={inputClass + " !py-2.5 text-sm w-40"} />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleAddDirector} disabled={addingDirector} className="px-4 py-2 text-sm rounded-xl bg-[#E91E8C] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors">
                {addingDirector ? "Sending Invitation..." : emailStatus?.exists ? "Send Invitation" : "Send Registration Invite"}
              </button>
              <button onClick={() => { setShowAddDirector(false); setDirectorError(""); setEmailStatus(null); }} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddDirector(true); setDirectorError(""); setDirectorSuccess(""); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors text-sm font-medium"
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

// ─── Trust detail form sub-components & TrustForm ────────────────────────────
const TR_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
const trIn = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]/50 focus:border-[#E91E8C] transition-colors";
const trLbl = "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2";

interface TrAddr { street: string; suburb: string; state: string; postcode: string; country: string; }
function emptyA(): TrAddr { return { street: "", suburb: "", state: "", postcode: "", country: "Australia" }; }

// Address sub-component for Trust forms
function TrAddrFields({ value, onChange, label }: { value: TrAddr; onChange: (a: TrAddr) => void; label?: string }) {
  const p = label ? `${label} ` : "";
  return (
    <div className="grid gap-3">
      <div><label className={trLbl}>{p}Street Address <span className="text-red-500">*</span></label><input className={trIn} placeholder="123 Main Street" value={value.street} onChange={(e) => onChange({ ...value, street: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={trLbl}>{p}Suburb <span className="text-red-500">*</span></label><input className={trIn} placeholder="Melbourne" value={value.suburb} onChange={(e) => onChange({ ...value, suburb: e.target.value })} /></div>
        <div><label className={trLbl}>{p}State <span className="text-red-500">*</span></label><select className={trIn} value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })}><option value="">Select</option>{TR_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={trLbl}>{p}Postcode <span className="text-red-500">*</span></label><input className={trIn} placeholder="3000" maxLength={4} value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
      </div>
    </div>
  );
}

// Collapsible card
function TrCard({ title, idx, open: defOpen, onRemove, children }: { title: string; idx: number; open?: boolean; onRemove?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(defOpen ?? true);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
        <span className="flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] text-xs font-bold flex items-center justify-center">{idx + 1}</span><span className="font-medium text-slate-900 dark:text-white text-sm">{title}</span></span>
        <span className="flex items-center gap-2">
          {onRemove && <span role="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Remove</span>}
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

// ── Generic Trust People Invite Section ──────────────────────────────────────
interface TrustPartnerItem {
  id: string;
  email: string;
  name?: string;
  role?: string;
  directorId?: string;
  beneficiaryPercent?: number;
  status: string;
  fullName?: string;
  detailsFilledAt?: string;
  user?: { id: string; name: string; email: string } | null;
  // Minor fields
  isMinor?: boolean;
  parentName?: string;
  parentRelationship?: string;
  // Company unit holder fields
  partnerType?: string;
  parentPartnerId?: string;
  companyName?: string;
  companyTfn?: string;
  companyAbn?: string;
  companyAddress?: string;
  companySuburb?: string;
  companyState?: string;
  companyPostcode?: string;
}

const INVITE_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

/**
 * Reusable invite section — used for Directors, Trustee (Individual),
 * Beneficiaries, and Unit Holders. Filters partners by role.
 * Supports adding minors when allowMinors=true.
 */
function TrustInviteBlock({
  accountId,
  title,
  subtitle,
  buttonLabel,
  defaultRole,
  roleFilter,
  allPartners,
  onRefresh,
  allowMinors = false,
}: {
  accountId: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  defaultRole: string;
  roleFilter: string[];
  allPartners: TrustPartnerItem[];
  onRefresh: () => void;
  allowMinors?: boolean;
}) {
  const [showAdd, setShowAdd] = useState<"adult" | "minor" | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDirId, setNewDirId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Minor fields
  const [minorDob, setMinorDob] = useState("");
  const [minorStreet, setMinorStreet] = useState("");
  const [minorSuburb, setMinorSuburb] = useState("");
  const [minorState, setMinorState] = useState("");
  const [minorPostcode, setMinorPostcode] = useState("");
  const [minorParentName, setMinorParentName] = useState("");
  const [minorParentRel, setMinorParentRel] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [locallyRemovedIds, setLocallyRemovedIds] = useState<string[]>([]);

  const AU_S = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

  const filtered = allPartners.filter((p) => roleFilter.includes(p.role || "") && !locallyRemovedIds.includes(p.id));

  const isDirectorRole = defaultRole.toLowerCase().includes("director");

  function resetForm() {
    setNewName(""); setNewEmail(""); setNewDirId(""); setShowAdd(null);
    setMinorDob(""); setMinorStreet(""); setMinorSuburb(""); setMinorState(""); setMinorPostcode("");
    setMinorParentName(""); setMinorParentRel("");
  }

  async function handleAdd() {
    if (showAdd === "minor") {
      if (!newName.trim()) { setError("Name is required"); return; }
      if (!minorStreet.trim()) { setError("Address is required for a minor"); return; }
      setAdding(true); setError(""); setSuccess("");
      try {
        await apiPost("/trust-partners", {
          accountId, email: "", name: newName, role: defaultRole, isMinor: true,
          dateOfBirth: minorDob || undefined,
          streetAddress: minorStreet, suburb: minorSuburb, state: minorState, postcode: minorPostcode,
          parentName: minorParentName || undefined, parentRelationship: minorParentRel || undefined,
        });
        setSuccess(`Minor "${newName}" added`);
        resetForm(); onRefresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to add minor"); }
      finally { setAdding(false); }
    } else {
      if (!newEmail.includes("@")) { setError("Enter a valid email"); return; }
      setAdding(true); setError(""); setSuccess("");
      try {
        await apiPost("/trust-partners", { accountId, email: newEmail, name: newName || undefined, role: defaultRole, directorId: newDirId || undefined });
        setSuccess(`Invitation sent to ${newEmail}`);
        resetForm(); onRefresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to send invite"); }
      finally { setAdding(false); }
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this person?")) return;
    setRemovingId(id);
    try {
      await apiDelete(`/trust-partners/${id}`);
      // Optimistically hide item so UI updates immediately even if refresh is delayed.
      setLocallyRemovedIds((prev) => [...prev, id]);
      setSuccess("Entry removed successfully");
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  }

  const [reminding, setReminding] = useState<string | null>(null);

  async function handleResend(id: string) {
    try { await apiPost(`/trust-partners/${id}/resend`, {}); setSuccess("Invitation resent"); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to resend"); }
  }

  async function handleRemind(id: string) {
    setReminding(id); setError(""); setSuccess("");
    try {
      await apiPost(`/trust-partners/${id}/remind`, {});
      setSuccess("Reminder email sent successfully");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to send reminder"); }
    finally { setReminding(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">{title}</h3>
          <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowAdd("adult")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {allowMinors ? "Add Adult" : buttonLabel}
          </button>
          {allowMinors && (
            <button type="button" onClick={() => setShowAdd("minor")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Minor
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}
      {success && <div className="mb-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"><p className="text-xs text-green-600 dark:text-green-400">{success}</p></div>}

      {/* Adult add form */}
      {showAdd === "adult" && (
        <div className="mb-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={trLbl}>Name <span className="text-red-500">*</span></label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className={trIn} />
            </div>
            <div>
              <label className={trLbl}>Email <span className="text-red-500">*</span></label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" className={trIn} />
            </div>
          </div>
          {isDirectorRole && (
            <div>
              <label className={trLbl}>Director ID (DIN) <span className="text-[10px] text-slate-400 italic font-normal">Optional</span></label>
              <input type="text" value={newDirId} onChange={(e) => setNewDirId(e.target.value.replace(/[^\d\s]/g, "").slice(0, 15))} placeholder="e.g. 036 123 456 789" maxLength={18} className={trIn + " font-mono tracking-wider w-56"} />
              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                Australian Director Identification Number.{" "}
                <a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline font-medium">
                  Don&apos;t have one? Apply here &rarr;
                </a>
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={adding || !newEmail || !newName} className="px-4 py-2 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a] disabled:opacity-50">{adding ? "Sending..." : "Send Invitation"}</button>
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-xs">Cancel</button>
          </div>
          <p className="text-xs text-slate-400 dark:text-white/40">If already registered, they get an in-app invite. Otherwise, an email is sent to register first.</p>
        </div>
      )}

      {/* Minor add form */}
      {showAdd === "minor" && (
        <div className="mb-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">Minor (under 18)</span>
            <p className="text-xs text-slate-500 dark:text-white/50">No TFN needed — you fill their details directly</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={trLbl}>Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Minor's full name" className={trIn} />
            </div>
            <div>
              <label className={trLbl}>Date of Birth</label>
              <input type="date" value={minorDob} onChange={(e) => setMinorDob(e.target.value)} className={trIn} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={trLbl}>Street Address <span className="text-red-500">*</span></label>
              <input type="text" value={minorStreet} onChange={(e) => setMinorStreet(e.target.value)} placeholder="123 Main St" className={trIn} />
            </div>
            <div>
              <label className={trLbl}>Suburb</label>
              <input type="text" value={minorSuburb} onChange={(e) => setMinorSuburb(e.target.value)} placeholder="Sydney" className={trIn} />
            </div>
            <div>
              <label className={trLbl}>State</label>
              <select value={minorState} onChange={(e) => setMinorState(e.target.value)} className={trIn}>
                <option value="">Select</option>
                {AU_S.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={trLbl}>Postcode</label>
              <input type="text" value={minorPostcode} onChange={(e) => setMinorPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2000" maxLength={4} className={trIn} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={trLbl}>Parent/Guardian Name</label>
              <input type="text" value={minorParentName} onChange={(e) => setMinorParentName(e.target.value)} placeholder="Parent name" className={trIn} />
            </div>
            <div>
              <label className={trLbl}>Relationship</label>
              <select value={minorParentRel} onChange={(e) => setMinorParentRel(e.target.value)} className={trIn}>
                <option value="">Select</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={adding || !newName} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50">{adding ? "Adding..." : "Add Minor"}</button>
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-5 bg-slate-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-white/50">No one added yet. Click &ldquo;{allowMinors ? "Add Adult" : buttonLabel}&rdquo; to add.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-xs ${p.isMinor ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-[#E91E8C] to-[#c4177a]"}`}>{(p.name || p.email).charAt(0).toUpperCase()}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{p.name || p.email}</p>
                    {p.isMinor && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">Minor</span>}
                    {!p.isMinor && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INVITE_STATUS_BADGE[p.status] || "bg-slate-100 text-slate-500"}`}>{p.status}</span>}
                    {p.detailsFilledAt && <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Details filled</span>}
                    {!p.isMinor && p.status === "APPROVED" && !p.detailsFilledAt && <span className="text-[10px] text-amber-500">Awaiting details</span>}
                  </div>
                    <p className="text-xs text-slate-500 dark:text-white/50">
                      {p.isMinor ? `Minor${p.parentName ? ` — Parent: ${p.parentName}` : ""}` : p.email} &middot; {p.role}{p.directorId ? ` · DIN: ${p.directorId}` : ""}
                    </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.isMinor && !p.detailsFilledAt && p.partnerType !== "COMPANY" && (
                  <button
                    type="button"
                    onClick={() => handleRemind(p.id)}
                    disabled={reminding === p.id}
                    className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
                    title="Send reminder email"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {reminding === p.id ? "Sending..." : "Reminder"}
                  </button>
                )}
                {p.status === "PENDING" && !p.isMinor && <button type="button" onClick={() => handleResend(p.id)} className="text-xs text-[#E91E8C] hover:underline">Resend</button>}
                <button type="button" onClick={() => handleRemove(p.id)} disabled={removingId === p.id} className="text-xs text-red-500 hover:underline disabled:opacity-50">{removingId === p.id ? "Removing..." : "Remove"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Unit Holder Section — supports both Individual and Company unit holders.
 * Company unit holders display company details + their directors (invited via TrustInviteBlock).
 */
function UnitHolderSection({ accountId, allPartners, onRefresh }: { accountId: string; allPartners: TrustPartnerItem[]; onRefresh: () => void }) {
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [compForm, setCompForm] = useState({ name: "", tfn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" as "COMPANY" | "TRUSTEE_COMPANY" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const fmtTfn = (raw: string) => { const d = raw.replace(/\D/g, "").slice(0, 9); if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`; return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`; };

  const individualUHs = allPartners.filter((p) => (p.role === "Unit Holder") && (p.partnerType || "INDIVIDUAL") === "INDIVIDUAL");
  const companyUHs = allPartners.filter((p) => (p.role === "Unit Holder") && p.partnerType === "COMPANY");

  function getDirectors(companyId: string) {
    return allPartners.filter((p) => p.parentPartnerId === companyId && p.role === "UH Director");
  }
  function getTrustees(companyId: string) {
    return allPartners.filter((p) => p.parentPartnerId === companyId && p.role === "UH Trustee");
  }

  async function handleAddCompany() {
    if (!compForm.name.trim()) { setError("Company name is required"); return; }
    const cTfn = compForm.tfn.replace(/\s/g, "");
    if (!cTfn) { setError("Company TFN is required"); return; }
    if (!/^\d{8,9}$/.test(cTfn)) { setError("Company TFN must be 8 or 9 digits"); return; }
    if (!compForm.street.trim()) { setError("Registered address is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiPost("/trust-partners", {
        accountId,
        email: `company-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@placeholder.internal`,
        name: compForm.name, role: "Unit Holder", partnerType: "COMPANY",
        companyName: compForm.name, companyTfn: compForm.tfn || undefined, companyAbn: compForm.abn || undefined,
        companyAddress: compForm.street, companySuburb: compForm.suburb, companyState: compForm.state, companyPostcode: compForm.postcode,
      });
      setSuccess(`Company "${compForm.name}" added`);
      setCompForm({ name: "", tfn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" });
      setShowAddCompany(false); onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add company"); }
    finally { setSaving(false); }
  }

  async function handleRemoveCompany(id: string) {
    if (!confirm("Remove this company and all its directors/trustees?")) return;
    try { await apiDelete(`/trust-partners/${id}`); onRefresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to remove"); }
  }

  // Add director/trustee to a company
  const [addPersonFor, setAddPersonFor] = useState<{ companyId: string; personType: "director" | "trustee" } | null>(null);
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personDirId, setPersonDirId] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  async function handleAddPerson(companyId: string, personType: "director" | "trustee") {
    if (!personEmail.includes("@")) { setError("Enter a valid email"); return; }
    setAddingPerson(true); setError("");
    try {
      await apiPost("/trust-partners", {
        accountId, email: personEmail, name: personName || undefined,
        role: personType === "director" ? "UH Director" : "UH Trustee",
        parentPartnerId: companyId,
        directorId: personDirId || undefined,
      });
      setSuccess(`${personType === "director" ? "Director" : "Trustee"} invite sent to ${personEmail}`);
      setPersonName(""); setPersonEmail(""); setPersonDirId(""); setAddPersonFor(null); onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to invite"); }
    finally { setAddingPerson(false); }
  }

  const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

  function renderPersonList(people: TrustPartnerItem[], pType: string) {
    if (people.length === 0) {
      return (<div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10"><p className="text-[11px] text-slate-400 dark:text-white/40">No {pType}s invited yet</p></div>);
    }
  return (
      <div className="space-y-2">
        {people.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${pType === "trustee" ? "bg-indigo-500" : "bg-purple-500"}`}>{(d.name || d.email).charAt(0).toUpperCase()}</div>
        <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{d.name || d.email}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INVITE_STATUS_BADGE[d.status] || "bg-slate-100 text-slate-500"}`}>{d.status}</span>
                  {d.detailsFilledAt && <span className="text-[10px] text-green-600">Details filled</span>}
                  {d.directorId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 font-mono">DIN: {d.directorId}</span>}
        </div>
                <p className="text-[11px] text-slate-500 dark:text-white/50">{d.email}</p>
        </div>
              </div>
            <div className="flex items-center gap-1.5">
              {!d.detailsFilledAt && (
                <button type="button" onClick={() => { apiPost(`/trust-partners/${d.id}/remind`, {}).then(() => setSuccess("Reminder sent")).catch(() => setError("Failed")); }} className="text-[11px] text-amber-600 hover:underline">Reminder</button>
              )}
              {d.status === "PENDING" && <button type="button" onClick={() => { apiPost(`/trust-partners/${d.id}/resend`, {}).then(() => setSuccess("Resent")).catch(() => {}); }} className="text-[11px] text-purple-600 hover:underline">Resend</button>}
              <button type="button" onClick={() => { if (confirm("Remove?")) { apiDelete(`/trust-partners/${d.id}`).then(onRefresh); } }} className="text-[11px] text-red-500 hover:underline">Remove</button>
        </div>
        </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrustInviteBlock accountId={accountId} title="Individual Unit Holders" subtitle="Adults fill their own details after accepting. For minors, you fill the details directly." buttonLabel="Invite Individual" defaultRole="Unit Holder" roleFilter={["Unit Holder"]} allPartners={individualUHs} onRefresh={onRefresh} allowMinors={true} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Company Unit Holders</h3>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">Companies holding units — choose Company or Trustee Company</p>
          </div>
          <button type="button" onClick={() => setShowAddCompany(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Company
          </button>
      </div>

        {error && <div className="mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}
        {success && <div className="mb-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"><p className="text-xs text-green-600 dark:text-green-400">{success}</p></div>}

        {showAddCompany && (
          <div className="mb-4 p-5 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 space-y-4">
            <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300">New Company Unit Holder</h4>
        <div>
              <label className={trLbl}>Company Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {(["COMPANY", "TRUSTEE_COMPANY"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setCompForm({ ...compForm, companyType: t })} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${compForm.companyType === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                    {t === "COMPANY" ? "Company" : "Trustee Company"}
                  </button>
                ))}
        </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                {compForm.companyType === "TRUSTEE_COMPANY" ? "Trustee Company — add trustees and directors after creation" : "Company — add directors only after creation"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
        <div>
                <label className={trLbl}>{compForm.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"} <span className="text-red-500">*</span></label>
                <input type="text" className={trIn} placeholder={compForm.companyType === "TRUSTEE_COMPANY" ? "Smith Family Trust" : "ABC Pty Ltd"} value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} />
        </div>
        <div>
                <label className={trLbl}>Company TFN <span className="text-red-500">*</span> <span className="ml-1 text-xs text-amber-500 font-normal">Encrypted</span></label>
                <input className={trIn + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={fmtTfn(compForm.tfn)} onChange={(e) => setCompForm({ ...compForm, tfn: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
        </div>
              <div>
                <label className={trLbl}>Company ABN</label>
                <input className={trIn + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={compForm.abn} onChange={(e) => setCompForm({ ...compForm, abn: e.target.value })} />
      </div>
            </div>
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase">Registered Address</h5>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={trLbl}>Street <span className="text-red-500">*</span></label><input type="text" className={trIn} placeholder="123 Main St" value={compForm.street} onChange={(e) => setCompForm({ ...compForm, street: e.target.value })} /></div>
                <div><label className={trLbl}>Suburb</label><input type="text" className={trIn} placeholder="Sydney" value={compForm.suburb} onChange={(e) => setCompForm({ ...compForm, suburb: e.target.value })} /></div>
                <div><label className={trLbl}>State</label><select className={trIn} value={compForm.state} onChange={(e) => setCompForm({ ...compForm, state: e.target.value })}><option value="">Select</option>{AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className={trLbl}>Postcode</label><input type="text" className={trIn} placeholder="2000" maxLength={4} value={compForm.postcode} onChange={(e) => setCompForm({ ...compForm, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddCompany} disabled={saving || !compForm.name} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50">{saving ? "Saving..." : "Add Company"}</button>
              <button type="button" onClick={() => { setShowAddCompany(false); setCompForm({ name: "", tfn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" }); }} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {companyUHs.length === 0 && !showAddCompany ? (
          <div className="text-center py-5 bg-slate-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-white/50">No company unit holders yet. Click &ldquo;Add Company&rdquo; to add.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companyUHs.map((c) => {
              const dirs = getDirectors(c.id);
              const trustees = getTrustees(c.id);
              const hasTrustees = trustees.length > 0;
              const isExpanded = expandedCompany === c.id;
              return (
                <div key={c.id} className="rounded-xl bg-white dark:bg-white/5 border border-purple-200 dark:border-purple-800/50 overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors" onClick={() => setExpandedCompany(isExpanded ? null : c.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm">{(c.companyName || "C").charAt(0).toUpperCase()}</div>
          <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-white text-sm">{c.companyName || c.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${hasTrustees ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"}`}>
                            {hasTrustees ? "Trustee Company" : "Company"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-white/50">
                          {c.companyAbn ? `ABN: ${c.companyAbn}` : "No ABN"} &middot; {dirs.length} director{dirs.length !== 1 ? "s" : ""}{hasTrustees ? ` · ${trustees.length} trustee${trustees.length !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveCompany(c.id); }} className="text-xs text-red-500 hover:underline">Remove</button>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-purple-100 dark:border-purple-800/30 space-y-4">
                      <div className="pt-3 grid sm:grid-cols-2 gap-3">
                        <div><p className="text-xs text-slate-400">{hasTrustees ? "Trust Name" : "Company Name"}</p><p className="text-sm text-slate-900 dark:text-white font-medium">{c.companyName || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Company TFN</p><p className="text-sm text-slate-900 dark:text-white font-mono">{c.companyTfn || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Company ABN</p><p className="text-sm text-slate-900 dark:text-white font-mono">{c.companyAbn || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Registered Address</p><p className="text-sm text-slate-900 dark:text-white">{[c.companyAddress, c.companySuburb, c.companyState, c.companyPostcode].filter(Boolean).join(", ") || "—"}</p></div>
                      </div>

                      {/* Trustees Section */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Trustees</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Trustees of this company</p>
                          </div>
                          <button type="button" onClick={() => setAddPersonFor(addPersonFor?.companyId === c.id && addPersonFor.personType === "trustee" ? null : { companyId: c.id, personType: "trustee" })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Invite Trustee
          </button>
                        </div>
                        {addPersonFor?.companyId === c.id && addPersonFor.personType === "trustee" && (
                          <div className="mb-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input type="text" className={trIn} placeholder="Trustee name" value={personName} onChange={(e) => setPersonName(e.target.value)} />
                              <input type="email" className={trIn} placeholder="trustee@example.com" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                              <input type="text" className={trIn + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={personDirId} onChange={(e) => setPersonDirId(e.target.value.replace(/[^\d\s]/g, "").slice(0, 15))} />
                              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleAddPerson(c.id, "trustee")} disabled={addingPerson || !personEmail} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 disabled:opacity-50">{addingPerson ? "Sending..." : "Send Invite"}</button>
                              <button type="button" onClick={() => { setAddPersonFor(null); setPersonName(""); setPersonEmail(""); setPersonDirId(""); }} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-[11px]">Cancel</button>
                            </div>
                          </div>
                        )}
                        {renderPersonList(trustees, "trustee")}
        </div>

                      {/* Directors Section */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Directors</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Directors of this company (will receive invitation)</p>
                          </div>
                          <button type="button" onClick={() => setAddPersonFor(addPersonFor?.companyId === c.id && addPersonFor.personType === "director" ? null : { companyId: c.id, personType: "director" })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-medium hover:bg-purple-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Invite Director
                          </button>
                        </div>
                        {addPersonFor?.companyId === c.id && addPersonFor.personType === "director" && (
                          <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input type="text" className={trIn} placeholder="Director name" value={personName} onChange={(e) => setPersonName(e.target.value)} />
                              <input type="email" className={trIn} placeholder="director@example.com" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                              <input type="text" className={trIn + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={personDirId} onChange={(e) => setPersonDirId(e.target.value.replace(/[^\d\s]/g, "").slice(0, 15))} />
                              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleAddPerson(c.id, "director")} disabled={addingPerson || !personEmail} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-medium hover:bg-purple-700 disabled:opacity-50">{addingPerson ? "Sending..." : "Send Invite"}</button>
                              <button type="button" onClick={() => { setAddPersonFor(null); setPersonName(""); setPersonEmail(""); setPersonDirId(""); }} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-[11px]">Cancel</button>
                            </div>
          </div>
        )}
                        {renderPersonList(dirs, "director")}
                      </div>
          </div>
        )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Beneficiary Section — for Discretionary Trusts.
 * Individual Beneficiaries (adults + minors) + Company Beneficiaries (Company / Trustee Company).
 */
function BeneficiarySection({ accountId, allPartners, onRefresh }: { accountId: string; allPartners: TrustPartnerItem[]; onRefresh: () => void }) {
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [cbForm, setCbForm] = useState({ name: "", acn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" as "COMPANY" | "TRUSTEE_COMPANY" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const AU_S = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

  // Individual beneficiaries (non-company)
  const individualBens = allPartners.filter((p) => (p.role === "Beneficiary") && (p.partnerType || "INDIVIDUAL") === "INDIVIDUAL");
  // Company beneficiaries
  const companyBens = allPartners.filter((p) => (p.role === "Beneficiary") && p.partnerType === "COMPANY");

  function getDirectors(companyId: string) {
    return allPartners.filter((p) => p.parentPartnerId === companyId && p.role === "Ben Director");
  }
  function getTrustees(companyId: string) {
    return allPartners.filter((p) => p.parentPartnerId === companyId && p.role === "Ben Trustee");
  }

  async function handleAddCompany() {
    if (!cbForm.name.trim()) { setError("Company name is required"); return; }
    const acn = cbForm.acn.replace(/\s/g, "");
    if (!acn) { setError("Company ACN is required"); return; }
    if (!cbForm.street.trim()) { setError("Registered address is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiPost("/trust-partners", {
        accountId,
        email: `company-ben-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@placeholder.internal`,
        name: cbForm.name,
        role: "Beneficiary",
        partnerType: "COMPANY",
        companyName: cbForm.name,
        companyTfn: cbForm.acn || undefined,
        companyAbn: cbForm.abn || undefined,
        companyAddress: cbForm.street,
        companySuburb: cbForm.suburb,
        companyState: cbForm.state,
        companyPostcode: cbForm.postcode,
      });
      setSuccess(`Company "${cbForm.name}" added as beneficiary`);
      setCbForm({ name: "", acn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" });
      setShowAddCompany(false);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add company"); }
    finally { setSaving(false); }
  }

  async function handleRemoveCompany(id: string) {
    if (!confirm("Remove this company and all its directors/trustees?")) return;
    try { await apiDelete(`/trust-partners/${id}`); onRefresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to remove"); }
  }

  // Add director/trustee to a company beneficiary
  const [addPersonFor, setAddPersonFor] = useState<{ companyId: string; personType: "director" | "trustee" } | null>(null);
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personDirId, setPersonDirId] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  async function handleAddPerson(companyId: string, personType: "director" | "trustee") {
    if (!personEmail.includes("@")) { setError("Enter a valid email"); return; }
    setAddingPerson(true); setError("");
    try {
      await apiPost("/trust-partners", {
        accountId, email: personEmail, name: personName || undefined,
        role: personType === "director" ? "Ben Director" : "Ben Trustee",
        parentPartnerId: companyId,
        directorId: personDirId || undefined,
      });
      setSuccess(`${personType === "director" ? "Director" : "Trustee"} invite sent to ${personEmail}`);
      setPersonName(""); setPersonEmail(""); setPersonDirId(""); setAddPersonFor(null);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to invite"); }
    finally { setAddingPerson(false); }
  }

  function renderPersonList(people: TrustPartnerItem[], personType: string) {
    if (people.length === 0) {
      return (
        <div className="text-center py-3 rounded-lg border border-dashed border-slate-200 dark:border-white/10">
          <p className="text-[11px] text-slate-400 dark:text-white/40">No {personType}s invited yet</p>
                    </div>
      );
    }
    return (
      <div className="space-y-2">
        {people.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${personType === "trustee" ? "bg-indigo-500" : "bg-purple-500"}`}>{(d.name || d.email).charAt(0).toUpperCase()}</div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{d.name || d.email}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INVITE_STATUS_BADGE[d.status] || "bg-slate-100 text-slate-500"}`}>{d.status}</span>
                  {d.detailsFilledAt && <span className="text-[10px] text-green-600">Details filled</span>}
                  {d.directorId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 font-mono">DIN: {d.directorId}</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/50">{d.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!d.detailsFilledAt && (
                <button type="button" onClick={() => { apiPost(`/trust-partners/${d.id}/remind`, {}).then(() => setSuccess("Reminder sent")).catch(() => setError("Failed")); }} className="text-[11px] text-amber-600 hover:underline">Reminder</button>
              )}
              {d.status === "PENDING" && <button type="button" onClick={() => { apiPost(`/trust-partners/${d.id}/resend`, {}).then(() => setSuccess("Resent")).catch(() => {}); }} className="text-[11px] text-purple-600 hover:underline">Resend</button>}
              <button type="button" onClick={() => { if (confirm("Remove?")) { apiDelete(`/trust-partners/${d.id}`).then(onRefresh); } }} className="text-[11px] text-red-500 hover:underline">Remove</button>
                </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Individual Beneficiaries ── */}
      <TrustInviteBlock
        accountId={accountId}
        title="Individual Beneficiaries"
        subtitle="Adults receive an invite to fill their own details. For minors, you fill the details directly."
        buttonLabel="Invite Beneficiary"
        defaultRole="Beneficiary"
        roleFilter={["Beneficiary"]}
        allPartners={individualBens}
        onRefresh={onRefresh}
        allowMinors={true}
      />

      {/* ── Company Beneficiaries ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Company Beneficiaries</h3>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">Companies that are beneficiaries — choose Company or Trustee Company</p>
          </div>
          <button type="button" onClick={() => setShowAddCompany(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Company
          </button>
        </div>

        {error && <div className="mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}
        {success && <div className="mb-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"><p className="text-xs text-green-600 dark:text-green-400">{success}</p></div>}

        {/* Add Company Form */}
        {showAddCompany && (
          <div className="mb-4 p-5 rounded-xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 space-y-4">
            <h4 className="text-sm font-semibold text-teal-800 dark:text-teal-300">New Company Beneficiary</h4>
            {/* Company Type Selector */}
            <div>
              <label className={trLbl}>Company Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {(["COMPANY", "TRUSTEE_COMPANY"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setCbForm({ ...cbForm, companyType: t })} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${cbForm.companyType === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                    {t === "COMPANY" ? "Company" : "Trustee Company"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                {cbForm.companyType === "TRUSTEE_COMPANY" ? "Trustee Company — add trustees and directors after creation" : "Company — add directors only after creation"}
              </p>
              </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={trLbl}>{cbForm.companyType === "TRUSTEE_COMPANY" ? "Trust Name" : "Company Name"} <span className="text-red-500">*</span></label>
                <input type="text" className={trIn} placeholder={cbForm.companyType === "TRUSTEE_COMPANY" ? "Smith Family Trust" : "ABC Pty Ltd"} value={cbForm.name} onChange={(e) => setCbForm({ ...cbForm, name: e.target.value })} />
              </div>
              <div>
                <label className={trLbl}>Company ACN <span className="text-red-500">*</span></label>
                <input className={trIn + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={cbForm.acn} onChange={(e) => setCbForm({ ...cbForm, acn: e.target.value.replace(/[^0-9 ]/g, "").slice(0, 11) })} />
              </div>
              <div>
                <label className={trLbl}>Company ABN</label>
                <input className={trIn + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={cbForm.abn} onChange={(e) => setCbForm({ ...cbForm, abn: e.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase">Registered Address</h5>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={trLbl}>Street <span className="text-red-500">*</span></label>
                  <input type="text" className={trIn} placeholder="123 Main St" value={cbForm.street} onChange={(e) => setCbForm({ ...cbForm, street: e.target.value })} />
                </div>
                <div>
                  <label className={trLbl}>Suburb</label>
                  <input type="text" className={trIn} placeholder="Sydney" value={cbForm.suburb} onChange={(e) => setCbForm({ ...cbForm, suburb: e.target.value })} />
                </div>
                <div>
                  <label className={trLbl}>State</label>
                  <select className={trIn} value={cbForm.state} onChange={(e) => setCbForm({ ...cbForm, state: e.target.value })}>
                    <option value="">Select</option>
                    {AU_S.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                  <label className={trLbl}>Postcode</label>
                  <input type="text" className={trIn} placeholder="2000" maxLength={4} value={cbForm.postcode} onChange={(e) => setCbForm({ ...cbForm, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              </div>
            </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddCompany} disabled={saving || !cbForm.name} className="px-4 py-2 rounded-lg bg-[#E91E8C] text-white text-xs font-medium hover:bg-[#c4177a] disabled:opacity-50">{saving ? "Saving..." : "Add Company"}</button>
              <button type="button" onClick={() => { setShowAddCompany(false); setCbForm({ name: "", acn: "", abn: "", street: "", suburb: "", state: "", postcode: "", companyType: "COMPANY" }); }} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {/* Company List */}
        {companyBens.length === 0 && !showAddCompany ? (
          <div className="text-center py-5 bg-slate-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-white/50">No company beneficiaries yet. Click &ldquo;Add Company&rdquo; to add.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companyBens.map((c) => {
              const dirs = getDirectors(c.id);
              const trustees = getTrustees(c.id);
              const hasTrustees = trustees.length > 0;
              const isExpanded = expandedCompany === c.id;
              return (
                <div key={c.id} className="rounded-xl bg-white dark:bg-white/5 border border-teal-200 dark:border-teal-800/50 overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors" onClick={() => setExpandedCompany(isExpanded ? null : c.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-sm">{(c.companyName || "C").charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-white text-sm">{c.companyName || c.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${hasTrustees ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"}`}>
                            {hasTrustees ? "Trustee Company" : "Company"}
                      </span>
                    </div>
                        <p className="text-xs text-slate-500 dark:text-white/50">
                          {c.companyAbn ? `ABN: ${c.companyAbn}` : "No ABN"} &middot; {dirs.length} director{dirs.length !== 1 ? "s" : ""}{hasTrustees ? ` · ${trustees.length} trustee${trustees.length !== 1 ? "s" : ""}` : ""}
                        </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveCompany(c.id); }} className="text-xs text-red-500 hover:underline">Remove</button>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-teal-100 dark:border-teal-800/30 space-y-4">
                      <div className="pt-3 grid sm:grid-cols-2 gap-3">
                        <div><p className="text-xs text-slate-400">{hasTrustees ? "Trust Name" : "Company Name"}</p><p className="text-sm text-slate-900 dark:text-white font-medium">{c.companyName || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Company ACN</p><p className="text-sm text-slate-900 dark:text-white font-mono">{c.companyTfn || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Company ABN</p><p className="text-sm text-slate-900 dark:text-white font-mono">{c.companyAbn || "—"}</p></div>
                        <div><p className="text-xs text-slate-400">Registered Address</p><p className="text-sm text-slate-900 dark:text-white">{[c.companyAddress, c.companySuburb, c.companyState, c.companyPostcode].filter(Boolean).join(", ") || "—"}</p></div>
                      </div>

                      {/* Trustees Section (for Trustee Companies) */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Trustees</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Trustees of this company</p>
                          </div>
                          <button type="button" onClick={() => setAddPersonFor(addPersonFor?.companyId === c.id && addPersonFor.personType === "trustee" ? null : { companyId: c.id, personType: "trustee" })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Invite Trustee
                    </button>
                        </div>
                        {addPersonFor?.companyId === c.id && addPersonFor.personType === "trustee" && (
                          <div className="mb-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input type="text" className={trIn} placeholder="Trustee name" value={personName} onChange={(e) => setPersonName(e.target.value)} />
                              <input type="email" className={trIn} placeholder="trustee@example.com" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                              <input type="text" className={trIn + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={personDirId} onChange={(e) => setPersonDirId(e.target.value.replace(/[^\d\s]/g, "").slice(0, 15))} />
                              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleAddPerson(c.id, "trustee")} disabled={addingPerson || !personEmail} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 disabled:opacity-50">{addingPerson ? "Sending..." : "Send Invite"}</button>
                              <button type="button" onClick={() => { setAddPersonFor(null); setPersonName(""); setPersonEmail(""); setPersonDirId(""); }} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-[11px]">Cancel</button>
                            </div>
                          </div>
                        )}
                        {renderPersonList(trustees, "trustee")}
                      </div>

                      {/* Directors Section */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Directors</h4>
                            <p className="text-[11px] text-slate-400 dark:text-white/40">Directors of this company (will receive invitation)</p>
                          </div>
                          <button type="button" onClick={() => setAddPersonFor(addPersonFor?.companyId === c.id && addPersonFor.personType === "director" ? null : { companyId: c.id, personType: "director" })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-medium hover:bg-purple-700">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Invite Director
                    </button>
                        </div>
                        {addPersonFor?.companyId === c.id && addPersonFor.personType === "director" && (
                          <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input type="text" className={trIn} placeholder="Director name" value={personName} onChange={(e) => setPersonName(e.target.value)} />
                              <input type="email" className={trIn} placeholder="director@example.com" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-white/70 mb-1">Director ID (DIN) <span className="text-[10px] text-slate-400 italic">Optional</span></label>
                              <input type="text" className={trIn + " font-mono tracking-wider w-48"} placeholder="e.g. 036 123 456 789" maxLength={18} value={personDirId} onChange={(e) => setPersonDirId(e.target.value.replace(/[^\d\s]/g, "").slice(0, 15))} />
                              <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5"><a href="https://www.abrs.gov.au/director-identification-number" target="_blank" rel="noopener noreferrer" className="text-[#E91E8C] hover:underline">Don&apos;t have one? Apply here &rarr;</a></p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleAddPerson(c.id, "director")} disabled={addingPerson || !personEmail} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-medium hover:bg-purple-700 disabled:opacity-50">{addingPerson ? "Sending..." : "Send Invite"}</button>
                              <button type="button" onClick={() => { setAddPersonFor(null); setPersonName(""); setPersonEmail(""); setPersonDirId(""); }} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 text-[11px]">Cancel</button>
                            </div>
                          </div>
                        )}
                        {renderPersonList(dirs, "director")}
                </div>
              </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTfnInput(raw: string) { const d = raw.replace(/\D/g, "").slice(0, 9); if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`; return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`; }

/**
 * Trust Profile Form — Complete Australian CA workflow:
 *
 * 1. Trust Info: Name, Type, Trust TFN, Trust ABN
 * 2. Trustee Selection:
 *    - Individual → Invite (they fill own details: TFN, DOB, address)
 *    - Corporate → Company Name, Company TFN, ABN, Address
 *      + Directors → Invite each (they fill own details)
 * 3. Beneficiaries (Discretionary) / Unit Holders (Unit) → Invite system
 *
 * Everyone invited gets an email:
 * - If already registered → in-app invite
 * - If new → email to register, with context (trust name, role, why)
 */
function TrustForm({
  form,
  setForm,
  accountId,
}: {
  form: TrustFormState;
  setForm: React.Dispatch<React.SetStateAction<TrustFormState>>;
  accountId: string;
}) {
  type TrusteeD = {
    type: "INDIVIDUAL" | "COMPANY";
    fullName?: string;
    address?: TrAddr;
    companyName?: string;
    companyTfn?: string;
    companyAbn?: string;
    registeredAddress?: TrAddr;
  };

  function safeParseJson(raw: unknown): unknown[] {
    if (!raw) return [];
    let parsed = raw;
    if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } }
    if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } }
    return Array.isArray(parsed) ? parsed : [];
  }
  function parseTrustees(): TrusteeD[] { return safeParseJson(form.trusteeDetails) as TrusteeD[]; }

  const [trustee, setTrustee] = useState<TrusteeD>(() => {
    const t = parseTrustees();
    return t.length > 0 ? t[0] : { type: "INDIVIDUAL", fullName: "", address: emptyA() };
  });

  // All partners for this trust (loaded once, shared across invite blocks)
  const [allPartners, setAllPartners] = useState<TrustPartnerItem[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  async function loadPartners() {
    setPartnersLoading(true);
    try {
      const res = await apiGet<{ partners: TrustPartnerItem[] }>(`/trust-partners/account/${accountId}`);
      setAllPartners(res.partners || []);
    } catch { /* ignore */ }
    finally { setPartnersLoading(false); }
  }

  useEffect(() => { loadPartners(); }, [accountId]);

  // Sync trustee changes to form JSON
  useEffect(() => {
    setForm((f) => ({ ...f, trusteeDetails: JSON.stringify([trustee], null, 2) }));
  }, [trustee]);

  const isUnit = form.trustType === "UNIT";

  return (
    <div className="grid gap-6">
      {/* ── 1. Trust Information ────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-4">Trust Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={trLbl}>Trust Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.trustName || ""} onChange={(e) => setForm((f) => ({ ...f, trustName: e.target.value }))} placeholder="Smith Family Trust" className={trIn} />
          </div>
          <div>
            <label className={trLbl}>Trust Type <span className="text-red-500">*</span></label>
            <select value={form.trustType || ""} onChange={(e) => setForm((f) => ({ ...f, trustType: e.target.value as TrustType }))} className={trIn}>
              <option value="">Select Type</option>
              <option value="DISCRETIONARY">Family / Discretionary Trust</option>
              <option value="UNIT">Unit Trust</option>
            </select>
          </div>
          <div>
            <label className={trLbl}>Trust TFN <span className="text-red-500">*</span> <span className="ml-1 text-xs text-amber-500 font-normal">Encrypted at rest</span></label>
            {form.tfn && form.tfn.includes("*") ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono tracking-widest">
                  {form.tfn}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tfn: "" }))}
                  className="px-3 py-3 rounded-xl text-xs font-medium border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
                >
                  Change TFN
                </button>
              </div>
            ) : (
              <input
                type="text"
                className={trIn + " font-mono tracking-wider"}
                placeholder="XXX XXX XXX"
                maxLength={14}
                value={fmtTfnInput(form.tfn || "")}
                onChange={(e) => setForm((f) => ({ ...f, tfn: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
              />
            )}
          </div>
          <div>
            <label className={trLbl}>Trust ABN</label>
            <input type="text" className={trIn + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={form.abn || ""} onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* ── 2. Trustee ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-4">Trustee</h3>
        <div className="space-y-4">
          <div>
            <label className={trLbl}>Trustee Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
                <button key={t} type="button" onClick={() => {
                  if (t === "INDIVIDUAL") setTrustee({ type: "INDIVIDUAL", fullName: "", address: emptyA() });
                  else setTrustee({ type: "COMPANY", companyName: "", companyTfn: "", companyAbn: "", registeredAddress: emptyA() });
                }} className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${trustee.type === t ? "border-[#E91E8C] bg-[#E91E8C]/5 text-[#E91E8C]" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300"}`}>
                  {t === "INDIVIDUAL" ? "Individual Trustee" : "Company (Corporate Trustee)"}
                </button>
            ))}
          </div>
          </div>

          {/* ── Individual Trustee → Direct Entry (Name + Address) ── */}
          {trustee.type === "INDIVIDUAL" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs text-blue-700 dark:text-blue-400">Enter the individual trustee&apos;s name and residential address. The trustee is responsible for managing the trust.</p>
                </div>
              </div>
              <div>
                <label className={trLbl}>Trustee Full Name <span className="text-red-500">*</span></label>
                <input type="text" className={trIn} placeholder="John Smith" value={trustee.fullName || ""} onChange={(e) => setTrustee({ ...trustee, fullName: e.target.value })} />
              </div>
              <TrAddrFields label="Trustee" value={trustee.address || emptyA()} onChange={(a) => setTrustee({ ...trustee, address: a })} />
            </div>
          )}

          {/* ── Corporate Trustee → Company details + Invite Directors */}
          {trustee.type === "COMPANY" && (
            <div className="space-y-5">
              {/* Company info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={trLbl}>Company Name <span className="text-red-500">*</span></label>
                  <input className={trIn} placeholder="ABC Pty Ltd" value={trustee.companyName || ""} onChange={(e) => setTrustee({ ...trustee, companyName: e.target.value })} />
                </div>
                <div>
                  <label className={trLbl}>Company ACN <span className="text-red-500">*</span></label>
                  <input className={trIn + " font-mono tracking-wider"} placeholder="XXX XXX XXX" maxLength={11} value={trustee.companyTfn || ""} onChange={(e) => setTrustee({ ...trustee, companyTfn: e.target.value.replace(/[^0-9 ]/g, "").slice(0, 11) })} />
                </div>
                <div>
                  <label className={trLbl}>Company ABN</label>
                  <input className={trIn + " font-mono tracking-wider"} placeholder="XX XXX XXX XXX" maxLength={14} value={trustee.companyAbn || ""} onChange={(e) => setTrustee({ ...trustee, companyAbn: e.target.value })} />
                </div>
              </div>

              <TrAddrFields label="Registered" value={trustee.registeredAddress || emptyA()} onChange={(a) => setTrustee({ ...trustee, registeredAddress: a })} />

              {/* Directors — Invite System */}
              <div className="p-5 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 space-y-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Company Directors</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Invite each director. They will register (if new) and fill their own details — Full Name, TFN, DOB, Address — as required by ATO for director identification.</p>
                  </div>
                </div>
                {partnersLoading ? (
                  <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-[#E91E8C] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <TrustInviteBlock
                    accountId={accountId}
                    title="Directors"
                    subtitle="Company directors for ATO compliance"
                    buttonLabel="Invite Director"
                    defaultRole="Director"
                    roleFilter={["Director"]}
                    allPartners={allPartners}
                    onRefresh={loadPartners}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Beneficiaries / Unit Holders ─────────────────────── */}
      <div>
        {partnersLoading ? (
          <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-[#E91E8C] border-t-transparent rounded-full animate-spin" /></div>
        ) : isUnit ? (
          <UnitHolderSection accountId={accountId} allPartners={allPartners} onRefresh={loadPartners} />
        ) : (
          <BeneficiarySection accountId={accountId} allPartners={allPartners} onRefresh={loadPartners} />
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
  formError,
}: {
  form: PartnershipFormState;
  setForm: React.Dispatch<React.SetStateAction<PartnershipFormState>>;
  accountId: string;
  ownerName: string;
  ownerEmail: string;
  formError?: string;
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
  const tfnError = formError && formError.toLowerCase().includes("tfn") ? formError : "";
  const abnError = formError && formError.toLowerCase().includes("abn") ? formError : "";

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
          <input
            type="text"
            value={form.abn || ""}
            onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
            maxLength={11}
            placeholder="11 digit ABN"
            className={inputClass}
          />
          {abnError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{abnError}</p>}
        </div>

        {/* TFN — same UI as Individual & Company */}
        <div>
          <label className={labelClass}>TFN <span className="text-red-500">*</span></label>
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
          {tfnError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{tfnError}</p>}
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
      <div className="p-4 rounded-xl border-2 border-[#E91E8C]/30 bg-gradient-to-r from-[#E91E8C]/5 to-transparent dark:from-[#E91E8C]/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#E91E8C]/10 flex items-center justify-center text-[#E91E8C] font-bold text-sm shrink-0">
            {ownerName ? ownerName.charAt(0).toUpperCase() : "Y"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{ownerName || "You"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E91E8C]/10 text-[#E91E8C] font-medium uppercase tracking-wider">Owner</span>
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
              <button onClick={handleAddPartner} disabled={addingPartner} className="px-4 py-2 text-sm rounded-xl bg-[#E91E8C] text-white hover:bg-[#d81b7f] disabled:opacity-50 transition-colors">
                {addingPartner ? "Sending Invitation..." : emailExists?.exists ? "Send Invitation" : "Send Registration Invite"}
              </button>
              <button onClick={() => { setShowAddPartner(false); setPartnerError(""); setEmailExists(null); setNewPartner({ email: "", name: "", role: "", ownershipPercent: "" }); }} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddPartner(true); setPartnerError(""); setPartnerSuccess(""); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors text-sm font-medium"
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
