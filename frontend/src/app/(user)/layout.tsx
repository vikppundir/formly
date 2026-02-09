"use client";

/**
 * User dashboard layout - Beautiful modern design with JAP branding colors.
 * Pink: #E91E8C, Navy: #2E2A5E
 * Includes multi-account switcher and account-specific navigation.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AccountProvider, useAccount } from "@/contexts/account-context";
import { useEffect, useState } from "react";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

function ContractIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const NAV = [
  { href: "/user-dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/user-dashboard/accounts", label: "My Accounts", icon: AccountsIcon },
  { href: "/user-dashboard/services", label: "Services", icon: ServicesIcon },
  { href: "/user-dashboard/consents", label: "Contracts & Consents", icon: ContractIcon },
  { href: "/user-dashboard/profile", label: "Profile", icon: ProfileIcon },
  { href: "/user-dashboard/support", label: "Get Support", icon: SupportIcon },
  { href: "/user-dashboard/change-password", label: "Change Password", icon: LockIcon },
];

// Account Switcher Component
function AccountSwitcher() {
  const { accounts, currentAccount, switchAccount, loading } = useAccount();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || accounts.length === 0) return null;

  const typeColors: Record<string, string> = {
    INDIVIDUAL: "from-blue-500 to-blue-600",
    COMPANY: "from-purple-500 to-purple-600",
    TRUST: "from-emerald-500 to-emerald-600",
    PARTNERSHIP: "from-orange-500 to-orange-600",
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeColors[currentAccount?.accountType || "INDIVIDUAL"]} flex items-center justify-center text-white text-xs font-bold`}>
              {currentAccount?.accountType?.charAt(0) || "?"}
            </div>
            <div className="text-left min-w-0">
              <p className="text-white text-sm font-medium truncate">{currentAccount?.name || "Select Account"}</p>
              <p className="text-white/50 text-xs">{currentAccount?.accountType || "No account"}</p>
            </div>
          </div>
          <ChevronDownIcon className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-[#2E2A5E] border border-white/10 shadow-xl overflow-hidden">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  switchAccount(acc.id);
                  setIsOpen(false);
                }}
                className={`w-full p-3 flex items-center gap-3 hover:bg-white/10 transition-colors ${acc.id === currentAccount?.id ? "bg-white/5" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeColors[acc.accountType]} flex items-center justify-center text-white text-xs font-bold`}>
                  {acc.accountType.charAt(0)}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{acc.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs">{acc.accountType}</span>
                    {acc.isDefault && <span className="text-[#E91E8C] text-xs">(default)</span>}
                  </div>
                </div>
                {acc.id === currentAccount?.id && (
                  <div className="w-2 h-2 rounded-full bg-[#E91E8C]" />
                )}
              </button>
            ))}
            <Link
              href="/user-dashboard/accounts/new"
              onClick={() => setIsOpen(false)}
              className="w-full p-3 flex items-center gap-3 hover:bg-white/10 transition-colors border-t border-white/10 text-[#E91E8C]"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-[#E91E8C]/50 flex items-center justify-center">
                <span className="text-lg">+</span>
              </div>
              <span className="text-sm font-medium">Add New Account</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function UserLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // If admin, redirect to admin dashboard
    if (isAdmin()) {
      router.replace("/dashboard");
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  // Show loading while checking auth or redirecting admin
  if (loading || !user || isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2E2A5E] to-[#1a1840]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#1a1840] dark:to-[#0f0d24]">
      {/* Mobile overlay - only shows when sidebar is open on mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden cursor-pointer"
        />
      )}

      {/* Desktop Sidebar - always visible on lg+ */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-30 h-full w-72 flex-col bg-gradient-to-b from-[#2E2A5E] via-[#352f6b] to-[#2E2A5E] shadow-2xl">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#E91E8C]/30">
              J
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">JAP</h1>
              <p className="text-white/50 text-xs">In-depth Perfect Analysis</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-semibold text-lg shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{user.name}</p>
              <p className="text-white/50 text-sm truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="px-4 mt-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2 px-1">Current Account</p>
          <AccountSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${active
                    ? "bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white shadow-lg shadow-[#E91E8C]/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? "text-white" : "text-[#E91E8C] group-hover:text-white"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
          >
            <LogoutIcon className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar - slide in drawer */}
      <aside
        className={`
          lg:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col
          bg-gradient-to-b from-[#2E2A5E] via-[#352f6b] to-[#2E2A5E]
          shadow-2xl transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo with close button */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-bold text-lg">
                J
              </div>
              <div>
                <h1 className="text-white font-bold text-lg tracking-tight">JAP</h1>
                <p className="text-white/50 text-xs">In-depth Perfect Analysis</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-white/60 hover:bg-white/10"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-semibold text-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{user.name}</p>
              <p className="text-white/50 text-sm truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="px-4 mt-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2 px-1">Current Account</p>
          <AccountSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${active
                    ? "bg-gradient-to-r from-[#E91E8C] to-[#c4177a] text-white shadow-lg shadow-[#E91E8C]/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? "text-white" : "text-[#E91E8C] group-hover:text-white"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
          >
            <LogoutIcon className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-72 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-[#1a1840]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div>
              <p className="text-sm text-slate-500 dark:text-white/50">Welcome back,</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{user.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E8C] to-[#c4177a] flex items-center justify-center text-white font-semibold shadow-lg shadow-[#E91E8C]/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// Wrap with AccountProvider
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <UserLayoutInner>{children}</UserLayoutInner>
    </AccountProvider>
  );
}
