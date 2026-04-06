"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EnforcementMode, LicenceStatus } from "@/contexts/license-context";

interface Props {
  status: LicenceStatus;
  enforcementMode: EnforcementMode;
  message: string;
  expiresAt?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
  purchaseHref?: string;
}

export function LicenceBlockScreen({
  status,
  enforcementMode,
  message,
  expiresAt,
  ctaHref = "/dashboard/licence",
  ctaLabel = "Add Your Licence Key",
  purchaseHref = "http://localhost:3001/portal/purchase",
}: Props) {
  const title = useMemo(() => {
    if (status === "NOT_ACTIVATED") return "Licence Activation Required";
    if (status === "EXPIRED") return "Licence Expired";
    if (status === "REVOKED") return "Licence Revoked";
    if (status === "SUSPENDED") return "Licence Suspended";
    return "Licence Validation Failed";
  }, [status]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
          {enforcementMode}
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{message}</p>
        {(status === "EXPIRED" || status === "GRACE") && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Your licence is expired or in grace period. Renew now to restore full access.
          </p>
        )}
        {expiresAt && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Expiry: {new Date(expiresAt).toLocaleString()}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={ctaHref}
            className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
          >
            {ctaLabel}
          </Link>
          <Link
            href={purchaseHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Get Licence Key
          </Link>
        </div>
      </div>
    </div>
  );
}
