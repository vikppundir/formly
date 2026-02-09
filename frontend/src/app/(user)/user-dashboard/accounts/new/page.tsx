"use client";

/**
 * Create New Account - Onboarding wizard with account type selection
 * and type-specific profile form.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, type AccountType } from "@/contexts/account-context";

const ACCOUNT_TYPES: { type: AccountType; label: string; description: string; icon: string }[] = [
  {
    type: "INDIVIDUAL",
    label: "Individual",
    description: "For personal tax returns and individual financial services",
    icon: "👤",
  },
  {
    type: "COMPANY",
    label: "Company",
    description: "For company tax, BAS lodgment, and business accounting",
    icon: "🏢",
  },
  {
    type: "TRUST",
    label: "Trust",
    description: "For trust tax returns, SMSF, and trustee services",
    icon: "🏛️",
  },
  {
    type: "PARTNERSHIP",
    label: "Partnership",
    description: "For partnership tax returns and profit distribution",
    icon: "🤝",
  },
];

export default function NewAccountPage() {
  const router = useRouter();
  const { createAccount } = useAccount();
  const [step, setStep] = useState<"type" | "name">("type");
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleTypeSelect(type: AccountType) {
    setSelectedType(type);
    setStep("name");
    // Pre-fill name based on type
    if (type === "INDIVIDUAL") {
      setAccountName("My Personal Account");
    } else if (type === "COMPANY") {
      setAccountName("My Company");
    } else if (type === "TRUST") {
      setAccountName("Family Trust");
    } else {
      setAccountName("My Partnership");
    }
  }

  async function handleCreate() {
    if (!selectedType || !accountName.trim()) {
      setError("Please provide an account name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const account = await createAccount(selectedType, accountName.trim());
      router.push(`/user-dashboard/accounts/${account.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Account</h1>
        <p className="text-slate-500 dark:text-white/60 mt-1">
          {step === "type" ? "Choose the type of account you want to create" : "Give your account a name"}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`flex-1 h-1 rounded-full ${step === "type" || step === "name" ? "bg-[#E91E8C]" : "bg-slate-200 dark:bg-white/10"}`} />
        <div className={`flex-1 h-1 rounded-full ${step === "name" ? "bg-[#E91E8C]" : "bg-slate-200 dark:bg-white/10"}`} />
      </div>

      {step === "type" && (
        <div className="space-y-4">
          {ACCOUNT_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => handleTypeSelect(item.type)}
              className="w-full p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#E91E8C]/50 hover:shadow-lg hover:shadow-[#E91E8C]/10 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{item.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-[#E91E8C]">
                    {item.label}
                  </h3>
                  <p className="text-slate-500 dark:text-white/60 mt-1">{item.description}</p>
                </div>
                <svg
                  className="w-6 h-6 text-slate-300 dark:text-white/30 group-hover:text-[#E91E8C] group-hover:translate-x-1 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "name" && selectedType && (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
          {/* Selected type indicator */}
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
            <span className="text-2xl">
              {ACCOUNT_TYPES.find((t) => t.type === selectedType)?.icon}
            </span>
            <div>
              <p className="text-sm text-slate-500 dark:text-white/60">Account Type</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {ACCOUNT_TYPES.find((t) => t.type === selectedType)?.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("type");
                setSelectedType(null);
              }}
              className="ml-auto text-sm text-[#E91E8C] hover:underline"
            >
              Change
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">
                Account Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Enter a name for this account"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E91E8C]/50 focus:border-[#E91E8C]"
              />
              <p className="text-sm text-slate-500 dark:text-white/60 mt-2">
                Choose a name that helps you identify this account, e.g., "John&apos;s Tax", "ABC Pty Ltd", etc.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setStep("type");
                  setSelectedType(null);
                }}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || !accountName.trim()}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white font-medium hover:shadow-lg hover:shadow-[#E91E8C]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
