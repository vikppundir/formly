"use client";

/**
 * Services Marketplace - Users can browse and purchase services for their accounts.
 * Includes inline popup for rental property checklist after purchase.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/contexts/account-context";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
type ServiceStatus = "PENDING" | "CONSENT_REQUIRED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
type ConsentType = "TERMS_OF_SERVICE" | "PRIVACY_POLICY" | "TAX_AGENT_AUTHORITY";

interface Service {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  allowedTypes: AccountType[];
  pricing: Record<AccountType, number>;
  abnPricing: Record<AccountType, number> | null;
  perPropertyFee: number | null;
  gstFee: number | null;
  requiresDocUpload: boolean;
  isAddon: boolean;
  addonNote: string | null;
  isActive: boolean;
  requiresConsent: boolean;
}

interface PriceBreakdown {
  basePrice: number;
  hasAbn: boolean;
  abnBasePrice: number | null;
  effectiveBasePrice: number;
  rentalProperties: number;
  perPropertyFee: number;
  propertyFeeTotal: number;
  subtotal: number;
  gstRegistered: boolean;
  gstFilingFee: number;
  total: number;
}

interface PurchasedService {
  id: string;
  serviceId: string;
  accountId: string;
  status: ServiceStatus;
  paymentStatus: PaymentStatus;
  price: number;
  paymentAmount: number | null;
  taxAmount: number | null;
  propertyFeeTotal: number | null;
  currency: string | null;
  paidAt: string | null;
  transactionId: string | null;
  paymentReceipt: string | null;
  purchasedAt: string;
  financialYear: string | null;
  service: Service;
}

interface PaymentSettings {
  currency: string;
  taxRate: number;
  paymentRequired: boolean;
  taxInclusive: boolean;
  gateway: string;
  paymentMode?: "online" | "invoice" | "both";
  enabled: boolean;
  publishableKey: string | null;
}

interface ConsentCheck {
  hasRequired: boolean;
  missing: ConsentType[];
  accepted: ConsentType[];
}

// --- Checklist types ---
interface RentalProperty {
  id: string;
  address: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  ownershipPercent: number;
}

interface ServiceDocument {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  documentType: string | null;
  createdAt: string;
}

interface ChecklistEntry {
  id: string;
  accountServiceId: string;
  rentalPropertyId: string;
  rentalProperty: RentalProperty;
  weeksRented: number | null;
  dateFirstEarnedRent: string | null;
  rentedByAgent: boolean;
  rentalIncome: number | null;
  interestOnLoans: number | null;
  landTax: number | null;
  insurance: number | null;
  councilRates: number | null;
  bodyCorporate: number | null;
  bankFees: number | null;
  sundryExpenses: number | null;
  waterCharges: number | null;
  repairMaintenance: number | null;
  isComplete: boolean;
  documents: ServiceDocument[];
}

const EXPENSE_FIELDS: { key: string; label: string }[] = [
  { key: "bodyCorporate", label: "Body Corporate" },
  { key: "councilRates", label: "Council Rates" },
  { key: "insurance", label: "Insurance" },
  { key: "interestOnLoans", label: "Interest on Loans" },
  { key: "landTax", label: "Land Tax" },
  { key: "repairMaintenance", label: "Repair & Maintenance" },
  { key: "waterCharges", label: "Water Charges" },
  { key: "sundryExpenses", label: "Sundry Expenses" },
  { key: "bankFees", label: "Bank Fees" },
];

const DOC_TYPES = [
  { value: "agent_statement", label: "Property Agent's Statement" },
  { value: "bank_statement", label: "Bank Statements (Rental Income)" },
  { value: "surveyor_report", label: "Quantity Surveyor's Report" },
  { value: "prior_tax_return", label: "Prior Year Tax Return" },
  { value: "other", label: "Other Document" },
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  UNPAID: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  PENDING: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  PAID: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  FAILED: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  REFUNDED: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" },
  PARTIAL_REFUND: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
};

function isProfileComplete(account: ReturnType<typeof useAccount>["currentAccount"]): { complete: boolean; missingFields: string[] } {
  if (!account) return { complete: false, missingFields: ["No account"] };
  const missingFields: string[] = [];
  if (account.accountType === "INDIVIDUAL") {
    const profile = account.individualProfile;
    const hasAddress = profile?.streetAddress || profile?.address;
    if (!hasAddress) missingFields.push("Address");
    if (!profile?.firstName && !profile?.lastName) missingFields.push("Name");
  } else if (account.accountType === "COMPANY") {
    const profile = account.companyProfile;
    if (!profile?.companyName) missingFields.push("Company Name");
    if (!profile?.abn) missingFields.push("ABN");
  } else if (account.accountType === "TRUST") {
    const profile = account.trustProfile;
    if (!profile?.trustName) missingFields.push("Trust Name");
    if (!profile?.trustType) missingFields.push("Trust Type");
  } else if (account.accountType === "PARTNERSHIP") {
    const profile = account.partnershipProfile;
    if (!profile?.partnershipName) missingFields.push("Partnership Name");
    if (!profile?.abn) missingFields.push("ABN");
  }
  return { complete: missingFields.length === 0, missingFields };
}

export default function ServicesPage() {
  const { currentAccount, loading: accountLoading } = useAccount();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [purchased, setPurchased] = useState<PurchasedService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [consentCheck, setConsentCheck] = useState<ConsentCheck | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [priceBreakdowns, setPriceBreakdowns] = useState<Record<string, PriceBreakdown>>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tab, setTab] = useState<"browse" | "purchased">("browse");

  const [payingAll, setPayingAll] = useState(false);

  // Checklist modal state
  const [checklistPurchaseId, setChecklistPurchaseId] = useState<string | null>(null);

  const profileStatus = currentAccount ? isProfileComplete(currentAccount) : { complete: false, missingFields: [] };

  const unpaidPurchases = purchased.filter((p) => ["UNPAID", "PENDING", "FAILED"].includes(p.paymentStatus) && p.status !== "CANCELLED");
  const unpaidTotal = unpaidPurchases.reduce((sum, p) => sum + Number(p.price), 0);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const purchaseId = searchParams.get("purchase_id");
    const combined = searchParams.get("combined");
    if (sessionId && !verifying) {
      if (combined === "true") {
        verifyCombinedPayment(sessionId);
      } else if (purchaseId) {
        verifyPayment(sessionId, purchaseId);
      }
    }
  }, [searchParams]);

  const verifyPayment = useCallback(async (sessionId: string, purchaseId: string) => {
    setVerifying(true);
    setError("");
    try {
      const result = await apiPost<{ success: boolean; status: string }>("/payments/verify", {
        sessionId,
        purchaseId,
      });
      if (result.success) {
        setSuccess("Payment successful! Your service is now active.");
        setTab("purchased");
        window.history.replaceState({}, "", "/user-dashboard/services");
      } else {
        setError(`Payment verification failed: ${result.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment verification failed");
    } finally {
      setVerifying(false);
      loadServices();
    }
  }, []);

  const verifyCombinedPayment = useCallback(async (sessionId: string) => {
    setVerifying(true);
    setError("");
    try {
      const result = await apiPost<{ success: boolean; status: string; count: number }>("/payments/verify-all", {
        sessionId,
      });
      if (result.success) {
        setSuccess(`Payment successful! ${result.count} service${result.count > 1 ? "s" : ""} activated.`);
        setTab("purchased");
        window.history.replaceState({}, "", "/user-dashboard/services");
      } else {
        setError(`Payment verification failed: ${result.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment verification failed");
    } finally {
      setVerifying(false);
      loadServices();
    }
  }, []);

  useEffect(() => {
    if (currentAccount) {
      loadServices();
    }
  }, [currentAccount]);

  async function loadServices() {
    if (!currentAccount) return;
    setLoading(true);
    try {
      const [servicesRes, purchasedRes, categoriesRes, consentRes, paymentRes] = await Promise.all([
        apiGet<{ services: Service[] }>(`/services/for-account/${currentAccount.id}`),
        apiGet<{ purchases: PurchasedService[] }>(`/services/purchased/${currentAccount.id}`),
        apiGet<{ categories: string[] }>("/services/categories"),
        apiGet<ConsentCheck>(`/consents/check/${currentAccount.id}`),
        apiGet<PaymentSettings>("/payments/settings"),
      ]);
      setServices(servicesRes.services || []);
      setPurchased(purchasedRes.purchases || []);
      setCategories(categoriesRes.categories || []);
      setConsentCheck(consentRes);
      setPaymentSettings(paymentRes);

      const breakdowns: Record<string, PriceBreakdown> = {};
      const svcs = servicesRes.services || [];
      await Promise.all(
        svcs.map(async (svc) => {
          try {
            const bd = await apiGet<PriceBreakdown>(`/services/price-preview/${svc.id}/${currentAccount.id}`);
            breakdowns[svc.id] = bd;
          } catch {}
        })
      );
      setPriceBreakdowns(breakdowns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(serviceId: string) {
    if (!currentAccount) return;
    setPurchasing(serviceId);
    setError("");
    setSuccess("");

    try {
      const mode = paymentSettings?.paymentMode || "online";
      let purchaseMode: "online" | "invoice" = "online";
      if (mode === "invoice") {
        purchaseMode = "invoice";
      } else if (mode === "both") {
        const online = window.confirm("Press OK for Pay Online, Cancel for Pay by Invoice.");
        purchaseMode = online ? "online" : "invoice";
      }

      if (paymentSettings?.paymentRequired && paymentSettings?.enabled) {
        if (purchaseMode === "online") {
          const result = await apiPost<{ checkoutUrl: string; sessionId: string; purchaseId: string }>("/payments/create-checkout", {
            accountId: currentAccount.id,
            serviceId,
            successUrl: `${window.location.origin}/user-dashboard/services`,
            cancelUrl: `${window.location.origin}/user-dashboard/services`,
          });
          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
            return;
          }
        } else {
          const result = await apiPost<{ purchase: PurchasedService }>("/services/purchase", {
            accountId: currentAccount.id,
            serviceId,
          });
          if (result.purchase?.id) {
            await apiPost(`/payments/request-invoice/${result.purchase.id}`, {});
          }
          setSuccess("Invoice request submitted. Our team will process this purchase.");
          await loadServices();
          setTab("purchased");
          return;
        }
      } else {
        const result = await apiPost<{ purchase: PurchasedService }>("/services/purchase", {
          accountId: currentAccount.id,
          serviceId,
        });
        setSuccess("Service purchased successfully!");
        await loadServices();
        setTab("purchased");
        if (result.purchase) {
          setChecklistPurchaseId(result.purchase.id);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to purchase service";
      if (msg.toLowerCase().includes("not available for this account type")) {
        setError("This service is not available for your selected account. Service list has been refreshed.");
        await loadServices();
      } else {
        setError(msg);
      }
    } finally {
      setPurchasing(null);
    }
  }

  async function handlePayAll() {
    if (!currentAccount || unpaidPurchases.length === 0) return;
    setPayingAll(true);
    setError("");
    setSuccess("");
    try {
      if (paymentSettings?.paymentRequired && paymentSettings?.enabled) {
        const result = await apiPost<{ checkoutUrl: string; sessionId: string; purchaseIds: string[] }>("/payments/create-checkout-all", {
          accountId: currentAccount.id,
          purchaseIds: unpaidPurchases.map((p) => p.id),
          successUrl: `${window.location.origin}/user-dashboard/services`,
          cancelUrl: `${window.location.origin}/user-dashboard/services`,
        });
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
      } else {
        setSuccess(`${unpaidPurchases.length} service${unpaidPurchases.length > 1 ? "s" : ""} ready! Configure Stripe to enable payments.`);
      }
      await loadServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process payments");
    } finally {
      setPayingAll(false);
    }
  }

  async function handleCancelUnpaid(purchaseId: string) {
    try {
      await apiDelete(`/payments/cancel/${purchaseId}`);
      setSuccess("Unpaid purchase cancelled.");
      await loadServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel purchase");
    }
  }

  async function handleRetryPayment(purchase: PurchasedService) {
    if (!currentAccount) return;
    setPurchasing(purchase.serviceId);
    setError("");
    try {
      await apiDelete(`/payments/cancel/${purchase.id}`);
      const result = await apiPost<{ checkoutUrl: string; sessionId: string; purchaseId: string }>("/payments/create-checkout", {
        accountId: currentAccount.id,
        serviceId: purchase.serviceId,
        successUrl: `${window.location.origin}/user-dashboard/services`,
        cancelUrl: `${window.location.origin}/user-dashboard/services`,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry payment");
    } finally {
      setPurchasing(null);
    }
  }

  const filteredServices = services.filter((s) => {
    if (!currentAccount || !s.allowedTypes.includes(currentAccount.accountType)) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (purchased?.some((p) => p.serviceId === s.id && !["COMPLETED", "CANCELLED"].includes(p.status))) return false;
    return true;
  });

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#E91E8C]/20 to-[#c4177a]/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-[#E91E8C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Account Selected</h3>
        <p className="text-slate-500 dark:text-white/60 mb-6">Please create or select an account to browse services.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Services</h1>
        <p className="text-slate-500 dark:text-white/60 mt-1">
          Browse and purchase accounting services for{" "}
          <span className="font-medium text-[#E91E8C]">{currentAccount.name}</span>
        </p>
      </div>

      {/* Info hints — non-blocking, purchase is always allowed */}
      {!loading && (!profileStatus.complete || (consentCheck && !consentCheck.hasRequired)) && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {!profileStatus.complete && (
            <Link href={`/user-dashboard/accounts/${currentAccount.id}`} className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Complete your profile for accurate pricing</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 truncate">Missing: {profileStatus.missingFields.join(", ")}</p>
              </div>
            </Link>
          )}
          {consentCheck && !consentCheck.hasRequired && (
            <Link href="/user-dashboard/consents" className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Sign contracts &amp; consents</p>
            </Link>
          )}
        </div>
      )}

      {verifying && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600 dark:text-blue-400">Verifying your payment...</p>
          </div>
        </div>
      )}

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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("browse")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "browse" ? "bg-[#E91E8C] text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20"}`}
        >
          Browse Services
        </button>
        <button
          type="button"
          onClick={() => setTab("purchased")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "purchased" ? "bg-[#E91E8C] text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20"}`}
        >
          My Services ({purchased?.length || 0})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "browse" ? (
        <>
          <div className="mb-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {filteredServices.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <p className="text-slate-500 dark:text-white/60">No services available for your account type.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  accountType={currentAccount.accountType}
                  isPurchasing={purchasing === service.id}
                  priceBreakdown={priceBreakdowns[service.id]}
                  onPurchase={() => handlePurchase(service.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Pay All Unpaid — sticky summary at top of My Services */}
          {unpaidPurchases.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#2E2A5E] to-[#1a1840] text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-lg">{unpaidPurchases.length} unpaid service{unpaidPurchases.length > 1 ? "s" : ""}</p>
                  <div className="space-y-1 mt-2">
                    {unpaidPurchases.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm text-white/80">
                        <span>{p.service.name}</span>
                        <span className="font-medium text-white/90">${Number(p.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/20 flex justify-between text-base font-bold">
                    <span>Total Due</span>
                    <span>${unpaidTotal.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePayAll}
                  disabled={payingAll}
                  className="flex-shrink-0 px-8 py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-semibold hover:shadow-lg hover:shadow-[#E91E8C]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {payingAll ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay All (${unpaidTotal.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!purchased || purchased.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <p className="text-slate-500 dark:text-white/60">You haven&apos;t purchased any services yet.</p>
              <button type="button" onClick={() => setTab("browse")} className="mt-4 text-[#E91E8C] hover:underline">
                Browse available services
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {purchased.map((purchase) => (
                <PurchasedServiceCard
                  key={purchase.id}
                  purchase={purchase}
                  onCancel={handleCancelUnpaid}
                  onRetryPayment={handleRetryPayment}
                  onOpenChecklist={(id) => setChecklistPurchaseId(id)}
                  isPurchasing={purchasing === purchase.serviceId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Checklist Popup Modal */}
      {checklistPurchaseId && (
        <ChecklistModal
          purchaseId={checklistPurchaseId}
          onClose={() => setChecklistPurchaseId(null)}
          onSaved={() => {
            setChecklistPurchaseId(null);
            setTab("purchased");
            loadServices();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// ServiceCard
// ============================================================================
function ServiceCard({
  service,
  accountType,
  isPurchasing,
  priceBreakdown,
  onPurchase,
}: {
  service: Service;
  accountType: AccountType;
  isPurchasing: boolean;
  priceBreakdown?: PriceBreakdown;
  onPurchase: () => void;
}) {
  const bd = priceBreakdown;
  const displayTotal = bd ? bd.total : (service.pricing[accountType] ?? 0);

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 hover:border-[#E91E8C]/30 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{service.name}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {service.category && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">{service.category}</span>
            )}
            {service.isAddon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">Add-on</span>
            )}
            {service.requiresDocUpload && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Doc Upload</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#E91E8C]">${displayTotal.toFixed(2)}</p>
        </div>
      </div>

      {service.addonNote && (
        <p className="text-xs text-orange-600 dark:text-orange-400 mb-2">{service.addonNote}</p>
      )}
      {service.description && <p className="text-sm text-slate-600 dark:text-white/70 mb-3">{service.description}</p>}

      {bd && (bd.rentalProperties > 0 || bd.hasAbn || bd.gstRegistered || bd.propertyFeeTotal > 0 || bd.total !== bd.effectiveBasePrice) && (
        <div className="mb-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-white/70">
            <span>Base fee{bd.hasAbn ? " (incl. ABN)" : ""}</span>
            <span>${bd.effectiveBasePrice.toFixed(2)}</span>
          </div>
          {bd.hasAbn && bd.abnBasePrice && bd.abnBasePrice !== bd.basePrice && (
            <div className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
              Standard: ${bd.basePrice.toFixed(2)} → ABN rate applied
            </div>
          )}
          {bd.rentalProperties > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-white/70">
              <span>Rental properties ({bd.rentalProperties} x ${bd.perPropertyFee})</span>
              <span>${bd.propertyFeeTotal.toFixed(2)}</span>
            </div>
          )}
          {(bd.rentalProperties > 0 || bd.gstRegistered) && (
            <div className="flex justify-between text-slate-500 dark:text-white/50 border-t border-slate-200 dark:border-white/10 pt-1.5">
              <span>Subtotal</span>
              <span>${bd.subtotal.toFixed(2)}</span>
            </div>
          )}
          {bd.gstRegistered && bd.gstFilingFee > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-white/50">
              <span>GST/BAS Filing Fee</span>
              <span>${bd.gstFilingFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-900 dark:text-white border-t border-slate-200 dark:border-white/10 pt-1.5">
            <span>Total</span>
            <span>${bd.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onPurchase}
        disabled={isPurchasing}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:shadow-lg hover:shadow-[#E91E8C]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPurchasing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          "Purchase Service"
        )}
      </button>
    </div>
  );
}

// ============================================================================
// PurchasedServiceCard
// ============================================================================
const STATUS_STEPS: { key: ServiceStatus; label: string }[] = [
  { key: "PENDING", label: "Purchased" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "REVIEW", label: "Under Review" },
  { key: "COMPLETED", label: "Completed" },
];

function getStepIndex(status: ServiceStatus): number {
  if (status === "CANCELLED") return -1;
  if (status === "CONSENT_REQUIRED") return 0;
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function PurchasedServiceCard({
  purchase,
  onCancel,
  onRetryPayment,
  onOpenChecklist,
  isPurchasing,
}: {
  purchase: PurchasedService;
  onCancel: (id: string) => void;
  onRetryPayment: (purchase: PurchasedService) => void;
  onOpenChecklist: (purchaseId: string) => void;
  isPurchasing: boolean;
}) {
  const paymentStyle = PAYMENT_STATUS_COLORS[purchase.paymentStatus] || PAYMENT_STATUS_COLORS.UNPAID;
  const isCancelled = purchase.status === "CANCELLED";
  const currentStep = getStepIndex(purchase.status);

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency || "AUD" }).format(amount);
  };

  const showPaymentActions = ["UNPAID", "PENDING", "FAILED"].includes(purchase.paymentStatus) && !isCancelled;

  return (
    <div className={`rounded-2xl bg-white dark:bg-white/5 border p-6 ${isCancelled ? "border-red-200 dark:border-red-900/30 opacity-70" : "border-slate-200 dark:border-white/10"}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{purchase.service.name}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {purchase.service.category && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">{purchase.service.category}</span>
            )}
            {purchase.financialYear && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">FY {purchase.financialYear}</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${paymentStyle.bg} ${paymentStyle.text}`}>
              {purchase.paymentStatus === "PAID" ? "\u2713 Paid" : purchase.paymentStatus.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <p className="text-xl font-bold text-[#E91E8C]">{formatCurrency(Number(purchase.price), purchase.currency)}</p>
      </div>

      {/* Status Timeline */}
      {!isCancelled ? (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => {
              const isActive = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <div className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${i <= currentStep ? "bg-[#E91E8C]" : "bg-slate-200 dark:bg-white/10"}`} />
                  )}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent ? "bg-[#E91E8C] text-white ring-4 ring-[#E91E8C]/20" :
                    isActive ? "bg-[#E91E8C] text-white" :
                    "bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-white/30"
                  }`}>
                    {isActive && i < currentStep ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <p className={`text-[10px] mt-1 font-medium text-center ${isCurrent ? "text-[#E91E8C]" : isActive ? "text-slate-700 dark:text-white/70" : "text-slate-400 dark:text-white/30"}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">This service has been cancelled.</p>
        </div>
      )}

      {/* Price details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
        {purchase.propertyFeeTotal !== null && Number(purchase.propertyFeeTotal) > 0 && (
          <div>
            <p className="text-slate-500 dark:text-white/60 text-xs">Property Fees</p>
            <p className="text-slate-700 dark:text-white/80 font-medium">{formatCurrency(Number(purchase.propertyFeeTotal), purchase.currency)}</p>
          </div>
        )}
        {purchase.taxAmount !== null && Number(purchase.taxAmount) > 0 && (
          <div>
            <p className="text-slate-500 dark:text-white/60 text-xs">GST Filing Fee</p>
            <p className="text-slate-700 dark:text-white/80 font-medium">{formatCurrency(Number(purchase.taxAmount), purchase.currency)}</p>
          </div>
        )}
        {purchase.paidAt && (
          <div>
            <p className="text-slate-500 dark:text-white/60 text-xs">Paid On</p>
            <p className="text-slate-700 dark:text-white/80 font-medium">{new Date(purchase.paidAt).toLocaleDateString()}</p>
          </div>
        )}
        <div>
          <p className="text-slate-500 dark:text-white/60 text-xs">Purchased</p>
          <p className="text-slate-700 dark:text-white/80 font-medium">{new Date(purchase.purchasedAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        {purchase.service.code === "individual_tax_return" && !isCancelled && (
          <button
            type="button"
            onClick={() => onOpenChecklist(purchase.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E91E8C] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Rental Checklist
          </button>
        )}

        {purchase.service.requiresDocUpload && !isCancelled && (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Doc upload required
          </span>
        )}

        {purchase.paymentReceipt && (
          <a href={purchase.paymentReceipt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#E91E8C] hover:underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Receipt
          </a>
        )}

        {purchase.transactionId && (
          <span className="text-xs text-slate-400 dark:text-white/40 font-mono">Ref: {purchase.transactionId.slice(0, 16)}...</span>
        )}
      </div>

      {purchase.status === "CONSENT_REQUIRED" && (
        <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm text-amber-700 dark:text-amber-400">Please complete the required legal consent to activate this service.</p>
          <Link href="/user-dashboard/consents" className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline">
            Sign Consents
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      )}

      {showPaymentActions && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onRetryPayment(purchase)}
            disabled={isPurchasing}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPurchasing ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {purchase.paymentStatus === "FAILED" ? "Retry Payment" : "Pay Now"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onCancel(purchase.id)}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ChecklistModal - Full-screen overlay with rental property checklist
// ============================================================================
function ChecklistModal({ purchaseId, onClose, onSaved }: { purchaseId: string; onClose: () => void; onSaved: () => void }) {
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const res = await apiGet<{ entries: ChecklistEntry[] }>(`/services/purchases/${purchaseId}/checklists`);
      setEntries(res.entries || []);
      if (res.entries?.length > 0 && !expandedEntry) {
        setExpandedEntry(res.entries[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
    }
  }, [purchaseId, expandedEntry]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await apiPost(`/services/purchases/${purchaseId}/checklists`, {});
        await loadEntries();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize checklists");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [purchaseId]);

  async function saveEntry(entryId: string, data: Record<string, unknown>) {
    setSaving(entryId);
    setError("");
    try {
      await apiPatch(`/services/purchases/${purchaseId}/checklists/${entryId}`, data);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function uploadDocument(entryId: string, file: File, documentType: string) {
    setUploading(entryId);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${BASE_URL}/services/purchases/${purchaseId}/checklists/${entryId}/documents?documentType=${documentType}`,
        { method: "POST", body: formData, credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      setSuccess("Document uploaded");
      await loadEntries();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function deleteDocument(docId: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await apiDelete(`/services/documents/${docId}`);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rental Property Checklist</h2>
            <p className="text-xs text-slate-500 dark:text-white/50">Complete details for each property and upload documents</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-slate-500 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-600 dark:text-green-400">{success}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-10 h-10 border-4 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-white/60">No rental properties found. Add properties in your account profile first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <ChecklistPropertyCard
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntry === entry.id}
                  onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  isSaving={saving === entry.id}
                  isUploading={uploading === entry.id}
                  onSave={(data) => saveEntry(entry.id, data)}
                  onUpload={(file, type) => uploadDocument(entry.id, file, type)}
                  onDeleteDoc={deleteDocument}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ChecklistPropertyCard - Single property inside the modal
// ============================================================================
function ChecklistPropertyCard({
  entry,
  isExpanded,
  onToggle,
  isSaving,
  isUploading,
  onSave,
  onUpload,
  onDeleteDoc,
}: {
  entry: ChecklistEntry;
  isExpanded: boolean;
  onToggle: () => void;
  isSaving: boolean;
  isUploading: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onUpload: (file: File, documentType: string) => void;
  onDeleteDoc: (docId: string) => void;
}) {
  const prop = entry.rentalProperty;
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [docType, setDocType] = useState("other");

  useEffect(() => {
    const initial: Record<string, unknown> = {};
    initial.weeksRented = entry.weeksRented ?? "";
    initial.dateFirstEarnedRent = entry.dateFirstEarnedRent
      ? new Date(entry.dateFirstEarnedRent).toISOString().split("T")[0]
      : "";
    initial.rentedByAgent = entry.rentedByAgent ?? false;
    initial.rentalIncome = entry.rentalIncome ?? "";
    initial.isComplete = entry.isComplete;
    for (const ef of EXPENSE_FIELDS) {
      initial[ef.key] = (entry as unknown as Record<string, unknown>)[ef.key] ?? "";
    }
    setForm(initial);
  }, [entry]);

  function updateField(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const data: Record<string, unknown> = {};
    data.weeksRented = form.weeksRented !== "" ? Number(form.weeksRented) : null;
    data.dateFirstEarnedRent = form.dateFirstEarnedRent || null;
    data.rentedByAgent = Boolean(form.rentedByAgent);
    data.rentalIncome = form.rentalIncome !== "" ? Number(form.rentalIncome) : null;
    data.isComplete = form.isComplete;
    for (const ef of EXPENSE_FIELDS) {
      data[ef.key] = form[ef.key] !== "" ? Number(form[ef.key]) : null;
    }
    onSave(data);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, docType);
      e.target.value = "";
    }
  }

  const propertyLabel = [prop.address, prop.suburb, prop.state, prop.postcode].filter(Boolean).join(", ");
  const isRentedByAgent = Boolean(form.rentedByAgent);

  return (
    <div className="rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${entry.isComplete ? "bg-green-100 dark:bg-green-900/30" : "bg-slate-100 dark:bg-white/10"}`}>
            {entry.isComplete ? (
              <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{propertyLabel}</p>
            <p className="text-xs text-slate-500 dark:text-white/50">
              Ownership: {Number(prop.ownershipPercent)}% | Docs: {entry.documents.length}
            </p>
          </div>
        </div>
        <svg className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-white/10 p-4 space-y-5">
          {/* Property Info */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">Property Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Weeks Rented This Year</label>
                <input type="number" min="0" max="52" value={String(form.weeksRented ?? "")} onChange={(e) => updateField("weeksRented", e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Date First Earned Rent</label>
                <input type="date" value={String(form.dateFirstEarnedRent || "")} onChange={(e) => updateField("dateFirstEarnedRent", e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          {/* Income with Rented by Agent */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">Income</h4>
            <div className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={isRentedByAgent} onChange={(e) => updateField("rentedByAgent", e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Rented through a Property Agent</span>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    {isRentedByAgent ? "Please upload the Property Agent's Statement below." : "Provide bank statements for rental income if self-managed."}
                  </p>
                </div>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Rental Income ($)</label>
              <input type="number" min="0" step="0.01" value={String(form.rentalIncome ?? "")} onChange={(e) => updateField("rentalIncome", e.target.value)} className="w-full sm:w-1/2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white" />
            </div>
          </div>

          {/* Expenses */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">Expenses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXPENSE_FIELDS.map((ef) => (
                <div key={ef.key}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">{ef.label} ($)</label>
                  <input type="number" min="0" step="0.01" value={String(form[ef.key] ?? "")} onChange={(e) => updateField(ef.key, e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white" />
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">Documents</h4>
            <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Required Documents:</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                {isRentedByAgent ? (
                  <li>Property Agent&apos;s Statement</li>
                ) : (
                  <li>Bank Statements for Rental Income</li>
                )}
                <li>Quantity Surveyor&apos;s Report (for depreciation)</li>
                <li>Prior Year Tax Return (if lodged by another accountant)</li>
              </ul>
            </div>

            {entry.documents.length > 0 && (
              <div className="space-y-2 mb-3">
                {entry.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-white/80 truncate">{doc.originalName}</p>
                        <p className="text-xs text-slate-400">{DOC_TYPES.find((d) => d.value === doc.documentType)?.label || doc.documentType} | {(doc.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => onDeleteDoc(doc.id)} className="text-red-500 hover:text-red-700 flex-shrink-0 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white">
                  {DOC_TYPES.map((dt) => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
              </div>
              <label className="relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                {isUploading ? (
                  <><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />Uploading...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload File</>
                )}
                <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.txt" />
              </label>
            </div>
          </div>

          {/* Save */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.isComplete)} onChange={(e) => updateField("isComplete", e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-green-600" />
              <span className="text-sm text-slate-700 dark:text-white/70">Mark as complete</span>
            </label>
            <button type="button" onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:shadow-lg hover:shadow-[#E91E8C]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>) : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
