"use client";

/**
 * Account management (admin): view all accounts, update status.
 * Shows legal consents with signatures and PDF download.
 * Requires manage_users permission.
 */

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState, useRef } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
type AccountStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
type ConsentType = "TERMS_OF_SERVICE" | "PRIVACY_POLICY" | "POWER_OF_ATTORNEY" | "TAX_AGENT_AUTHORITY" | "ENGAGEMENT_LETTER" | "DATA_PROCESSING";

interface LegalConsent {
  id: string;
  accountId: string;
  userId: string;
  consentType: ConsentType;
  documentVersion: string | null;
  signatureData: string | null;
  signatureType: string | null;
  signedName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  acceptedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

const CONSENT_LABELS: Record<ConsentType, string> = {
  TERMS_OF_SERVICE: "Terms of Service",
  PRIVACY_POLICY: "Privacy Policy",
  POWER_OF_ATTORNEY: "Power of Attorney",
  TAX_AGENT_AUTHORITY: "Tax Agent Authority",
  ENGAGEMENT_LETTER: "Engagement Letter",
  DATA_PROCESSING: "Data Processing Agreement",
};

interface IndividualProfile {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  tfn?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  occupation?: string;
  employerName?: string;
}

interface CompanyProfile {
  id: string;
  companyName?: string;
  tradingName?: string;
  abn?: string;
  acn?: string;
  businessAddress?: string;
  registeredAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  industry?: string;
  financialYearEnd?: string;
  gstRegistered?: boolean;
}

interface TrustProfile {
  id: string;
  trustName?: string;
  trustType?: string;
  tfn?: string;
  abn?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  trusteeDetails?: string;
  beneficiaries?: string;
}

interface PartnershipProfile {
  id: string;
  partnershipName?: string;
  tradingName?: string;
  abn?: string;
  tfn?: string;
  businessAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  industry?: string;
  partners?: string;
}

interface Account {
  id: string;
  userId: string;
  accountType: AccountType;
  name: string;
  status: AccountStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    phoneVerified?: boolean;
    status?: string;
    createdAt?: string;
  };
  individualProfile?: IndividualProfile;
  companyProfile?: CompanyProfile;
  trustProfile?: TrustProfile;
  partnershipProfile?: PartnershipProfile;
  _count?: {
    accountServices: number;
    legalConsents: number;
    companyPartners: number;
  };
}

interface AccountStats {
  total: number;
  byType: Record<AccountType, number>;
  byStatus: Record<AccountStatus, number>;
}

const STATUS_COLORS: Record<AccountStatus, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  PENDING: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  SUSPENDED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  CLOSED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const TYPE_COLORS: Record<AccountType, string> = {
  INDIVIDUAL: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  COMPANY: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  TRUST: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  PARTNERSHIP: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
};

