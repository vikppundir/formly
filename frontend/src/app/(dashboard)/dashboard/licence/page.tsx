"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLicence } from "@/contexts/license-context";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";

export default function AdminLicencePage() {
  const search = useSearchParams();
  const { hasPermission } = useAuth();
  const licence = useLicence();
  const [keyInput, setKeyInput] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(true);
  const storedKeyRaw = useMemo(() => licence.getStoredKey(), [licence]);
  const maskedStoredKey = useMemo(() => {
    const raw = storedKeyRaw;
    if (!raw) return "";
    const normalized = raw.replace(/^(ONB|LIC)-/i, "");
    if (normalized.length <= 10) return normalized;
    return `${normalized.slice(0, 8)}-****-****-${normalized.slice(-5)}`;
  }, [storedKeyRaw]);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [portalStatus, setPortalStatus] = useState<Awaited<ReturnType<typeof licence.getPortalStatus>> | null>(null);

  const loadPortal = useCallback(async () => {
    try {
      const data = await licence.getPortalStatus();
      setPortalStatus(data);
    } catch {
      // ignore
    }
  }, [licence]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (licence.status === "ACTIVE" && storedKeyRaw) {
      setShowKeyForm(false);
      return;
    }
    setShowKeyForm(true);
  }, [licence.status, storedKeyRaw]);

  useEffect(() => {
    const sessionId = search.get("session_id");
    const renewalId = search.get("renewal_id");
    if (!sessionId || !renewalId) return;
    (async () => {
      try {
        setBusy(true);
        await licence.verifyRenewal(renewalId, sessionId);
        await loadPortal();
        setFeedback({ type: "success", message: "Renewal verified, licence reactivated." });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Could not verify renewal.",
        });
      } finally {
        setBusy(false);
      }
    })();
  }, [search, licence, loadPortal]);

  async function handleActivate() {
    setBusy(true);
    setFeedback(null);
    const result = await licence.activate(keyInput);
    setBusy(false);
    setFeedback({ type: result.ok ? "success" : "error", message: result.message });
    if (result.ok) {
      setShowKeyForm(false);
      setKeyInput("");
      await loadPortal();
    }
  }

  async function handleRenew() {
    try {
      setBusy(true);
      const successUrl = `${window.location.origin}/dashboard/licence`;
      const cancelUrl = `${window.location.origin}/dashboard/licence`;
      const checkout = await licence.startRenewalCheckout(successUrl, cancelUrl, portalStatus?.license?.id);
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to start renewal.",
      });
      setBusy(false);
    }
  }

  if (!hasPermission("manage_settings")) {
    return <p className="text-sm text-slate-500">You do not have permission to manage licence.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Licence Activation</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Activate and renew application licence from admin panel.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Current App Licence Status</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Status: <strong>{licence.status}</strong> ({licence.enforcementMode})
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{licence.message}</p>
        {licence.expiresAt && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Expires: {new Date(licence.expiresAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Activate Licence Key</h2>
        {maskedStoredKey && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stored key: <span className="font-mono">{maskedStoredKey}</span>
          </p>
        )}
        {showKeyForm ? (
          <>
            <input
              type="password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="Enter full licence key"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleActivate}
                disabled={busy || !keyInput.trim()}
                className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {busy ? "Activating..." : "Activate"}
              </button>
              {storedKeyRaw && (
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const result = await licence.deactivateCurrent();
                    setBusy(false);
                    setFeedback({ type: result.ok ? "success" : "error", message: result.message });
                    setKeyInput("");
                    setShowKeyForm(true);
                    await loadPortal();
                  }}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Remove Key
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowKeyForm(true)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Replace Key
            </button>
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                const result = await licence.deactivateCurrent();
                setBusy(false);
                setFeedback({ type: result.ok ? "success" : "error", message: result.message });
                setKeyInput("");
                setShowKeyForm(true);
                await loadPortal();
              }}
              disabled={busy}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Remove Key
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Renewal</h2>
        <button
          type="button"
          onClick={handleRenew}
          disabled={busy || !portalStatus?.hasLicense}
          className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Processing..." : "Renew Licence (Stripe)"}
        </button>
      </section>
    </div>
  );
}
