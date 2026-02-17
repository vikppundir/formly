"use client";

/**
 * Admin Service Requests - View and manage service purchase requests.
 * Shows all user service purchases with filters, payment details, and detailed view.
 */

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
type ServiceStatus = "PENDING" | "CONSENT_REQUIRED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";

interface ServicePurchase {
  id: string;
  serviceId: string;
  accountId: string;
  status: ServiceStatus;
  price: number;
  purchasedAt: string;
  activatedAt: string | null;
  completedAt: string | null;
  financialYear: string | null;
  notes: string | null;
  // Payment fields
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  transactionId: string | null;
  stripeSessionId: string | null;
  paymentAmount: number | null;
  taxAmount: number | null;
  currency: string | null;
  paidAt: string | null;
  paymentReceipt: string | null;
  service: {
    id: string;
    code: string;
    name: string;
    category: string | null;
    description: string | null;
    requiresConsent: boolean;
  };
  account: {
    id: string;
    name: string;
    accountType: AccountType;
    status: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    individualProfile?: {
      firstName: string | null;
      middleName: string | null;
      lastName: string | null;
      tfn: string | null;
      dateOfBirth: string | null;
      address: string | null;
      suburb: string | null;
      state: string | null;
      postcode: string | null;
      occupation: string | null;
    };
    companyProfile?: {
      companyName: string | null;
      tradingName: string | null;
      abn: string | null;
      acn: string | null;
      businessAddress: string | null;
      gstRegistered: boolean;
    };
    trustProfile?: {
      trustName: string | null;
      trustType: string | null;
      tfn: string | null;
      abn: string | null;
    };
    partnershipProfile?: {
      partnershipName: string | null;
      tradingName: string | null;
      abn: string | null;
      tfn: string | null;
    };
  };
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

const TYPE_COLORS: Record<AccountType, string> = {
  INDIVIDUAL: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  COMPANY: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  TRUST: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  PARTNERSHIP: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
};

export default function ServiceRequestsPage() {
  const { hasPermission } = useAuth();
  const [purchases, setPurchases] = useState<ServicePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [selectedPurchase, setSelectedPurchase] = useState<ServicePurchase | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ServiceStatus>("IN_PROGRESS");
  const [submitting, setSubmitting] = useState(false);

  const canManage = hasPermission("manage_settings");

  useEffect(() => {
    if (canManage) loadPurchases();
  }, [canManage]);

  async function loadPurchases() {
    setLoading(true);
    try {
      const res = await apiGet<{ purchases: ServicePurchase[] }>("/admin/services/purchases");
      setPurchases(res.purchases || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function openDetail(purchase: ServicePurchase) {
    setSelectedPurchase(purchase);
    setDetailModal(true);
  }

  function openStatusUpdate(purchase: ServicePurchase) {
    setSelectedPurchase(purchase);
    setNewStatus(purchase.status);
    setStatusModal(true);
    setError("");
  }

  async function handleStatusUpdate() {
    if (!selectedPurchase) return;
    setSubmitting(true);
    setError("");
    try {
      await apiPatch(`/admin/services/purchases/${selectedPurchase.id}/status`, { status: newStatus });
      setStatusModal(false);
      setSelectedPurchase(null);
      loadPurchases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPurchases = purchases.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (paymentFilter && p.paymentStatus !== paymentFilter) return false;
    if (typeFilter && p.account.accountType !== typeFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: purchases.length,
    pending: purchases.filter((p) => p.status === "PENDING" || p.status === "CONSENT_REQUIRED").length,
    active: purchases.filter((p) => p.status === "IN_PROGRESS" || p.status === "REVIEW").length,
    completed: purchases.filter((p) => p.status === "COMPLETED").length,
    paid: purchases.filter((p) => p.paymentStatus === "PAID").length,
    totalRevenue: purchases
      .filter((p) => p.paymentStatus === "PAID")
      .reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0),
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(amount);
  };

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Service Requests</h1>
        <p className="text-zinc-500 mt-2">You do not have permission to view service requests.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Service Requests
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage user service purchase requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Requests</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
          <p className="text-2xl font-semibold text-amber-600">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p>
          <p className="text-2xl font-semibold text-blue-600">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
          <p className="text-2xl font-semibold text-green-600">{stats.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Paid</p>
          <p className="text-2xl font-semibold text-emerald-600">{stats.paid}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
          <p className="text-2xl font-semibold text-[#0891b2]">{formatCurrency(stats.totalRevenue, "AUD")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ServiceStatus | "")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONSENT_REQUIRED">Consent Required</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="REVIEW">Review</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | "")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Payment Status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PENDING">Payment Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AccountType | "")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Account Types</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
          <option value="TRUST">Trust</option>
          <option value="PARTNERSHIP">Partnership</option>
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Service</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">User</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Account</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Type</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Payment</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => {
                  const pStatus = STATUS_COLORS[p.status] || STATUS_COLORS.PENDING;
                  const payStatus = PAYMENT_STATUS_COLORS[p.paymentStatus] || PAYMENT_STATUS_COLORS.UNPAID;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{p.service.name}</p>
                          <p className="text-xs text-slate-500">{p.service.category}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-100">{p.account.user.name}</p>
                          <p className="text-xs text-slate-500">{p.account.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{p.account.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[p.account.accountType]}`}>
                          {p.account.accountType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(Number(p.price), p.currency)}
                          </p>
                          {p.paymentAmount && (
                            <p className="text-xs text-green-600">
                              Paid: {formatCurrency(Number(p.paymentAmount), p.currency)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${payStatus.bg} ${payStatus.text}`}>
                          {p.paymentStatus === "PAID" ? "✓ Paid" : p.paymentStatus.replace(/_/g, " ")}
                        </span>
                        {p.paidAt && (
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(p.paidAt).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${pStatus.bg} ${pStatus.text}`}>
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(p.purchasedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(p)}
                            className="text-teal-600 dark:text-teal-400 text-sm hover:underline"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openStatusUpdate(p)}
                            className="text-amber-600 dark:text-amber-400 text-sm hover:underline"
                          >
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No service requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-sm text-slate-500">
            Showing {filteredPurchases.length} of {purchases.length} requests
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Request Details
                </h2>
                <button
                  type="button"
                  onClick={() => setDetailModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Service Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Service Information</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Service:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPurchase.service.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Category:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.service.category || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Price:</span>
                    <span className="font-bold text-[#0891b2]">{formatCurrency(Number(selectedPurchase.price), selectedPurchase.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Status:</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${(STATUS_COLORS[selectedPurchase.status] || STATUS_COLORS.PENDING).bg} ${(STATUS_COLORS[selectedPurchase.status] || STATUS_COLORS.PENDING).text}`}>
                      {selectedPurchase.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Requires Consent:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.service.requiresConsent ? "Yes" : "No"}</span>
                  </div>
                  {selectedPurchase.financialYear && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Financial Year:</span>
                      <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.financialYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Payment Information</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Payment Status:</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${(PAYMENT_STATUS_COLORS[selectedPurchase.paymentStatus] || PAYMENT_STATUS_COLORS.UNPAID).bg} ${(PAYMENT_STATUS_COLORS[selectedPurchase.paymentStatus] || PAYMENT_STATUS_COLORS.UNPAID).text}`}>
                      {selectedPurchase.paymentStatus === "PAID" ? "✓ Paid" : selectedPurchase.paymentStatus?.replace(/_/g, " ") || "Unpaid"}
                    </span>
                  </div>
                  {selectedPurchase.paymentMethod && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Payment Method:</span>
                      <span className="text-slate-900 dark:text-slate-100 capitalize">{selectedPurchase.paymentMethod}</span>
                    </div>
                  )}
                  {selectedPurchase.paymentAmount && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Amount Paid:</span>
                      <span className="font-medium text-green-600">{formatCurrency(Number(selectedPurchase.paymentAmount), selectedPurchase.currency)}</span>
                    </div>
                  )}
                  {selectedPurchase.taxAmount && Number(selectedPurchase.taxAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">GST:</span>
                      <span className="text-slate-900 dark:text-slate-100">{formatCurrency(Number(selectedPurchase.taxAmount), selectedPurchase.currency)}</span>
                    </div>
                  )}
                  {selectedPurchase.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Paid At:</span>
                      <span className="text-slate-900 dark:text-slate-100">{new Date(selectedPurchase.paidAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedPurchase.transactionId && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Transaction ID:</span>
                      <span className="text-slate-900 dark:text-slate-100 font-mono text-xs">{selectedPurchase.transactionId}</span>
                    </div>
                  )}
                  {selectedPurchase.paymentReceipt && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">Receipt:</span>
                      <a
                        href={selectedPurchase.paymentReceipt}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 dark:text-teal-400 text-sm hover:underline flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Receipt
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* User Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">User Information</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Name:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPurchase.account.user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Email:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.user.email}</span>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Account Information</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Account Name:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPurchase.account.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Account Type:</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[selectedPurchase.account.accountType]}`}>
                      {selectedPurchase.account.accountType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Account Status:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.status}</span>
                  </div>
                </div>
              </div>

              {/* Profile Details based on type */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Profile Details</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  {selectedPurchase.account.accountType === "INDIVIDUAL" && selectedPurchase.account.individualProfile && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">TFN:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.individualProfile.tfn || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Date of Birth:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.individualProfile.dateOfBirth || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Address:</span>
                        <span className="text-slate-900 dark:text-slate-100 text-right">
                          {[
                            selectedPurchase.account.individualProfile.streetAddress,
                            selectedPurchase.account.individualProfile.suburb,
                            selectedPurchase.account.individualProfile.state,
                            selectedPurchase.account.individualProfile.postcode
                          ].filter(Boolean).join(", ") || "Not provided"}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedPurchase.account.accountType === "COMPANY" && selectedPurchase.account.companyProfile && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Company Name:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.companyProfile.companyName || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">ABN:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.companyProfile.abn || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">ACN:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.companyProfile.acn || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Business Address:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.companyProfile.businessAddress || "Not provided"}</span>
                      </div>
                    </>
                  )}
                  {selectedPurchase.account.accountType === "TRUST" && selectedPurchase.account.trustProfile && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Trust Name:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.trustProfile.trustName || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Trust Type:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.trustProfile.trustType || "Not provided"}</span>
                      </div>
                    </>
                  )}
                  {selectedPurchase.account.accountType === "PARTNERSHIP" && selectedPurchase.account.partnershipProfile && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Partnership Name:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.partnershipProfile.partnershipName || "Not provided"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">ABN:</span>
                        <span className="text-slate-900 dark:text-slate-100">{selectedPurchase.account.partnershipProfile.abn || "Not provided"}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Timeline</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Purchased:</span>
                    <span className="text-slate-900 dark:text-slate-100">{new Date(selectedPurchase.purchasedAt).toLocaleString()}</span>
                  </div>
                  {selectedPurchase.activatedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Activated:</span>
                      <span className="text-slate-900 dark:text-slate-100">{new Date(selectedPurchase.activatedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedPurchase.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Completed:</span>
                      <span className="text-slate-900 dark:text-slate-100">{new Date(selectedPurchase.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailModal(false);
                  openStatusUpdate(selectedPurchase);
                }}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Update Request Status
            </h2>
            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Service: <span className="font-medium">{selectedPurchase.service.name}</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                User: <span className="font-medium">{selectedPurchase.account.user.name}</span>
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ServiceStatus)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100"
              >
                <option value="PENDING">Pending</option>
                <option value="CONSENT_REQUIRED">Consent Required</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStatusModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