export default function AccountsPage() {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState<AccountStatus>("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [consents, setConsents] = useState<LegalConsent[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "consents">("info");

  const canManage = hasPermission("manage_users");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "100",
        ...(typeFilter && { accountType: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      });
      const [accountsRes, statsRes] = await Promise.all([
        apiGet<{ accounts: Account[] }>(`/admin/accounts?${params}`),
        apiGet<{ stats: AccountStats }>("/admin/accounts/stats"),
      ]);
      setAccounts(accountsRes.accounts);
      setStats(statsRes.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) load();
  }, [canManage, typeFilter, statusFilter, searchQuery]);

  function openStatusModal(account: Account) {
    setSelectedAccount(account);
    setNewStatus(account.status);
    setStatusModal(true);
    setError("");
  }

  async function openDetailModal(account: Account) {
    setSelectedAccount(account);
    setDetailModal(true);
    setActiveTab("info");
    setConsents([]);
    
    // Load consents for this account
    setLoadingConsents(true);
    try {
      const res = await apiGet<{ consents: LegalConsent[] }>(`/admin/consents/account/${account.id}`);
      setConsents(res.consents || []);
    } catch (e) {
      console.error("Failed to load consents:", e);
    } finally {
      setLoadingConsents(false);
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function parseJsonField(jsonStr?: string): unknown[] {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  }

  async function handleStatusUpdate() {
    if (!selectedAccount) return;
    setSubmitting(true);
    setError("");
    try {
      await apiPatch(`/admin/accounts/${selectedAccount.id}/status`, { status: newStatus });
      setStatusModal(false);
      setSelectedAccount(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  }

  // Generate Tax Agent Authority PDF
  function generateTaxAgentAuthorityPDF(consent: LegalConsent, account: Account) {
    const profile = account.individualProfile || account.companyProfile || account.trustProfile || account.partnershipProfile;
    const clientName = account.individualProfile 
      ? `${account.individualProfile.firstName || ""} ${account.individualProfile.middleName || ""} ${account.individualProfile.lastName || ""}`.trim()
      : account.companyProfile?.companyName 
      || account.trustProfile?.trustName 
      || account.partnershipProfile?.partnershipName 
      || account.name;
    
    const tfn = (profile as { tfn?: string })?.tfn || "Not provided";
    const abn = (profile as { abn?: string })?.abn || "Not provided";
    const address = account.individualProfile?.address 
      || (account.companyProfile?.businessAddress)
      || (account.trustProfile?.address)
      || (account.partnershipProfile?.businessAddress)
      || "Not provided";
    const suburb = (profile as { suburb?: string })?.suburb || "";
    const state = (profile as { state?: string })?.state || "";
    const postcode = (profile as { postcode?: string })?.postcode || "";
    const fullAddress = [address, suburb, state, postcode].filter(Boolean).join(", ");

    // Create printable HTML content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Agent Authority - ${clientName}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
          .header h1 { color: #1e40af; margin: 0 0 5px 0; font-size: 24pt; }
          .header h2 { color: #374151; margin: 0; font-size: 14pt; font-weight: normal; }
          .ato-ref { background: #f3f4f6; padding: 10px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .section { margin: 25px 0; }
          .section-title { font-size: 12pt; font-weight: bold; color: #1e40af; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .field-row { display: flex; margin: 8px 0; }
          .field-label { width: 180px; font-weight: bold; color: #4b5563; }
          .field-value { flex: 1; color: #111827; }
          .authority-text { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; }
          .authority-text p { margin: 10px 0; }
          .signature-section { margin-top: 40px; page-break-inside: avoid; }
          .signature-box { border: 2px solid #1e40af; padding: 20px; border-radius: 8px; background: #f8fafc; }
          .signature-image { max-width: 300px; max-height: 100px; margin: 15px 0; }
          .signature-typed { font-family: 'Brush Script MT', cursive; font-size: 28pt; color: #1e3a8a; margin: 15px 0; }
          .signature-details { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
          .signature-detail { text-align: center; }
          .signature-detail-label { font-size: 9pt; color: #6b7280; }
          .signature-detail-value { font-weight: bold; color: #111827; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1e40af; text-align: center; font-size: 9pt; color: #6b7280; }
          .official-notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 10pt; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TAX AGENT AUTHORITY</h1>
          <h2>Authorisation to Act as Registered Tax Agent</h2>
        </div>

        <div class="ato-ref">
          <strong>Australian Taxation Office Reference Form</strong><br>
          In accordance with the Tax Agent Services Act 2009
        </div>

        <div class="section">
          <div class="section-title">Client Details</div>
          <div class="field-row">
            <span class="field-label">Client Name:</span>
            <span class="field-value">${clientName}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Tax File Number (TFN):</span>
            <span class="field-value">${tfn}</span>
          </div>
          <div class="field-row">
            <span class="field-label">ABN:</span>
            <span class="field-value">${abn}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Address:</span>
            <span class="field-value">${fullAddress}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Account Type:</span>
            <span class="field-value">${account.accountType}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Tax Agent Details</div>
          <div class="field-row">
            <span class="field-label">Tax Agent Name:</span>
            <span class="field-value">Formly Pty Ltd</span>
          </div>
          <div class="field-row">
            <span class="field-label">Tax Agent Number:</span>
            <span class="field-value">[Registered Tax Agent Number]</span>
          </div>
          <div class="field-row">
            <span class="field-label">ABN:</span>
            <span class="field-value">[Tax Agent ABN]</span>
          </div>
        </div>

        <div class="authority-text">
          <p><strong>AUTHORITY:</strong></p>
          <p>I, <strong>${clientName}</strong>, hereby authorise Formly Pty Ltd to:</p>
          <ul>
            <li>Act as my registered tax agent with the Australian Taxation Office (ATO)</li>
            <li>Lodge tax returns and other documents on my behalf</li>
            <li>Receive and respond to correspondence from the ATO</li>
            <li>Access my ATO records and tax information</li>
            <li>Make enquiries and represent me in dealings with the ATO</li>
            <li>Negotiate and settle any tax matters on my behalf</li>
          </ul>
          <p>This authority remains in effect until revoked in writing.</p>
        </div>

        <div class="official-notice">
          <strong>Important:</strong> This document authorises the tax agent to act on your behalf with the Australian Taxation Office. 
          Keep a copy for your records. This authority can be revoked at any time by written notice.
        </div>

        <div class="signature-section">
          <div class="section-title">Client Signature & Declaration</div>
          <div class="signature-box">
            <p>I declare that the information provided is true and correct, and I authorise Formly to act as my tax agent.</p>
            
            ${consent.signatureType === "draw" && consent.signatureData 
              ? `<img src="${consent.signatureData}" alt="Signature" class="signature-image" />`
              : consent.signedName 
              ? `<div class="signature-typed">${consent.signedName}</div>`
              : '<div style="height: 60px; border-bottom: 1px solid #000; margin: 20px 0;"></div>'
            }
            
            <div class="signature-details">
              <div class="signature-detail">
                <div class="signature-detail-label">Signed By</div>
                <div class="signature-detail-value">${consent.user?.name || clientName}</div>
              </div>
              <div class="signature-detail">
                <div class="signature-detail-label">Date Signed</div>
                <div class="signature-detail-value">${new Date(consent.acceptedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
              <div class="signature-detail">
                <div class="signature-detail-label">IP Address</div>
                <div class="signature-detail-value">${consent.ipAddress || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Document ID: ${consent.id}</p>
          <p>Generated on ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })} at ${new Date().toLocaleTimeString()}</p>
          <p>This document was digitally signed and is legally binding.</p>
        </div>
      </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Accounts</h1>
        <p className="text-zinc-500 mt-2">You do not have permission to manage accounts.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Accounts
        </h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Individual</p>
            <p className="text-2xl font-semibold text-blue-600">{stats.byType?.INDIVIDUAL || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Company</p>
            <p className="text-2xl font-semibold text-purple-600">{stats.byType?.COMPANY || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Trust</p>
            <p className="text-2xl font-semibold text-emerald-600">{stats.byType?.TRUST || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Partnership</p>
            <p className="text-2xl font-semibold text-orange-600">{stats.byType?.PARTNERSHIP || 0}</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearchQuery(searchInput.trim());
            }}
            placeholder="Search by TFN, mobile, account name, owner, ABN..."
            className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchQuery(searchInput.trim())}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | "")}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300"
          >
            <option value="">All Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
            <option value="TRUST">Trust</option>
            <option value="PARTNERSHIP">Partnership</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "")}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Active search indicator */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
          <span>Results for:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium">
            &ldquo;{searchQuery}&rdquo;
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearchQuery(""); }}
              className="ml-1 hover:text-indigo-900 dark:hover:text-indigo-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    TFN
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Type
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Created
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  // Extract TFN from the relevant profile
                  const tfn = a.individualProfile?.tfn
                    || a.trustProfile?.tfn
                    || a.partnershipProfile?.tfn
                    || null;

                  return (
                    <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {a.name}
                            {a.isDefault && (
                              <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                                (default)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {a.id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.user && (
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.user.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {a.user.email}
                            </p>
                            {a.user.phone && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {a.user.phone}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tfn ? (
                          <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{tfn}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[a.accountType]}`}
                        >
                          {a.accountType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[a.status]}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailModal(a)}
                            className="text-blue-600 dark:text-blue-400 text-sm min-h-[36px] px-2 hover:underline"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openStatusModal(a)}
                            className="text-indigo-600 dark:text-indigo-400 text-sm min-h-[36px] px-2 hover:underline"
                          >
                            Status
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      {searchQuery ? `No accounts found for "${searchQuery}"` : "No accounts found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-sm text-slate-500">Showing {accounts.length} accounts</p>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md sm:mx-auto p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Update Account Status
            </h2>
            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Account: <span className="font-medium">{selectedAccount.name}</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Type: <span className="font-medium">{selectedAccount.accountType}</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Current Status:{" "}
                <span
                  className={`font-medium px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selectedAccount.status]}`}
                >
                  {selectedAccount.status}
                </span>
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as AccountStatus)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setStatusModal(false);
                  setSelectedAccount(null);
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={submitting || newStatus === selectedAccount.status}
                className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Detail Modal */}
      {detailModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl max-w-3xl sm:mx-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAccount.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[selectedAccount.accountType]}`}>
                      {selectedAccount.accountType}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedAccount.status]}`}>
                      {selectedAccount.status}
                    </span>
                    {selectedAccount.isDefault && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400">(Default)</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal(false);
                    setSelectedAccount(null);
                  }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("info")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "info"
                      ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Account Information
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("consents")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "consents"
                      ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Legal Consents
                  {consents.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                      {consents.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Legal Consents Tab */}
              {activeTab === "consents" && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Legal Consents & Signatures
                  </h3>
                  
                  {loadingConsents ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : consents.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                      <p className="text-slate-500 dark:text-slate-400">No consents signed yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {consents.map((consent) => (
                        <div 
                          key={consent.id} 
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                        >
                          {/* Consent Header */}
                          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                                    {CONSENT_LABELS[consent.consentType] || consent.consentType}
                                  </h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Signed on {new Date(consent.acceptedAt).toLocaleDateString("en-AU", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                              {consent.consentType === "TAX_AGENT_AUTHORITY" && (
                                <button
                                  type="button"
                                  onClick={() => generateTaxAgentAuthorityPDF(consent, selectedAccount)}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Download PDF
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Consent Details */}
                          <div className="p-4 space-y-4">
                            {/* Signature Display */}
                            {(consent.signatureData || consent.signedName) && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Signature</p>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
                                  {consent.signatureType === "draw" && consent.signatureData ? (
                                    <img 
                                      src={consent.signatureData} 
                                      alt="Signature" 
                                      className="max-h-24 mx-auto"
                                    />
                                  ) : consent.signedName ? (
                                    <p 
                                      className="text-2xl text-slate-900 dark:text-slate-100 text-center italic"
                                      style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
                                    >
                                      {consent.signedName}
                                    </p>
                                  ) : (
                                    <p className="text-slate-400 text-center">No signature image available</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Audit Information */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Signed By</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {consent.user?.name || "Unknown"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                                <p className="text-slate-700 dark:text-slate-300 truncate">
                                  {consent.user?.email || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">IP Address</p>
                                <p className="font-mono text-slate-700 dark:text-slate-300">
                                  {consent.ipAddress || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Document Version</p>
                                <p className="text-slate-700 dark:text-slate-300">
                                  {consent.documentVersion || "1.0"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Account Info Tab */}
              {activeTab === "info" && (
              <>
              {/* Account Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Account Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Account ID</p>
                    <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Created</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedAccount.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Last Updated</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedAccount.updatedAt)}</p>
                  </div>
                  {selectedAccount._count && (
                    <>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Services Purchased</p>
                        <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount._count.accountServices}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Legal Consents</p>
                        <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount._count.legalConsents}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Company Partners</p>
                        <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount._count.companyPartners}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* User/Owner Info */}
              {selectedAccount.user && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Owner Information
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">User ID</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.user.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Name</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedAccount.user.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.user.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {selectedAccount.user.phone || "—"}
                        {selectedAccount.user.phone && (
                          <span className={`ml-2 text-xs ${selectedAccount.user.phoneVerified ? 'text-green-600' : 'text-amber-600'}`}>
                            {selectedAccount.user.phoneVerified ? '✓ Verified' : 'Not verified'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">User Status</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.user.status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Registered</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedAccount.user.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Profile */}
              {selectedAccount.accountType === "INDIVIDUAL" && selectedAccount.individualProfile && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Individual Profile
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">First Name</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.firstName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Middle Name</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.middleName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Last Name</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.lastName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Date of Birth</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedAccount.individualProfile.dateOfBirth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">TFN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.tfn || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Occupation</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.occupation || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Employer</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.employerName || "—"}</p>
                    </div>
                    <div className="sm:col-span-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Suburb</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.suburb || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">State</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.state || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Postcode</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.postcode || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Country</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.individualProfile.country || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Company Profile */}
              {selectedAccount.accountType === "COMPANY" && selectedAccount.companyProfile && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Company Profile
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Company Name</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.companyName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Trading Name</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.tradingName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ABN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.abn || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ACN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.acn || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Business Address</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.businessAddress || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Registered Address</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.registeredAddress || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Suburb</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.suburb || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">State</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.state || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Postcode</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.postcode || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Industry</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.industry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Financial Year End</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.companyProfile.financialYearEnd || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">GST Registered</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {selectedAccount.companyProfile.gstRegistered === true ? "Yes" : selectedAccount.companyProfile.gstRegistered === false ? "No" : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trust Profile */}
              {selectedAccount.accountType === "TRUST" && selectedAccount.trustProfile && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Trust Profile
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Trust Name</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.trustName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Trust Type</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.trustType || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">TFN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.tfn || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ABN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.abn || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Suburb</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.suburb || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">State</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.state || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Postcode</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.trustProfile.postcode || "—"}</p>
                    </div>
                    {selectedAccount.trustProfile.trusteeDetails && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Trustee Details</p>
                        <div className="space-y-2">
                          {parseJsonField(selectedAccount.trustProfile.trusteeDetails).map((t: unknown, i: number) => {
                            const trustee = t as { name?: string; type?: string };
                            return (
                              <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-2 text-sm">
                                <span className="font-medium">{trustee.name}</span>
                                {trustee.type && <span className="text-slate-500 ml-2">({trustee.type})</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedAccount.trustProfile.beneficiaries && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Beneficiaries</p>
                        <div className="space-y-2">
                          {parseJsonField(selectedAccount.trustProfile.beneficiaries).map((b: unknown, i: number) => {
                            const beneficiary = b as { name?: string; allocation?: number };
                            return (
                              <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-2 text-sm">
                                <span className="font-medium">{beneficiary.name}</span>
                                {beneficiary.allocation !== undefined && (
                                  <span className="text-slate-500 ml-2">({beneficiary.allocation}%)</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Partnership Profile */}
              {selectedAccount.accountType === "PARTNERSHIP" && selectedAccount.partnershipProfile && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Partnership Profile
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Partnership Name</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.partnershipName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Trading Name</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.tradingName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ABN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.abn || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">TFN</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.tfn || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Business Address</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.businessAddress || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Suburb</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.suburb || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">State</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.state || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Postcode</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.postcode || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Industry</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{selectedAccount.partnershipProfile.industry || "—"}</p>
                    </div>
                    {selectedAccount.partnershipProfile.partners && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Partners</p>
                        <div className="space-y-2">
                          {parseJsonField(selectedAccount.partnershipProfile.partners).map((p: unknown, i: number) => {
                            const partner = p as { name?: string; email?: string; ownership?: number };
                            return (
                              <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-2 text-sm">
                                <span className="font-medium">{partner.name}</span>
                                {partner.email && <span className="text-slate-500 ml-2">{partner.email}</span>}
                                {partner.ownership !== undefined && (
                                  <span className="text-indigo-600 dark:text-indigo-400 ml-2">({partner.ownership}%)</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Profile Data */}
              {selectedAccount.accountType === "INDIVIDUAL" && !selectedAccount.individualProfile && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No individual profile data available
                </div>
              )}
              {selectedAccount.accountType === "COMPANY" && !selectedAccount.companyProfile && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No company profile data available
                </div>
              )}
              {selectedAccount.accountType === "TRUST" && !selectedAccount.trustProfile && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No trust profile data available
                </div>
              )}
              {selectedAccount.accountType === "PARTNERSHIP" && !selectedAccount.partnershipProfile && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No partnership profile data available
                </div>
              )}
              </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 sm:p-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDetailModal(false);
                  openStatusModal(selectedAccount);
                }}
                className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700"
              >
                Update Status
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailModal(false);
                  setSelectedAccount(null);
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
