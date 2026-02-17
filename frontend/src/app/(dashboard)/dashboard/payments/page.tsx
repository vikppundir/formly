"use client";

/**
 * Admin Payments - View all incoming payments with filters and details.
 * Shows payment transactions from service purchases.
 */

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";

interface Payment {
  id: string;
  status: string;
  price: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  transactionId: string | null;
  stripeSessionId: string | null;
  paymentAmount: number | null;
  taxAmount: number | null;
  currency: string | null;
  paidAt: string | null;
  paymentReceipt: string | null;
  purchasedAt: string;
  financialYear: string | null;
  service: {
    id: string;
    code: string;
    name: string;
    category: string | null;
  };
  account: {
    id: string;
    name: string;
    accountType: AccountType;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
}

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

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailModal, setDetailModal] = useState(false);

  const canManage = hasPermission("manage_settings");

  useEffect(() => {
    if (canManage) loadPayments();
  }, [canManage]);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await apiGet<{ purchases: Payment[] }>("/admin/services/purchases");
      const allPayments = res.purchases || [];
      setPayments(allPayments);
      
      // Calculate stats
      const paid = allPayments.filter(p => p.paymentStatus === "PAID");
      const pending = allPayments.filter(p => p.paymentStatus === "PENDING");
      const failed = allPayments.filter(p => p.paymentStatus === "FAILED");
      const refunded = allPayments.filter(p => p.paymentStatus === "REFUNDED" || p.paymentStatus === "PARTIAL_REFUND");
      
      setStats({
        totalRevenue: paid.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0),
        totalTransactions: allPayments.filter(p => p.paymentStatus !== "UNPAID").length,
        paidCount: paid.length,
        pendingCount: pending.length,
        failedCount: failed.length,
        refundedCount: refunded.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  function openDetail(payment: Payment) {
    setSelectedPayment(payment);
    setDetailModal(true);
  }

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(amount);
  };

  const filterByDate = (payment: Payment) => {
    if (dateFilter === "all") return true;
    if (!payment.paidAt) return false;
    
    const paidDate = new Date(payment.paidAt);
    const now = new Date();
    
    if (dateFilter === "today") {
      return paidDate.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return paidDate >= weekAgo;
    }
    if (dateFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return paidDate >= monthAgo;
    }
    return true;
  };

  // Only show payments with actual payment activity (not unpaid)
  const filteredPayments = payments
    .filter((p) => p.paymentStatus !== "UNPAID")
    .filter((p) => !statusFilter || p.paymentStatus === statusFilter)
    .filter(filterByDate)
    .sort((a, b) => {
      // Sort by paidAt date, most recent first
      if (a.paidAt && b.paidAt) {
        return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
      }
      if (a.paidAt) return -1;
      if (b.paidAt) return 1;
      return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
    });

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Payments</h1>
        <p className="text-zinc-500 mt-2">You do not have permission to view payments.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Payments
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          View incoming payments and transaction history
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
            <p className="text-2xl font-semibold text-green-600">{formatCurrency(stats.totalRevenue, "AUD")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Transactions</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.totalTransactions}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Paid</p>
            <p className="text-2xl font-semibold text-green-600">{stats.paidCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
            <p className="text-2xl font-semibold text-yellow-600">{stats.pendingCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Failed</p>
            <p className="text-2xl font-semibold text-red-600">{stats.failedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Refunded</p>
            <p className="text-2xl font-semibold text-gray-600">{stats.refundedCount}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIAL_REFUND">Partial Refund</option>
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
        <button
          type="button"
          onClick={loadPayments}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400">No payment transactions found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Transaction</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Customer</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Service</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const statusStyle = PAYMENT_STATUS_COLORS[payment.paymentStatus] || PAYMENT_STATUS_COLORS.PENDING;
                  return (
                    <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
                            {payment.transactionId ? payment.transactionId.slice(0, 20) + "..." : "N/A"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                            {payment.paymentMethod || "stripe"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{payment.account.user.name}</p>
                          <p className="text-xs text-slate-500">{payment.account.user.email}</p>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[payment.account.accountType]}`}>
                            {payment.account.accountType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-100">{payment.service.name}</p>
                          <p className="text-xs text-slate-500">{payment.service.category}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(Number(payment.paymentAmount) || Number(payment.price), payment.currency)}
                          </p>
                          {payment.taxAmount && Number(payment.taxAmount) > 0 && (
                            <p className="text-xs text-slate-500">
                              GST: {formatCurrency(Number(payment.taxAmount), payment.currency)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                          {payment.paymentStatus === "PAID" ? "✓ Paid" : payment.paymentStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}
                        {payment.paidAt && (
                          <p className="text-xs text-slate-400">
                            {new Date(payment.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openDetail(payment)}
                          className="text-teal-600 dark:text-teal-400 text-sm hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-sm text-slate-500 border-t border-slate-200 dark:border-slate-700">
            Showing {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Payment Details
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
            <div className="p-6 space-y-4">
              {/* Payment Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Status</span>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${(PAYMENT_STATUS_COLORS[selectedPayment.paymentStatus] || PAYMENT_STATUS_COLORS.PENDING).bg} ${(PAYMENT_STATUS_COLORS[selectedPayment.paymentStatus] || PAYMENT_STATUS_COLORS.PENDING).text}`}>
                  {selectedPayment.paymentStatus === "PAID" ? "✓ Paid" : selectedPayment.paymentStatus?.replace(/_/g, " ")}
                </span>
              </div>

              {/* Amount */}
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">Amount Received</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(Number(selectedPayment.paymentAmount) || Number(selectedPayment.price), selectedPayment.currency)}
                </p>
                {selectedPayment.taxAmount && Number(selectedPayment.taxAmount) > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Includes GST: {formatCurrency(Number(selectedPayment.taxAmount), selectedPayment.currency)}
                  </p>
                )}
              </div>

              {/* Transaction Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Transaction Info</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Transaction ID</p>
                    <p className="font-mono text-xs text-slate-900 dark:text-slate-100 break-all">
                      {selectedPayment.transactionId || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Payment Method</p>
                    <p className="text-slate-900 dark:text-slate-100 capitalize">
                      {selectedPayment.paymentMethod || "Stripe"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Paid At</p>
                    <p className="text-slate-900 dark:text-slate-100">
                      {selectedPayment.paidAt ? new Date(selectedPayment.paidAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-slate-500 dark:text-slate-400">Currency</p>
                    <p className="text-slate-900 dark:text-slate-100">
                      {selectedPayment.currency || "AUD"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Customer</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Name:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPayment.account.user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Email:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPayment.account.user.email}</span>
                  </div>
                  {selectedPayment.account.user.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Phone:</span>
                      <span className="text-slate-900 dark:text-slate-100">{selectedPayment.account.user.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Account:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPayment.account.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Type:</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[selectedPayment.account.accountType]}`}>
                      {selectedPayment.account.accountType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Service</h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Service:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPayment.service.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Category:</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedPayment.service.category || "N/A"}</span>
                  </div>
                  {selectedPayment.financialYear && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Financial Year:</span>
                      <span className="text-slate-900 dark:text-slate-100">{selectedPayment.financialYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Receipt Link */}
              {selectedPayment.paymentReceipt && (
                <a
                  href={selectedPayment.paymentReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Stripe Receipt
                </a>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDetailModal(false)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
