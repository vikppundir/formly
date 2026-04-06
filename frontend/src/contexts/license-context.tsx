"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CACHE_TTL_MS = 60 * 1000;
const LICENCE_KEY_STORAGE = "licence_key";
const INSTANCE_ID_STORAGE = "licence_instance_id";
const STATUS_CACHE_STORAGE = "licence_status_cache";

export type EnforcementMode = "OK" | "WARN_GRACE" | "SUSPEND_ADMIN" | "READ_ONLY" | "LOCKOUT";
export type LicenceStatus = "ACTIVE" | "GRACE" | "SUSPENDED" | "EXPIRED" | "REVOKED" | "INVALID" | "NOT_ACTIVATED";

interface LicenceState {
  status: LicenceStatus;
  enforcementMode: EnforcementMode;
  message: string;
  expiresAt: string | null;
  graceEndsAt: string | null;
  serverTime: string | null;
  loading: boolean;
  hasLicenceKey: boolean;
}

interface LicencePortalStatus {
  hasLicense: boolean;
  license?: {
    id: string;
    status: LicenceStatus;
    expiresAt: string;
    graceEndsAt: string | null;
    boundDomain: string | null;
  };
  latestRenewal?: {
    id: string;
    paymentStatus: "PENDING" | "PAID" | "FAILED";
    createdAt: string;
    paidAt: string | null;
  };
}

interface LicenceContextValue extends LicenceState {
  instanceId: string;
  activate: (licenceKey: string) => Promise<{ ok: boolean; message: string }>;
  deactivateCurrent: () => Promise<{ ok: boolean; message: string }>;
  refresh: (force?: boolean) => Promise<void>;
  clearLicence: () => void;
  setStoredKey: (key: string) => void;
  getStoredKey: () => string;
  getPortalStatus: () => Promise<LicencePortalStatus>;
  startRenewalCheckout: (successUrl: string, cancelUrl: string, licenceId?: string) => Promise<{ checkoutUrl: string }>;
  verifyRenewal: (renewalId: string, sessionId: string) => Promise<{ ok: boolean; status: string }>;
}

const LicenceContext = createContext<LicenceContextValue | null>(null);

function getInstanceId(): string {
  if (typeof window === "undefined") return "server-instance";
  const existing = window.localStorage.getItem(INSTANCE_ID_STORAGE);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(INSTANCE_ID_STORAGE, created);
  return created;
}

function getFingerprint(): string {
  if (typeof window === "undefined") return "server-fingerprint";
  return [
    navigator.userAgent || "",
    navigator.language || "",
    navigator.platform || "",
    String(window.screen.width),
    String(window.screen.height),
  ].join("|");
}

function defaultState(hasLicenceKey: boolean): LicenceState {
  return {
    status: hasLicenceKey ? "INVALID" : "NOT_ACTIVATED",
    enforcementMode: "LOCKOUT",
    message: hasLicenceKey ? "Validating licence..." : "Licence activation required.",
    expiresAt: null,
    graceEndsAt: null,
    serverTime: null,
    loading: true,
    hasLicenceKey,
  };
}

