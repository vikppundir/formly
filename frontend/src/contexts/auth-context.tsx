"use client";

/**
 * Auth context: user, login, logout, refresh.
 * Protected routes check user and redirect to /login if unauthenticated.
 * Future: SSO (Auth0/Okta) can plug in here via strategy.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  phoneVerified?: boolean;
  // Terms accepted at registration
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  dpaAcceptedAt?: string | null;
  permissions: string[];
  roleNames: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiPost<{ user: AuthUser }>("/auth/refresh", {});
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ user: AuthUser }>("/me");
        setUser(data.user);
      } catch {
        try {
          const data = await apiPost<{ user: AuthUser }>("/auth/refresh", {});
          setUser(data.user);
        } catch {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, rememberMe?: boolean) => {
    const data = await apiPost<{ user: AuthUser }>("/auth/login", { email, password, rememberMe: rememberMe ?? false });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout", {});
    } finally {
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (code: string) => (user?.permissions ?? []).includes(code),
    [user]
  );

  const isAdmin = useCallback(() => {
    const adminRoles = ["Super Admin", "Admin", "Manager"];
    return (user?.roleNames ?? []).some((r) => adminRoles.includes(r));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refresh, hasPermission, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
