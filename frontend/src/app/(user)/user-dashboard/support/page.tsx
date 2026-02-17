"use client";

/**
 * User Support Page - Create and view support tickets
 */

import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";

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
  _count: { replies: number };
};

type TicketDetail = Ticket & {
  user: { id: string; name: string; email: string };
  replies: {
    id: string;
    message: string;
    isAdmin: boolean;
    createdAt: string;
    user: { id: string; name: string; email: string };
  }[];
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
  URGENT: "text-red-500",
};

export default function UserSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  // Reply form
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Support info
  const [supportInfo, setSupportInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTickets();
    loadSupportInfo();
  }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/support/tickets`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  async function loadSupportInfo() {
    try {
      const res = await fetch(`${API_URL}/public/settings`);
      const data = await res.json();
      if (res.ok && data.settings) {
        const info: Record<string, string> = {};
        data.settings.forEach((s: { key: string; value: string }) => {
          if (s.key.startsWith("support_")) info[s.key] = s.value;
        });
        setSupportInfo(info);
      }
    } catch {}
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, description, priority, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      setSuccess(`Ticket ${data.ticket.ticketNo} created successfully!`);
      setShowCreate(false);
      setSubject("");
      setDescription("");
      setPriority("MEDIUM");
      setCategory("general");
      loadTickets();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
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

  const supportType = supportInfo.support_type || "24/7";
  const supportHoursText = supportType === "24/7" 
    ? "24/7 Support Available" 
    : `${supportInfo.support_hours_start || "09:00"} - ${supportInfo.support_hours_end || "18:00"} (${supportInfo.support_days || "Mon-Fri"})`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Center</h1>
          <p className="text-slate-500 dark:text-white/60 text-sm mt-1">{supportHoursText}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#0891b2]/20"
        >
          + New Ticket
        </button>
      </div>

      {/* Success/Error */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {error && !showCreate && !selectedTicket && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#0891b2]/20 to-[#0e7490]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No tickets yet</h3>
          <p className="text-slate-500 dark:text-white/60 mt-1">Create your first support ticket to get help.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => loadTicketDetail(ticket.id)}
              className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 hover:shadow-lg hover:border-[#0891b2]/30 transition-all cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500 dark:text-white/50">{ticket.ticketNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{ticket.subject}</h3>
                  <p className="text-sm text-slate-500 dark:text-white/60 line-clamp-2 mt-1">{ticket.description}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-500 dark:text-white/50">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                  {ticket._count.replies > 0 && (
                    <p className="text-[#0891b2] font-medium">{ticket._count.replies} replies</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#020617] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Create Support Ticket</h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  minLength={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                  placeholder="Brief summary of your issue"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                  >
                    <option value="general">General</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="account">Account</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0891b2] resize-none"
                  placeholder="Describe your issue in detail..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-[#020617] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500 dark:text-white/50">{selectedTicket.ticketNo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTicket.status]}`}>
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => { setSelectedTicket(null); setError(""); }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Original message */}
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-white text-sm font-medium">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{user?.name}</p>
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
                      ? "bg-[#0f172a]/10 dark:bg-[#0f172a]/30 ml-4"
                      : "bg-slate-50 dark:bg-white/5 mr-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      reply.isAdmin
                        ? "bg-gradient-to-br from-[#0f172a] to-[#3d3778]"
                        : "bg-gradient-to-br from-[#0891b2] to-[#0e7490]"
                    }`}>
                      {reply.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{reply.user.name}</p>
                        {reply.isAdmin && (
                          <span className="px-2 py-0.5 rounded text-xs bg-[#0f172a] text-white">Support</span>
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

            {/* Reply form - only if ticket is not closed */}
            {selectedTicket.status !== "CLOSED" && selectedTicket.status !== "RESOLVED" && (
              <div className="p-6 border-t border-slate-200 dark:border-white/10">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}
                <form onSubmit={handleReply} className="flex gap-3">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] text-white font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {sendingReply ? "..." : "Send"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
