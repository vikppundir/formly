"use client";

/**
 * Admin dashboard layout – modern sidebar, mobile-responsive (drawer on small screens).
 * Protected: redirect to /login if not authenticated.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/dashboard/users", label: "Users", icon: UsersIcon },
  { href: "/dashboard/accounts", label: "Accounts", icon: AccountsIcon },
  { href: "/dashboard/services", label: "Services", icon: ServicesIcon },
  { href: "/dashboard/service-requests", label: "Service Requests", icon: RequestsIcon },
  { href: "/dashboard/payments", label: "Payments", icon: PaymentsIcon },
  { href: "/dashboard/website", label: "Website", icon: WebsiteIcon },
  { href: "/dashboard/roles", label: "Roles & Permissions", icon: RolesIcon },
  { href: "/dashboard/support", label: "Support Tickets", icon: SupportIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function RolesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function AccountsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function ServicesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function RequestsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function PaymentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
function WebsiteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SidebarContent({
  pathname,
  hasPermission,
  onNavClick,
  handleLogout,
  onClose,
}: {
  pathname: string;
  hasPermission: (p: string) => boolean;
  onNavClick?: () => void;
  handleLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-slate-800/50">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={onNavClick}>
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            F
          </div>
          <span className="font-semibold text-white text-lg tracking-tight truncate">Formly Admin</span>
        </Link>
        {onClose && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const show =
            item.href === "/dashboard" ||
            (item.href === "/dashboard/users" && hasPermission("manage_users")) ||
            (item.href === "/dashboard/accounts" && hasPermission("manage_users")) ||
            (item.href === "/dashboard/services" && hasPermission("manage_settings")) ||
            (item.href === "/dashboard/service-requests" && hasPermission("manage_settings")) ||
            (item.href === "/dashboard/payments" && hasPermission("manage_settings")) ||
            (item.href === "/dashboard/website" && hasPermission("manage_settings")) ||
            (item.href === "/dashboard/roles" && hasPermission("manage_roles")) ||
            (item.href === "/dashboard/support" && hasPermission("manage_users")) ||
            (item.href === "/dashboard/settings" && hasPermission("manage_settings"));
          if (!show) return null;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 min-h-[44px] ${
                active
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-800/50">
        <button
          type="button"
          onClick={() => {
            handleLogout();
            onNavClick?.();
          }}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-red-400 transition-all duration-200 min-h-[44px]"
        >
          <LogoutIcon className="w-5 h-5 flex-shrink-0" />
          Logout
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasPermission("view_dashboard")) {
      router.replace("/login");
    }
  }, [user, loading, hasPermission, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[16rem_1fr] bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay - fixed, so does not take grid cell */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar: drawer on mobile; on desktop = first grid column (16rem) */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 flex flex-col bg-slate-900 dark:bg-slate-950 border-r border-slate-800/50 shadow-xl
          transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0 lg:w-full lg:min-w-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <SidebarContent
          pathname={pathname}
          hasPermission={hasPermission}
          onNavClick={() => setSidebarOpen(false)}
          handleLogout={handleLogout}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 w-full lg:col-start-2 lg:min-w-0">
        <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-slate-200 dark:border-slate-800/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm min-w-0 truncate">
              <span className="hidden sm:inline flex-shrink-0">Admin</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600 flex-shrink-0">/</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                {pathname === "/dashboard" ? "Overview" : 
                 pathname.startsWith("/dashboard/users") ? "Users" :
                 pathname.startsWith("/dashboard/accounts") ? "Accounts" :
                 pathname.startsWith("/dashboard/service-requests") ? "Service Requests" :
                 pathname.startsWith("/dashboard/services") ? "Services" :
                 pathname.startsWith("/dashboard/payments") ? "Payments" :
                 pathname.startsWith("/dashboard/website") ? "Website" : 
                 pathname.startsWith("/dashboard/roles") ? "Roles & Permissions" : 
                 pathname.startsWith("/dashboard/support") ? "Support Tickets" : 
                 pathname.startsWith("/dashboard/settings") ? "Settings" : "Overview"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
                {user.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-[180px]">
                {user.email}
              </span>
            </div>
            <div
              className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-semibold border border-indigo-500/30 flex-shrink-0"
              title={user.email}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
