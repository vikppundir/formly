"use client";

/**
 * Admin Support Page - View and manage all support tickets
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Ticket = {
  id: string;
  ticketNo: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  _count: { replies: number };
};

type TicketDetail = Ticket & {
  replies: {
    id: string;
    message: string;
    isAdmin: boolean;
    createdAt: string;
    user: { id: string; name: string; email: string };
  }[];
};

type Stats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
};

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

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reply form
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [search, statusFilter, priorityFilter, page]);

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/admin/support/stats`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch {}
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);

      const res = await fetch(`${API_URL}/admin/support/tickets?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(data.tickets || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketDetail(id: string) {
    try {
      const res = await fetch(`${API_URL}/support/tickets/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedTicket(data.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
    }
  }

  async function updateStatus(ticketId: string, status: string) {
    try {
      const res = await fetch(`${API_URL}/admin/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      loadTickets();
      loadStats();
      if (selectedTicket?.id === ticketId) {
        loadTicketDetail(ticketId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function updatePriority(ticketId: string, priority: string) {
    try {
      const res = await fetch(`${API_URL}/admin/support/tickets/${ticketId}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("Failed to update priority");
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        loadTicketDetail(ticketId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority");
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    setSendingReply(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/support/tickets/${selectedTicket.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      setReplyMessage("");
      loadTicketDetail(selectedTicket.id);
      loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
        <p className="text-slate-500 dark:text-white/60 text-sm mt-1">Manage customer support requests</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            <p className="text-sm text-slate-500 dark:text-white/60">Total</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
            <p className="text-sm text-blue-600/70 dark:text-blue-400/70">Open</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</p>
            <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70">In Progress</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
            <p className="text-sm text-green-600/70 dark:text-green-400/70">Resolved</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.closed}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400/70">Closed</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
        >
          <option value="">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
        >
          <option value="">All Priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && !selectedTicket && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Tickets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-white/60">No tickets found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-white/70 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-4">
                      <button
                        onClick={() => loadTicketDetail(ticket.id)}
                        className="text-left hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <p className="text-xs font-mono text-slate-500 dark:text-white/50">{ticket.ticketNo}</p>
                        <p className="font-medium text-slate-900 dark:text-white line-clamp-1">{ticket.subject}</p>
                        {ticket._count.replies > 0 && (
                          <p className="text-xs text-indigo-500">{ticket._count.replies} replies</p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{ticket.user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-white/50">{ticket.user.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={ticket.status}
                        onChange={(e) => updateStatus(ticket.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border-0 ${STATUS_COLORS[ticket.status]}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={ticket.priority}
                        onChange={(e) => updatePriority(ticket.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-white/5 ${PRIORITY_COLORS[ticket.priority]}`}
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500 dark:text-white/60">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => loadTicketDetail(ticket.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/20 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600 dark:text-white/70">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/20 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-slate-500 dark:text-white/50">{selectedTicket.ticketNo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTicket.status]}`}>
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                  <span className={`text-xs font-medium ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
                  By {selectedTicket.user.name} ({selectedTicket.user.email})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-white/20"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setSelectedTicket(null); setError(""); }}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Original message */}
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                    {selectedTicket.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{selectedTicket.user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">
                      {new Date(selectedTicket.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-slate-700 dark:text-white/80 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Replies */}
              {selectedTicket.replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`p-4 rounded-xl ${
                    reply.isAdmin
                      ? "bg-indigo-50 dark:bg-indigo-900/20 ml-4"
                      : "bg-slate-50 dark:bg-white/5 mr-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      reply.isAdmin
                        ? "bg-gradient-to-br from-indigo-600 to-indigo-800"
                        : "bg-gradient-to-br from-indigo-500 to-purple-500"
                    }`}>
                      {reply.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{reply.user.name}</p>
                        {reply.isAdmin && (
                          <span className="px-2 py-0.5 rounded text-xs bg-indigo-600 text-white">Support Team</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-white/50">
                        {new Date(reply.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-white/80 whitespace-pre-wrap">{reply.message}</p>
                </div>
              ))}
            </div>

            {/* Reply form */}
            {selectedTicket.status !== "CLOSED" && (
              <div className="p-6 border-t border-slate-200 dark:border-white/10">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}
                <form onSubmit={handleReply} className="space-y-3">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your response..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => updateStatus(selectedTicket.id, "RESOLVED")}
                      className="px-4 py-2 text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-xl hover:bg-green-200"
                    >
                      Mark Resolved
                    </button>
                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {sendingReply ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
