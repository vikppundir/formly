/**
 * API client - credentials: 'include' for HTTP-only cookies (CSRF-safe).
 * Base URL from environment; no secrets in source (SOC 2).
 * Auto-refreshes token on 401 errors.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauth = true
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  // If 401 and not already retrying, try to refresh token
  if (res.status === 401 && retryOnUnauth && !path.includes("/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request
      return api<T>(path, options, false);
    }
    // Refresh failed, redirect to login (only from protected routes, not public pages)
    const publicPaths = ["/", "/login", "/register"];
    const isPublicPage = typeof window !== "undefined" && (
      publicPaths.includes(window.location.pathname) || 
      window.location.pathname.startsWith("/p/")
    );
    if (typeof window !== "undefined" && !isPublicPage) {
      window.location.href = "/login";
    }
  }
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = (data as ApiError) || { error: "Unknown error" };
    throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const apiGet = <T>(path: string) => api<T>(path, { method: "GET" });
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" });