export function LicenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [instanceId] = useState<string>(() => getInstanceId());
  const [state, setState] = useState<LicenceState>(() => {
    const key = typeof window !== "undefined" ? window.localStorage.getItem(LICENCE_KEY_STORAGE) : null;
    return defaultState(Boolean(key));
  });

  const getStoredKey = useCallback(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LICENCE_KEY_STORAGE) || "";
  }, []);

  const setStoredKey = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LICENCE_KEY_STORAGE, key.trim());
  }, []);

  const clearLicence = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LICENCE_KEY_STORAGE);
      window.localStorage.removeItem(STATUS_CACHE_STORAGE);
    }
    setState({
      status: "NOT_ACTIVATED",
      enforcementMode: "LOCKOUT",
      message: "Licence activation required.",
      expiresAt: null,
      graceEndsAt: null,
      serverTime: null,
      loading: false,
      hasLicenceKey: false,
    });
  }, []);

  const removeLocalKeyWithMessage = useCallback((message: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LICENCE_KEY_STORAGE);
      window.localStorage.removeItem(STATUS_CACHE_STORAGE);
    }
    setState({
      status: "NOT_ACTIVATED",
      enforcementMode: "LOCKOUT",
      message,
      expiresAt: null,
      graceEndsAt: null,
      serverTime: null,
      loading: false,
      hasLicenceKey: false,
    });
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!user) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      const licenceKey = getStoredKey();
      if (!licenceKey) {
        setState({
          status: "NOT_ACTIVATED",
          enforcementMode: "LOCKOUT",
          message: "Licence activation required.",
          expiresAt: null,
          graceEndsAt: null,
          serverTime: null,
          loading: false,
          hasLicenceKey: false,
        });
        return;
      }

      if (!force && typeof window !== "undefined") {
        const cachedRaw = window.localStorage.getItem(STATUS_CACHE_STORAGE);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as { at: number; payload: Partial<LicenceState> };
            if (Date.now() - cached.at < CACHE_TTL_MS && cached.payload.status) {
              setState((prev) => ({
                ...prev,
                ...cached.payload,
                loading: false,
                hasLicenceKey: true,
              }));
              return;
            }
          } catch {
            // Ignore malformed cache.
          }
        }
      }

      setState((prev) => ({ ...prev, loading: true, hasLicenceKey: true }));
      try {
        const res = await fetch(`${API_URL}/license/status`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenceKey,
            instanceId,
            fingerprint: getFingerprint(),
            domain: window.location.hostname,
            productVersion: "web",
            buildDigest: process.env.NEXT_PUBLIC_BUILD_DIGEST || "dev-build",
          }),
        });
        const payload = await res.json();
        const reasonCode = String(payload.reasonCode || "");
        const shouldPurgeLocalKey =
          payload.status === "REVOKED" ||
          reasonCode === "DOMAIN_MISMATCH" ||
          reasonCode === "DOMAIN_NOT_ALLOWED" ||
          reasonCode === "KEY_NOT_FOUND";
        if (shouldPurgeLocalKey) {
          removeLocalKeyWithMessage("Licence key was removed or unbound by manager. Please add a valid licence key.");
          return;
        }
        const next: LicenceState = {
          status: payload.status || "INVALID",
          enforcementMode: payload.enforcementMode || "LOCKOUT",
          message: payload.message || "Licence validation failed.",
          expiresAt: payload.expiresAt || null,
          graceEndsAt: payload.graceEndsAt || null,
          serverTime: payload.serverTime || null,
          loading: false,
          hasLicenceKey: true,
        };
        setState(next);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STATUS_CACHE_STORAGE, JSON.stringify({ at: Date.now(), payload: next }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          status: "INVALID",
          enforcementMode: "LOCKOUT",
          message: "Unable to validate licence right now.",
          loading: false,
        }));
      }
    },
    [getStoredKey, instanceId, removeLocalKeyWithMessage, user]
  );

  const activate = useCallback(
    async (licenceKey: string) => {
      const normalized = licenceKey.trim();
      if (!normalized) return { ok: false, message: "Please enter a licence key." };
      try {
        const res = await fetch(`${API_URL}/license/activate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenceKey: normalized,
            instanceId,
            fingerprint: getFingerprint(),
            domain: window.location.hostname,
            productVersion: "web",
            buildDigest: process.env.NEXT_PUBLIC_BUILD_DIGEST || "dev-build",
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          return { ok: false, message: payload.message || payload.error || "Activation failed." };
        }
        setStoredKey(normalized);
        await refresh(true);
        return { ok: true, message: payload.message || "Licence activated successfully." };
      } catch {
        return { ok: false, message: "Activation failed. Please try again." };
      }
    },
    [instanceId, refresh, setStoredKey]
  );

  const deactivateCurrent = useCallback(async () => {
    const licenceKey = getStoredKey();
    if (!licenceKey) {
      clearLicence();
      return { ok: true, message: "Licence key removed locally." };
    }
    try {
      const res = await fetch(`${API_URL}/license/deactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenceKey }),
      });
      const payload = await res.json().catch(() => ({}));
      clearLicence();
      if (!res.ok) {
        return { ok: false, message: payload.error || payload.message || "Failed to deactivate licence." };
      }
      return { ok: true, message: payload.message || "Licence removed. Reactivation required." };
    } catch {
      clearLicence();
      return { ok: false, message: "Failed to deactivate licence on server." };
    }
  }, [clearLicence, getStoredKey]);

  const getPortalStatus = useCallback(async (): Promise<LicencePortalStatus> => {
    const res = await fetch(`${API_URL}/license/portal/status`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load licence portal status");
    return res.json();
  }, []);

  const startRenewalCheckout = useCallback(
    async (successUrl: string, cancelUrl: string, licenceId?: string) => {
      const res = await fetch(`${API_URL}/license/renewal/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successUrl, cancelUrl, licenceId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to start renewal checkout");
      return payload as { checkoutUrl: string };
    },
    []
  );

  const verifyRenewal = useCallback(
    async (renewalId: string, sessionId: string) => {
      const res = await fetch(`${API_URL}/license/renewal/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewalId, sessionId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to verify renewal payment");
      await refresh(true);
      return payload as { ok: boolean; status: string };
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<LicenceContextValue>(
    () => ({
      ...state,
      instanceId,
      activate,
      deactivateCurrent,
      refresh,
      clearLicence,
      setStoredKey,
      getStoredKey,
      getPortalStatus,
      startRenewalCheckout,
      verifyRenewal,
    }),
    [state, instanceId, activate, deactivateCurrent, refresh, clearLicence, setStoredKey, getStoredKey, getPortalStatus, startRenewalCheckout, verifyRenewal]
  );

  return <LicenceContext.Provider value={value}>{children}</LicenceContext.Provider>;
}

export function useLicence(): LicenceContextValue {
  const context = useContext(LicenceContext);
  if (!context) throw new Error("useLicence must be used within LicenceProvider");
  return context;
}
