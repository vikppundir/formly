"use client";

/**
 * Services Marketplace - Users can browse and purchase services for their accounts.
 * Services are filtered based on the current account type.
 * Requires profile completion and consent signing before purchase.
 * Integrates with Stripe for payment processing.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/contexts/account-context";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

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
  isActive: boolean;
  requiresConsent: boolean;
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
  enabled: boolean;
  publishableKey: string | null;
}

interface ConsentCheck {
  hasRequired: boolean;
  missing: ConsentType[];
  accepted: ConsentType[];
}

const STATUS_COLORS: Record<ServiceStatus, { bg: string; text: string }> = {
  PENDING: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  CONSENT_REQUIRED: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  IN_PROGRESS: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  REVIEW: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" },
  COMPLETED: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  CANCELLED: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  UNPAID: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  PENDING: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  PAID: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  FAILED: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  REFUNDED: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" },
  PARTIAL_REFUND: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
};

// Check profile completeness
function isProfileComplete(account: ReturnType<typeof useAccount>["currentAccount"]): { complete: boolean; missingFields: string[] } {
  if (!account) return { complete: false, missingFields: ["No account"] };
  
  const missingFields: string[] = [];
  
  if (account.accountType === "INDIVIDUAL") {
    const profile = account.individualProfile;
    // Check both field names - DB uses 'address', form uses 'streetAddress'
    const hasAddress = profile?.streetAddress || profile?.address;
    if (!hasAddress) missingFields.push("Address");
    // Name check (first or last name)
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
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tab, setTab] = useState<"browse" | "purchased">("browse");

  const profileStatus = currentAccount ? isProfileComplete(currentAccount) : { complete: false, missingFields: [] };
  const canPurchase = profileStatus.complete && consentCheck?.hasRequired;

  // Handle Stripe checkout return
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const purchaseId = searchParams.get("purchase_id");
    
    if (sessionId && purchaseId && !verifying) {
      verifyPayment(sessionId, purchaseId);
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
        // Clear URL params
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
      // Check if payment is required and enabled
      if (paymentSettings?.paymentRequired && paymentSettings?.enabled) {
        // Create Stripe checkout session
        const result = await apiPost<{ checkoutUrl: string; sessionId: string; purchaseId: string }>("/payments/create-checkout", {
          accountId: currentAccount.id,
          serviceId,
          successUrl: `${window.location.origin}/user-dashboard/services`,
          cancelUrl: `${window.location.origin}/user-dashboard/services`,
        });
        
        // Redirect to Stripe checkout
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
      } else {
        // Direct purchase without payment
        await apiPost("/services/purchase", {
          accountId: currentAccount.id,
          serviceId,
        });
        setSuccess("Service purchased successfully!");
        await loadServices();
        setTab("purchased");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to purchase service");
    } finally {
      setPurchasing(null);
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
      // Delete the old unpaid record first
      await apiDelete(`/payments/cancel/${purchase.id}`);
      
      // Create a new checkout session
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
    if (categoryFilter && s.category !== categoryFilter) return false;
    // Filter out already purchased services
    if (purchased?.some((p) => p.serviceId === s.id && !["COMPLETED", "CANCELLED"].includes(p.status))) {
      return false;
    }
    return true;
  });

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#0891b2]/20 to-[#0e7490]/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Account Selected</h3>
        <p className="text-slate-500 dark:text-white/60 mb-6">
          Please create or select an account to browse services.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Services</h1>
        <p className="text-slate-500 dark:text-white/60 mt-1">
          Browse and purchase accounting services for{" "}
          <span className="font-medium text-[#0891b2]">{currentAccount.name}</span>
        </p>
      </div>

      {/* Profile Incomplete Warning */}
      {!loading && !profileStatus.complete && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">Complete Your Profile First</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Missing fields: {profileStatus.missingFields.join(", ")}
              </p>
              <Link
                href={`/user-dashboard/accounts/${currentAccount.id}`}
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
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

      {/* Consent Required Warning */}
      {!loading && profileStatus.complete && consentCheck && !consentCheck.hasRequired && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-blue-800 dark:text-blue-300">Sign Required Contracts</p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Please sign the required consents before purchasing services.
              </p>
              <Link
                href="/user-dashboard/consents"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
              >
                Sign Contracts
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verifying */}
      {verifying && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600 dark:text-blue-400">Verifying your payment...</p>
          </div>
        </div>
      )}
      
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("browse")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "browse"
              ? "bg-[#0891b2] text-white"
              : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20"
          }`}
        >
          Browse Services
        </button>
        <button
          type="button"
          onClick={() => setTab("purchased")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "purchased"
              ? "bg-[#0891b2] text-white"
              : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20"
          }`}
        >
          My Services ({purchased?.length || 0})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "browse" ? (
        <>
          {/* Category Filter */}
          <div className="mb-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredServices.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <p className="text-slate-500 dark:text-white/60">
                No services available for your account type.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  accountType={currentAccount.accountType}
                  isPurchasing={purchasing === service.id}
                  canPurchase={canPurchase || false}
                  paymentRequired={paymentSettings?.paymentRequired && paymentSettings?.enabled || false}
                  onPurchase={() => handlePurchase(service.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {!purchased || purchased.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <p className="text-slate-500 dark:text-white/60">
                You haven&apos;t purchased any services yet.
              </p>
              <button
                type="button"
                onClick={() => setTab("browse")}
                className="mt-4 text-[#0891b2] hover:underline"
              >
                Browse available services
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {purchased.map((purchase) => (
                <PurchasedServiceCard
                  key={purchase.id}
                  purchase={purchase}
                  onCancel={handleCancelUnpaid}
                  onRetryPayment={handleRetryPayment}
                  isPurchasing={purchasing === purchase.serviceId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  accountType,
  isPurchasing,
  canPurchase,
  paymentRequired,
  onPurchase,
}: {
  service: Service;
  accountType: AccountType;
  isPurchasing: boolean;
  canPurchase: boolean;
  paymentRequired: boolean;
  onPurchase: () => void;
}) {
  const price = service.pricing[accountType] ?? 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 hover:border-[#0891b2]/30 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{service.name}</h3>
          {service.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">
              {service.category}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#0891b2]">${price.toFixed(2)}</p>
          {service.requiresConsent && (
            <p className="text-xs text-slate-500 dark:text-white/50">Requires consent</p>
          )}
        </div>
      </div>
      {service.description && (
        <p className="text-sm text-slate-600 dark:text-white/70 mb-4">{service.description}</p>
      )}
      <button
        type="button"
        onClick={onPurchase}
        disabled={isPurchasing || !canPurchase}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPurchasing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : !canPurchase ? (
          "Complete Requirements"
        ) : paymentRequired ? (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Pay & Purchase
          </>
        ) : (
          "Purchase Service"
        )}
      </button>
    </div>
  );
}

function PurchasedServiceCard({
  purchase,
  onCancel,
  onRetryPayment,
  isPurchasing,
}: {
  purchase: PurchasedService;
  onCancel: (id: string) => void;
  onRetryPayment: (purchase: PurchasedService) => void;
  isPurchasing: boolean;
}) {
  const statusStyle = STATUS_COLORS[purchase.status] || STATUS_COLORS.PENDING;
  const paymentStyle = PAYMENT_STATUS_COLORS[purchase.paymentStatus] || PAYMENT_STATUS_COLORS.UNPAID;

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(amount);
  };

  const showPaymentActions = purchase.paymentStatus === "UNPAID" || purchase.paymentStatus === "PENDING" || purchase.paymentStatus === "FAILED";

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{purchase.service.name}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {purchase.service.category && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">
                {purchase.service.category}
              </span>
            )}
            {purchase.financialYear && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                FY {purchase.financialYear}
              </span>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
            {purchase.status.replace(/_/g, " ")}
          </span>
          <br />
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${paymentStyle.bg} ${paymentStyle.text}`}>
            {purchase.paymentStatus === "PAID" ? "✓ Paid" : purchase.paymentStatus.replace(/_/g, " ")}
          </span>
        </div>
      </div>
      
      {/* Payment Details */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 dark:text-white/60">Service Price</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(Number(purchase.price), purchase.currency)}
            </p>
          </div>
          {purchase.paymentAmount !== null && (
            <div>
              <p className="text-slate-500 dark:text-white/60">Amount Paid</p>
              <p className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(Number(purchase.paymentAmount), purchase.currency)}
              </p>
            </div>
          )}
          {purchase.taxAmount !== null && Number(purchase.taxAmount) > 0 && (
            <div>
              <p className="text-slate-500 dark:text-white/60">GST</p>
              <p className="text-slate-700 dark:text-white/80">
                {formatCurrency(Number(purchase.taxAmount), purchase.currency)}
              </p>
            </div>
          )}
          {purchase.paidAt && (
            <div>
              <p className="text-slate-500 dark:text-white/60">Paid On</p>
              <p className="text-slate-700 dark:text-white/80">
                {new Date(purchase.paidAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
        
        <p className="text-sm text-slate-500 dark:text-white/60 mt-3">
          Purchased on {new Date(purchase.purchasedAt).toLocaleDateString()}
        </p>
        
        {/* Transaction ID */}
        {purchase.transactionId && (
          <p className="text-xs text-slate-400 dark:text-white/40 mt-1 font-mono">
            Ref: {purchase.transactionId.slice(0, 20)}...
          </p>
        )}
        
        {/* Receipt Link */}
        {purchase.paymentReceipt && (
          <a
            href={purchase.paymentReceipt}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm text-[#0891b2] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Receipt
          </a>
        )}
        
        {/* Status Messages */}
        {purchase.status === "CONSENT_REQUIRED" && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Please complete the required legal consent to activate this service.
            </p>
            <Link
              href="/user-dashboard/consents"
              className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              Sign Consents
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
        
        {/* Payment Actions */}
        {showPaymentActions && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onRetryPayment(purchase)}
              disabled={isPurchasing}
              className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isPurchasing ? "Processing..." : purchase.paymentStatus === "FAILED" ? "Retry Payment" : "Complete Payment"}
            </button>
            <button
              type="button"
              onClick={() => onCancel(purchase.id)}
              className="py-2 px-4 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
