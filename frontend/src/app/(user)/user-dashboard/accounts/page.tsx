"use client";

/**
 * User accounts page - View and manage multiple accounts.
 * - Active accounts tab (default)
 * - Closed accounts tab (user can reopen)
 * - Popup with "Close" and "Permanent Delete" options
 * - Permanent delete requires confirmation
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, type Account, type AccountType } from "@/contexts/account-context";
import { useState, useRef, useEffect } from "react";

const TYPE_INFO: Record<AccountType, { label: string; description: string; color: string; bgColor: string }> = {
  INDIVIDUAL: {
    label: "Individual",
    description: "Personal tax returns and individual financial services",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  COMPANY: {
    label: "Company",
    description: "Company tax, BAS, and business accounting services",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  TRUST: {
    label: "Trust",
    description: "Trust tax returns, SMSF, and trustee services",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  PARTNERSHIP: {
    label: "Partnership",
    description: "Partnership tax returns and profit distribution",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  PENDING_REVIEW: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  SUSPENDED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  CLOSED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

export default function AccountsPage() {
  const { accounts, currentAccount, loading, error, switchAccount, setDefaultAccount, closeAccount, reopenAccount, deleteAccount } = useAccount();
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "closed">("active");

  // Separate active vs closed
  const activeAccounts = accounts.filter((a) => a.status !== "CLOSED");
  const closedAccounts = accounts.filter((a) => a.status === "CLOSED");

  async function handleSetDefault(accountId: string) {
    setSettingDefault(accountId);
    try {
      await setDefaultAccount(accountId);
    } catch {
      // Error handled by context
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleClose(accountId: string, accountName: string) {
    setActionLoading(accountId);
    setActionError(null);
    try {
      await closeAccount(accountId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close account");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(accountId: string) {
    setActionLoading(accountId);
    setActionError(null);
    try {
      await deleteAccount(accountId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete account");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReopen(accountId: string) {
    setActionLoading(accountId);
    setActionError(null);
    try {
      await reopenAccount(accountId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reopen account");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Accounts</h1>
          <p className="text-slate-500 dark:text-white/60 mt-1">
            Manage your accounts and their profiles
          </p>
        </div>
        <Link
          href="/user-dashboard/accounts/new"
          className="rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white px-6 py-3 text-sm font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 transition-all text-center"
        >
          Create New Account
        </Link>
      </div>

      {(error || actionError) && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error || actionError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "active"
              ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70"
          }`}
        >
          Active Accounts
          {activeAccounts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-[#0891b2]/10 text-[#0891b2]">{activeAccounts.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("closed")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "closed"
              ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70"
          }`}
        >
          Closed Accounts
          {closedAccounts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60">{closedAccounts.length}</span>
          )}
        </button>
      </div>

      {/* Active Tab */}
      {tab === "active" && (
        <>
          {activeAccounts.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#0891b2]/20 to-[#0e7490]/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No active accounts</h3>
              <p className="text-slate-500 dark:text-white/60 mb-6 max-w-md mx-auto">
                {closedAccounts.length > 0
                  ? "All your accounts are closed. You can reopen them from the Closed Accounts tab or create a new one."
                  : "Create your first account to get started with our accounting services."}
              </p>
              <Link
                href="/user-dashboard/accounts/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white px-6 py-3 text-sm font-medium hover:shadow-lg hover:shadow-[#0891b2]/30 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create New Account
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isCurrent={currentAccount?.id === account.id}
                  isSettingDefault={settingDefault === account.id}
                  isActionLoading={actionLoading === account.id}
                  onSwitch={() => switchAccount(account.id)}
                  onSetDefault={() => handleSetDefault(account.id)}
                  onClose={() => handleClose(account.id, account.name)}
                  onDelete={() => handleDelete(account.id)}
                  onManage={async () => {
                    await switchAccount(account.id);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Closed Tab */}
      {tab === "closed" && (
        <>
          {closedAccounts.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-400 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No closed accounts</h3>
              <p className="text-slate-500 dark:text-white/60 max-w-md mx-auto">
                Closed accounts will appear here. You can reopen them anytime.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {closedAccounts.map((account) => (
                <ClosedAccountCard
                  key={account.id}
                  account={account}
                  isActionLoading={actionLoading === account.id}
                  onReopen={() => handleReopen(account.id)}
                  onDelete={() => handleDelete(account.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Action Popup — small popup with "Close" and "Permanent Delete" options
// ============================================================================
function ActionPopup({
  onClose,
  onDelete,
  onDismiss,
  isLoading,
}: {
  onClose: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close popup on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  if (confirmDelete) {
    return (
      <div ref={popupRef} className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 p-4 animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h4 className="font-semibold text-red-600 dark:text-red-400 text-sm">Are you sure?</h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
          This will <strong className="text-red-600 dark:text-red-400">permanently delete</strong> this account and all its data. This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onDelete}
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Yes, Delete"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={popupRef} className="absolute right-0 top-full mt-2 z-50 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-1">
      <button
        onClick={() => { onClose(); }}
        disabled={isLoading}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <div>
          <span className="font-medium">Close Account</span>
          <p className="text-xs text-slate-400 dark:text-white/40">Disable &amp; hide. Can reopen later.</p>
        </div>
      </button>
      <div className="border-t border-slate-100 dark:border-white/5" />
      <button
        onClick={() => setConfirmDelete(true)}
        disabled={isLoading}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        <div>
          <span className="font-medium">Permanent Delete</span>
          <p className="text-xs text-red-400/70 dark:text-red-400/50">Remove all data. Cannot undo.</p>
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// Active Account Card
// ============================================================================
function AccountCard({
  account,
  isCurrent,
  isSettingDefault,
  isActionLoading,
  onSwitch,
  onSetDefault,
  onClose,
  onDelete,
  onManage,
}: {
  account: Account;
  isCurrent: boolean;
  isSettingDefault: boolean;
  isActionLoading: boolean;
  onSwitch: () => void;
  onSetDefault: () => void;
  onClose: () => void;
  onDelete: () => void;
  onManage: () => Promise<void>;
}) {
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const typeInfo = TYPE_INFO[account.accountType];

  async function handleManage() {
    setManaging(true);
    try {
      await onManage();
      router.push(`/user-dashboard/accounts/${account.id}`);
    } finally {
      setManaging(false);
    }
  }

  return (
    <div
      className={`rounded-2xl p-6 transition-all ${
        isCurrent
          ? "bg-gradient-to-r from-[#0891b2]/10 to-[#0e7490]/10 border-2 border-[#0891b2]/30 dark:border-[#0891b2]/50"
          : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#0891b2]/30"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl ${typeInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
          <span className={`text-2xl font-bold ${typeInfo.color}`}>
            {account.accountType.charAt(0)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{account.name}</h3>
            {account.isDefault && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0891b2]/20 text-[#0891b2]">
                Default
              </span>
            )}
            {isCurrent && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.bgColor} ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[account.status] || STATUS_COLORS.DRAFT}`}>
              {account.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/60 mt-2">{typeInfo.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isCurrent && (
            <button
              type="button"
              onClick={onSwitch}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#0891b2] hover:bg-[#0891b2]/10 transition-colors"
            >
              Switch
            </button>
          )}
          {!account.isDefault && (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={isSettingDefault}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {isSettingDefault ? "..." : "Set Default"}
            </button>
          )}
          <button
            type="button"
            onClick={handleManage}
            disabled={managing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            {managing ? "..." : "Manage"}
          </button>

          {/* More options (three-dot) → popup */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPopup(!showPopup)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="More options"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
            {showPopup && (
              <ActionPopup
                isLoading={isActionLoading}
                onClose={() => { setShowPopup(false); onClose(); }}
                onDelete={() => { setShowPopup(false); onDelete(); }}
                onDismiss={() => setShowPopup(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Closed Account Card — shows reopen + permanent delete
// ============================================================================
function ClosedAccountCard({
  account,
  isActionLoading,
  onReopen,
  onDelete,
}: {
  account: Account;
  isActionLoading: boolean;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const typeInfo = TYPE_INFO[account.accountType];

  return (
    <div className="rounded-2xl p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 opacity-80 hover:opacity-100 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon — greyed out */}
        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-slate-400 dark:text-white/30">
            {account.accountType.charAt(0)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-500 dark:text-white/50">{account.name}</h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-white/40">
              Closed
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.bgColor} ${typeInfo.color} opacity-60`}>
              {typeInfo.label}
            </span>
          </div>
          <p className="text-sm text-slate-400 dark:text-white/40 mt-2">{typeInfo.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onReopen}
            disabled={isActionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#0891b2] hover:bg-[#0891b2]/10 border border-[#0891b2]/30 transition-colors disabled:opacity-50"
          >
            {isActionLoading ? "..." : "Reopen"}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                disabled={isActionLoading}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isActionLoading ? "..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Permanently delete"
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
