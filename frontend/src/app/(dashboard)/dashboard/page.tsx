"use client";

/**
 * Dashboard overview – modern UI with stat cards, support tickets, and welcome.
 */

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SupportStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
};

type RecentTicket = {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  user: { name: string; email: string };
};

function UsersStatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
function RolesStatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function SupportStatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  WAITING_CUSTOMER: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-slate-500",
  MEDIUM: "text-blue-500",
  HIGH: "text-orange-500",
  URGENT: "text-red-500 font-semibold",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [roleCount, setRoleCount] = useState<number | null>(null);
  const [supportStats, setSupportStats] = useState<SupportStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch users count
        const usersRes = await fetch(`${API_URL}/users?limit=1`, { credentials: "include" });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserCount(data.total || 0);
        }

        // Fetch roles count
        const rolesRes = await fetch(`${API_URL}/roles?limit=1`, { credentials: "include" });
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoleCount(data.total || 0);
        }

        // Fetch support stats
        const statsRes = await fetch(`${API_URL}/admin/support/stats`, { credentials: "include" });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setSupportStats(data.stats);
        }

        // Fetch recent tickets
        const ticketsRes = await fetch(`${API_URL}/admin/support/tickets?limit=5`, { credentials: "include" });
        if (ticketsRes.ok) {
          const data = await ticketsRes.json();
          setRecentTickets(data.tickets || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const STATS = [
    {
      label: "Total Users",
      value: userCount !== null ? userCount.toString() : "—",
      sub: "Active accounts",
      href: "/dashboard/users",
      icon: UsersStatIcon,
      gradient: "from-teal-500/20 to-teal-600/5",
      border: "border-teal-500/20",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      label: "Active Roles",
      value: roleCount !== null ? roleCount.toString() : "—",
      sub: "RBAC roles",
      href: "/dashboard/roles",
      icon: RolesStatIcon,
      gradient: "from-emerald-500/20 to-emerald-600/5",
      border: "border-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Open Tickets",
      value: supportStats ? (supportStats.open + supportStats.inProgress).toString() : "—",
      sub: "Need attention",
      href: "/dashboard/support",
      icon: SupportStatIcon,
      gradient: "from-amber-500/20 to-amber-600/5",
      border: "border-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome back, {user?.name?.split(" ")[0] ?? "Admin"}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-500 dark:text-slate-400">
          Here's what's happening with your admin panel today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={`group relative overflow-hidden rounded-2xl border ${stat.border} bg-white dark:bg-slate-900/50 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{stat.sub}</p>
                </div>
                <div className={`rounded-xl bg-gradient-to-br ${stat.gradient} p-3 border ${stat.border}`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <span className="relative mt-4 inline-flex items-center text-sm font-medium text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
                View
                <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Support Overview */}
      {supportStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Stats */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Support Overview</h2>
              <Link href="/dashboard/support" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Open</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{supportStats.open}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">In Progress</span>
                <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{supportStats.inProgress}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Resolved</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-300">{supportStats.resolved}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Closed</span>
                <span className="text-lg font-bold text-slate-600 dark:text-slate-400">{supportStats.closed}</span>
              </div>
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Tickets</h2>
              <Link href="/dashboard/support" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
                Manage
              </Link>
            </div>
            {recentTickets.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <SupportStatIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No support tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href="/dashboard/support"
                    className="flex items-start justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{ticket.ticketNo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                          {ticket.status.replace("_", " ")}
                        </span>
                        <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {ticket.user.name} • {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/dashboard/users"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-center group"
          >
            <UsersStatIcon className="w-6 h-6 text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Manage Users</span>
          </Link>
          <Link
            href="/dashboard/roles"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-center group"
          >
            <RolesStatIcon className="w-6 h-6 text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Manage Roles</span>
          </Link>
          <Link
            href="/dashboard/support"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-center group"
          >
            <SupportStatIcon className="w-6 h-6 text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Support Tickets</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-center group"
          >
            <svg className="w-6 h-6 text-slate-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
