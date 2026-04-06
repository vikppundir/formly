"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type DistributionMap = Record<string, number>;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface User360Response {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalAccounts: number;
    totalRelatedAccounts?: number;
    totalServiceRequests: number;
    paidServiceRequests: number;
    totalSupportTickets: number;
    openSupportTickets: number;
    totalConsents: number;
    totalRentalProperties: number;
    checklistDocumentCount: number;
    lifetimeValue: number;
  };
  charts: {
    accountTypeDistribution: DistributionMap;
    serviceStatusDistribution: DistributionMap;
    monthlyRequests: Array<{ month: string; count: number }>;
    yearlySpend: Array<{ year: string; amount: number }>;
  };
  data: {
    accounts: Array<{
      id: string;
      name: string;
      accountType: string;
      status: string;
      createdAt: string;
      userId?: string;
      individualProfile?: Record<string, unknown> | null;
      companyProfile?: Record<string, unknown> | null;
      trustProfile?: Record<string, unknown> | null;
      partnershipProfile?: Record<string, unknown> | null;
      _count: {
        accountServices: number;
        legalConsents: number;
        companyPartners: number;
        partnershipPartners: number;
        trustPartners: number;
      };
    }>;
    roleLinks: Array<{
      relationType: string;
      role: string;
      status: string;
      email: string;
      invitedAt: string;
      respondedAt: string | null;
      account: {
        id: string;
        name: string;
        accountType: string;
        status: string;
        userId: string;
      };
    }>;
    accountUserLinks: Array<{
      account: {
        id: string;
        name: string;
        accountType: string;
        status: string;
        ownerId: string;
        ownerName: string;
        ownerEmail: string;
        createdAt: string;
      };
      counts: {
        totalUsers: number;
        approvedUsers: number;
        pendingUsers: number;
        directors: number;
        shareholders: number;
        trustees: number;
        beneficiaries: number;
      };
      users: Array<{
        relationType: string;
        role: string;
        status: string;
        email: string;
        name: string | null;
        userId: string | null;
        invitedAt: string | null;
        respondedAt: string | null;
        isDirector: boolean;
        isShareholder: boolean;
      }>;
    }>;
    serviceRequests: Array<{
      id: string;
      status: string;
      paymentStatus: string;
      financialYear: string | null;
      notes: string | null;
      purchasedAt: string;
      completedAt: string | null;
      price: number | string;
      paymentAmount: number | string | null;
      currency: string | null;
      account: {
        id: string;
        name: string;
      };
      service: {
        id: string;
        name: string;
        code: string;
        category: string | null;
      };
    }>;
    supportTickets: Array<{
      id: string;
      ticketNo: string;
      subject: string;
      status: string;
      priority: string;
      category: string | null;
      createdAt: string;
      _count: { replies: number };
    }>;
    legalConsents: Array<{
      id: string;
      consentType: string;
      acceptedAt: string;
      account: { id: string; name: string; accountType: string } | null;
    }>;
  };
}

interface MailFolderItem {
  key: string;
  label: string;
  path: string;
  count: number;
  unread: number;
}

interface MailMessageItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
  folder: string;
  snippet: string;
}

interface MailMessageDetail {
  id: string;
  folder: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  unread: boolean;
  text: string;
  html: string;
  attachments: Array<{
    index: number;
    fileName: string;
    mimeType: string;
    size: number;
  }>;
}

interface ComposeAttachment {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
  size: number;
}

interface MailCachePayload {
  folders: MailFolderItem[];
  messages: MailMessageItem[];
  savedAt: number;
}

function formatCurrency(amount: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeDisplayNotes(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return parsed.text;
    }
    return raw;
  } catch {
    return raw;
  }
}

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function getMailCacheKey(userId: string): string {
  return `mail360:${userId}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const base64 = value.includes(",") ? value.split(",")[1] || "" : value;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function User360Page() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<User360Response | null>(null);
  const [serviceStatusFilter, setServiceStatusFilter] = useState("ALL");
  const [servicePaymentFilter, setServicePaymentFilter] = useState("ALL");
  const [serviceSearch, setServiceSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("ALL");
  const [ticketSearch, setTicketSearch] = useState("");
  const [consentTypeFilter, setConsentTypeFilter] = useState("ALL");

  const [mailLoading, setMailLoading] = useState(false);
  const [mailError, setMailError] = useState("");
  const [mailFolders, setMailFolders] = useState<MailFolderItem[]>([]);
  const [mailFolderFilter, setMailFolderFilter] = useState("ALL");
  const [mailSearch, setMailSearch] = useState("");
  const [mailMessages, setMailMessages] = useState<MailMessageItem[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessageDetail | null>(null);
  const [mailDetailLoading, setMailDetailLoading] = useState(false);
  const [mailSyncing, setMailSyncing] = useState(false);
  const [mailSendTo, setMailSendTo] = useState("");
  const [mailSendCc, setMailSendCc] = useState("");
  const [mailSendBcc, setMailSendBcc] = useState("");
  const [mailSendSubject, setMailSendSubject] = useState("");
  const [mailSendBody, setMailSendBody] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<ComposeAttachment[]>([]);
  const [mailSending, setMailSending] = useState(false);
  const [mailSendMessage, setMailSendMessage] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"rich" | "html">("rich");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [editorHasContent, setEditorHasContent] = useState(false);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<User360Response["data"]["serviceRequests"][number] | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<User360Response["data"]["accounts"][number] | null>(null);

  const canAccess = hasPermission("manage_users") || hasPermission("manage_settings");
  const canAccessMail = hasPermission("manage_settings");

  useEffect(() => {
    if (!userId || !canAccess) return;
    let mounted = true;
    setLoading(true);
    setError("");
    apiGet<User360Response>(`/admin/users/${userId}/360`)
      .then((res) => {
        if (mounted) {
          setData(res);
          setMailSendTo(res.user.email || "");
          setMailSendCc("");
          setMailSendBcc("");
          setMailSendSubject("");
          setMailSendBody("");
        }
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load 360 view");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId, canAccess]);

  const uniqueServiceStatuses = useMemo(
    () => Array.from(new Set((data?.data.serviceRequests ?? []).map((r) => r.status))),
    [data]
  );
  const uniquePaymentStatuses = useMemo(
    () => Array.from(new Set((data?.data.serviceRequests ?? []).map((r) => r.paymentStatus))),
    [data]
  );
  const uniqueTicketStatuses = useMemo(
    () => Array.from(new Set((data?.data.supportTickets ?? []).map((t) => t.status))),
    [data]
  );
  const uniqueConsentTypes = useMemo(
    () => Array.from(new Set((data?.data.legalConsents ?? []).map((c) => c.consentType))),
    [data]
  );
  const relatedAccountIds = useMemo(() => {
    const ownerIds = (data?.data.accounts ?? []).map((a) => a.id);
    const linkedIds = (data?.data.roleLinks ?? []).map((r) => r.account.id);
    return Array.from(new Set([...ownerIds, ...linkedIds]));
  }, [data]);

  const filteredServiceRequests = useMemo(() => {
    const all = data?.data.serviceRequests ?? [];
    return all.filter((request) => {
      if (serviceStatusFilter !== "ALL" && request.status !== serviceStatusFilter) return false;
      if (servicePaymentFilter !== "ALL" && request.paymentStatus !== servicePaymentFilter) return false;
      if (!serviceSearch.trim()) return true;
      const q = serviceSearch.toLowerCase();
      const notes = normalizeDisplayNotes(request.notes).toLowerCase();
      return (
        request.service.name.toLowerCase().includes(q) ||
        request.service.code.toLowerCase().includes(q) ||
        request.account.name.toLowerCase().includes(q) ||
        request.id.toLowerCase().includes(q) ||
        notes.includes(q)
      );
    });
  }, [data, serviceStatusFilter, servicePaymentFilter, serviceSearch]);

  const filteredTickets = useMemo(() => {
    const all = data?.data.supportTickets ?? [];
    return all.filter((ticket) => {
      if (ticketStatusFilter !== "ALL" && ticket.status !== ticketStatusFilter) return false;
      if (!ticketSearch.trim()) return true;
      const q = ticketSearch.toLowerCase();
      return (
        ticket.ticketNo.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q) ||
        (ticket.category || "").toLowerCase().includes(q)
      );
    });
  }, [data, ticketStatusFilter, ticketSearch]);

  const filteredConsents = useMemo(() => {
    const all = data?.data.legalConsents ?? [];
    return all.filter((consent) => {
      if (consentTypeFilter !== "ALL" && consent.consentType !== consentTypeFilter) return false;
      return true;
    });
  }, [data, consentTypeFilter]);

  async function loadMailConversations(options?: { silent?: boolean }) {
    if (!data?.user.email || !canAccessMail) return;
    if (options?.silent) {
      setMailSyncing(true);
    } else {
      setMailLoading(true);
    }
    setMailError("");
    if (!options?.silent) setSelectedMail(null);
    try {
      const folderResponse = await apiGet<{ items: MailFolderItem[] }>("/mail/folders");
      const folders = folderResponse.items || [];
      setMailFolders(folders);

      const targetFolders =
        mailFolderFilter === "ALL"
          ? folders.map((f) => f.path)
          : [mailFolderFilter];
      const effectiveFolders = targetFolders.length ? targetFolders : ["INBOX"];
      const queries = effectiveFolders.map(async (folder) => {
        const params = new URLSearchParams({
          folder,
          limit: "25",
          page: "1",
          search: mailSearch.trim(),
        });
        const res = await apiGet<{ items: MailMessageItem[] }>(`/mail/messages?${params.toString()}`);
        return (res.items || []).map((item) => ({ ...item, folder }));
      });
      const settled = await Promise.allSettled(queries);
      const merged = settled
        .filter((r): r is PromiseFulfilledResult<MailMessageItem[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);
      const uniq = new Map<string, MailMessageItem>();
      for (const item of merged) {
        const userEmail = data.user.email.toLowerCase();
        const from = item.from.toLowerCase();
        const to = item.to.toLowerCase();
        const includesUser = from.includes(userEmail) || to.includes(userEmail);
        if (!includesUser) continue;
        if (mailSearch.trim()) {
          const q = mailSearch.toLowerCase();
          const bag = `${item.subject} ${item.from} ${item.to} ${item.snippet}`.toLowerCase();
          if (!bag.includes(q)) continue;
        }
        uniq.set(`${item.folder}:${item.id}`, item);
      }
      const sorted = Array.from(uniq.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const previousIds = new Set(mailMessages.map((m) => `${m.folder}:${m.id}`));
      const nextIds = new Set(sorted.map((m) => `${m.folder}:${m.id}`));
      const hasNewMessage = sorted.some((m) => !previousIds.has(`${m.folder}:${m.id}`));

      setMailMessages(sorted);
      const failedCount = settled.filter((r) => r.status === "rejected").length;
      if (failedCount > 0 && sorted.length === 0) {
        setMailError("Mail server returned errors for selected folders. Please verify Mail Agent config.");
      } else if (options?.silent && hasNewMessage && nextIds.size >= previousIds.size) {
        setMailError("");
      }

      if (typeof window !== "undefined" && data?.user.id) {
        const payload: MailCachePayload = {
          folders,
          messages: sorted,
          savedAt: Date.now(),
        };
        window.sessionStorage.setItem(getMailCacheKey(data.user.id), JSON.stringify(payload));
      }
    } catch {
      setMailError("Unable to fetch mailbox right now. Check Mail Agent credentials/server and try Refresh.");
      setMailMessages([]);
    } finally {
      if (options?.silent) {
        setMailSyncing(false);
      } else {
        setMailLoading(false);
      }
    }
  }

  async function openMailDetail(item: MailMessageItem) {
    setMailDetailLoading(true);
    try {
      const params = new URLSearchParams({ folder: item.folder });
      const detail = await apiGet<MailMessageDetail>(
        `/mail/message/${encodeURIComponent(item.id)}?${params.toString()}`
      );
      const userEmail = (data?.user.email || "").toLowerCase();
      const bag = `${detail.from} ${detail.to} ${detail.cc} ${detail.bcc}`.toLowerCase();
      if (userEmail && !bag.includes(userEmail)) {
        setMailError("Selected message is not linked to this user email.");
        setSelectedMail(null);
        return;
      }
      setSelectedMail(detail);
    } catch {
      setMailError("Failed to open this email. Please retry.");
    } finally {
      setMailDetailLoading(false);
    }
  }

  async function sendEmailToUser() {
    const html = (mailSendBody || "").trim();
    const text = stripHtml(html);
    if (!mailSendTo.trim() || !mailSendSubject.trim() || (!html && !text)) {
      setMailSendMessage("To, subject and message are required.");
      return;
    }
    setMailSending(true);
    setMailSendMessage("");
    try {
      await apiPost("/mail/send", {
        to: mailSendTo.trim(),
        cc: mailSendCc.trim() || undefined,
        bcc: mailSendBcc.trim() || undefined,
        subject: mailSendSubject.trim(),
        html,
        text,
        attachments: composeAttachments.map((a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          contentBase64: a.contentBase64,
        })),
      });
      setMailSendMessage("Email sent successfully.");
      setMailSendSubject("");
      setMailSendBody("");
      setMailSendCc("");
      setMailSendBcc("");
      setComposeAttachments([]);
      setComposeOpen(false);
      void loadMailConversations();
    } catch (e) {
      setMailSendMessage(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setMailSending(false);
    }
  }

  useEffect(() => {
    if (!composeOpen || !editorRef.current || composerMode !== "rich") return;
    // Sync once when modal/mode opens; avoid resetting cursor on each keystroke.
    editorRef.current.innerHTML = mailSendBody || "<p><br></p>";
    setEditorHasContent(stripHtml(editorRef.current.innerHTML).length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen, composerMode]);

  function syncEditorHtml() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setMailSendBody(html);
    setEditorHasContent(stripHtml(html).length > 0);
  }

  function applyEditorCommand(command: string, value?: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    syncEditorHtml();
  }

  function setBlock(block: "P" | "H1" | "H2" | "BLOCKQUOTE") {
    applyEditorCommand("formatBlock", block);
  }

  function handleRichInput() {
    syncEditorHtml();
  }

  async function handleComposeAttachments(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files).slice(0, 8);
    try {
      const converted = await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: await fileToBase64(file),
          size: file.size,
        }))
      );
      setComposeAttachments((prev) => [...prev, ...converted].slice(0, 10));
    } catch {
      setMailSendMessage("Unable to read one or more attachments.");
    }
  }

  useEffect(() => {
    if (!data || !canAccessMail) return;
    if (typeof window !== "undefined" && data.user.id) {
      const raw = window.sessionStorage.getItem(getMailCacheKey(data.user.id));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as MailCachePayload;
          if (Array.isArray(parsed.folders)) setMailFolders(parsed.folders);
          if (Array.isArray(parsed.messages)) setMailMessages(parsed.messages);
        } catch {
          // ignore cache parse failure
        }
      }
    }
    void loadMailConversations();
    const timer = window.setInterval(() => {
      void loadMailConversations({ silent: true });
    }, 60000);
    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.user.id, data?.user.email, canAccessMail]);

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User 360 View</h1>
        <p className="text-slate-500 mt-2">You do not have permission to access this view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User 360 View</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Single-page full profile across accounts, requests, notes, support and consent history.
          </p>
        </div>
        <Link
          href="/dashboard/users"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Back to Users
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading 360 view...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{data.user.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{data.user.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{data.user.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{data.user.status}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Joined: {formatDateTime(data.user.createdAt)}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Accounts</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {data.summary.totalRelatedAccounts ?? relatedAccountIds.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Service Requests</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.summary.totalServiceRequests}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Support Tickets</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.summary.totalSupportTickets}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Signed Documents</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.summary.totalConsents}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Checklist Files</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.summary.checklistDocumentCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">Lifetime Value</p>
              <p className="text-xl font-semibold text-emerald-600">{formatCurrency(data.summary.lifetimeValue)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">Emails Found</p>
              <p className="text-xl font-semibold text-indigo-600">{mailMessages.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">Linked Roles</p>
              <p className="text-xl font-semibold text-purple-600">{data.data.roleLinks.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Linked Roles Across Accounts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-xs text-slate-500">Relation</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Role</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Account</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Status</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Email</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Invited</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.roleLinks.map((roleLink, index) => (
                    <tr key={`${roleLink.account.id}-${roleLink.relationType}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{roleLink.relationType}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{roleLink.role}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
                        {roleLink.account.name} ({roleLink.account.accountType})
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{roleLink.status}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{roleLink.email}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(roleLink.invitedAt)}</td>
                    </tr>
                  ))}
                  {data.data.roleLinks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-slate-500 text-center">
                        No external account role links found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Linked Accounts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[820px]">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-xs text-slate-500">Account</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Type</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Status</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Services</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Consents</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Created</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.accounts.map((account) => (
                    <tr key={account.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{account.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{account.id}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{account.accountType}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{account.status}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{account._count.accountServices}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{account._count.legalConsents}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(account.createdAt)}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/dashboard/accounts/${account.id}/360`}
                          className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          View 360
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Account-wise User Matrix (4 Account Types)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-xs text-slate-500">Account</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Type</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Owner</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Total Users</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Directors</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Shareholders</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Trustees</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Beneficiaries</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.accountUserLinks.map((row) => (
                    <tr key={row.account.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{row.account.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{row.account.id}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.account.accountType}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
                        <div>{row.account.ownerName}</div>
                        <div className="text-xs text-slate-500">{row.account.ownerEmail}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.totalUsers}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.directors}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.shareholders}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.trustees}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.beneficiaries}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{row.counts.pendingUsers}</td>
                    </tr>
                  ))}
                  {data.data.accountUserLinks.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-sm text-slate-500 text-center">
                        No account-user links found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Service Requests (Lifetime)</h3>
            </div>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 grid md:grid-cols-4 gap-2">
              <select
                value={serviceStatusFilter}
                onChange={(e) => setServiceStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="ALL">All Status</option>
                {uniqueServiceStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={servicePaymentFilter}
                onChange={(e) => setServicePaymentFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="ALL">All Payment</option>
                {uniquePaymentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <input
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search service/account/id/notes"
                className="md:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-xs text-slate-500">Service</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Account</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Status</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Payment</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Value</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Year</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Notes</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Date</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServiceRequests.map((request) => (
                    <tr key={request.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{request.service.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{request.id}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{request.account.name}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{request.status}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{request.paymentStatus}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
                        {formatCurrency(Number(request.paymentAmount ?? request.price), request.currency ?? "AUD")}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{request.financialYear || "—"}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[320px]">
                        <div className="line-clamp-3">{normalizeDisplayNotes(request.notes) || "—"}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(request.purchasedAt)}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedServiceRequest(request)}
                          className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredServiceRequests.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-sm text-slate-500 text-center">
                        No service requests match current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-medium text-slate-900 dark:text-slate-100">Support Tickets</h3>
              </div>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 grid md:grid-cols-2 gap-2">
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="ALL">All Status</option>
                  {uniqueTicketStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search ticket no / subject"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTickets.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-500">No support tickets found.</p>
                )}
                {filteredTickets.map((ticket) => (
                  <div key={ticket.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{ticket.subject}</p>
                      <span className="text-xs text-slate-500">{ticket.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ticket.ticketNo} · {ticket.priority} · Replies: {ticket._count.replies}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(ticket.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Signed Documents Timeline</h3>
              </div>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <select
                  value={consentTypeFilter}
                  onChange={(e) => setConsentTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="ALL">All Consent Types</option>
                  {uniqueConsentTypes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredConsents.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-500">No consents recorded.</p>
                )}
                {filteredConsents.map((consent) => (
                  <div key={consent.id} className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{consent.consentType}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {consent.account?.name || "Unknown Account"} ({consent.account?.accountType || "—"})
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(consent.acceptedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Email Conversations</h3>
              <div className="flex items-center gap-2">
                {mailSyncing && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className="inline-block h-3 w-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                    Syncing
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void loadMailConversations()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>
            </div>
            {!canAccessMail && (
              <p className="px-4 py-4 text-sm text-slate-500">Mail data requires `manage_settings` permission.</p>
            )}
            {canAccessMail && (
              <>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 grid lg:grid-cols-4 gap-2">
                  <select
                    value={mailFolderFilter}
                    onChange={(e) => setMailFolderFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Folders</option>
                    {mailFolders.map((folder) => (
                      <option key={folder.path} value={folder.path}>
                        {folder.label} ({folder.count})
                      </option>
                    ))}
                  </select>
                  <input
                    value={mailSearch}
                    onChange={(e) => setMailSearch(e.target.value)}
                    placeholder="Extra keyword filter"
                    className="lg:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void loadMailConversations()}
                    className="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700"
                  >
                    Apply Mail Filter
                  </button>
                </div>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMailSendTo(data.user.email || "");
                      setMailSendMessage("");
                      setComposeAttachments([]);
                      setComposeOpen(true);
                    }}
                    className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700"
                  >
                    Compose Email
                  </button>
                  <p className="text-xs text-slate-500">Rich popup editor with formatting and HTML mode.</p>
                </div>

                {mailLoading && <p className="px-4 py-4 text-sm text-slate-500">Loading email conversations...</p>}
                {mailError && <p className="px-4 py-3 text-sm text-red-600">{mailError}</p>}

                <div className="grid lg:grid-cols-[420px_1fr]">
                  <div className="relative border-r border-slate-200 dark:border-slate-800 max-h-[500px] overflow-auto">
                    {mailLoading && (
                      <div className="absolute right-3 top-3 z-10 h-4 w-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                    )}
                    {mailMessages.length === 0 && !mailLoading && (
                      <p className="px-4 py-6 text-sm text-slate-500">No related emails found for this user email.</p>
                    )}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {mailMessages.map((message) => (
                        <button
                          key={`${message.folder}:${message.id}`}
                          type="button"
                          onClick={() => void openMailDetail(message)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <p className="text-xs text-slate-500">{message.folder}</p>
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{message.subject}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{message.from}</p>
                          <p className="text-xs text-slate-500 mt-1">{formatDateTime(message.date)}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative p-4 max-h-[500px] overflow-auto">
                    {mailDetailLoading && (
                      <div className="absolute right-3 top-3 z-10 h-4 w-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                    )}
                    {mailDetailLoading && <p className="text-sm text-slate-500">Loading email detail...</p>}
                    {!mailDetailLoading && !selectedMail && (
                      <p className="text-sm text-slate-500">Select an email to preview full conversation and attachments.</p>
                    )}
                    {!mailDetailLoading && selectedMail && (
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedMail.subject}</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="text-slate-500">From:</span> {selectedMail.from}</p>
                          <p><span className="text-slate-500">To:</span> {selectedMail.to}</p>
                          {selectedMail.cc !== "-" && <p><span className="text-slate-500">Cc:</span> {selectedMail.cc}</p>}
                          <p><span className="text-slate-500">Date:</span> {formatDateTime(selectedMail.date)}</p>
                        </div>
                        {selectedMail.attachments.length > 0 && (
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Attachments</p>
                            <div className="space-y-1">
                              {selectedMail.attachments.map((attachment) => (
                                <a
                                  key={`${selectedMail.id}-${attachment.index}`}
                                  href={`${API_URL}/mail/message/${encodeURIComponent(selectedMail.id)}/attachments/${attachment.index}?folder=${encodeURIComponent(selectedMail.folder)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  {attachment.fileName} ({Math.ceil(attachment.size / 1024)} KB)
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          {selectedMail.html ? (
                            <div
                              className="prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: selectedMail.html }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
                              {selectedMail.text || "No message body."}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {composeOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Compose Email</h4>
                  <button type="button" onClick={() => setComposeOpen(false)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                    Close
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-2">
                    <input
                      value={mailSendTo}
                      onChange={(e) => setMailSendTo(e.target.value)}
                      placeholder="To"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                    <input
                      value={mailSendSubject}
                      onChange={(e) => setMailSendSubject(e.target.value)}
                      placeholder="Subject"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                    <input
                      value={mailSendCc}
                      onChange={(e) => setMailSendCc(e.target.value)}
                      placeholder="Cc (optional)"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                    <input
                      value={mailSendBcc}
                      onChange={(e) => setMailSendBcc(e.target.value)}
                      placeholder="Bcc (optional)"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setComposerMode("rich")} className={`px-3 py-1.5 rounded-lg text-sm ${composerMode === "rich" ? "bg-indigo-600 text-white" : "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"}`}>
                      Rich Editor
                    </button>
                    <button type="button" onClick={() => setComposerMode("html")} className={`px-3 py-1.5 rounded-lg text-sm ${composerMode === "html" ? "bg-indigo-600 text-white" : "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"}`}>
                      HTML Source
                    </button>
                  </div>

                  {composerMode === "rich" && (
                    <>
                      <div className="flex flex-wrap gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50 dark:bg-slate-800/60">
                        <button type="button" onClick={() => applyEditorCommand("undo")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Undo</button>
                        <button type="button" onClick={() => applyEditorCommand("redo")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Redo</button>
                        <button type="button" onClick={() => applyEditorCommand("bold")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">B</button>
                        <button type="button" onClick={() => applyEditorCommand("italic")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">I</button>
                        <button type="button" onClick={() => applyEditorCommand("underline")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">U</button>
                        <button type="button" onClick={() => setBlock("H1")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">H1</button>
                        <button type="button" onClick={() => setBlock("H2")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">H2</button>
                        <button type="button" onClick={() => setBlock("P")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">P</button>
                        <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">UL</button>
                        <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">OL</button>
                        <button type="button" onClick={() => applyEditorCommand("justifyLeft")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Left</button>
                        <button type="button" onClick={() => applyEditorCommand("justifyCenter")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Center</button>
                        <button type="button" onClick={() => applyEditorCommand("justifyRight")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Right</button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.prompt("Enter link URL");
                            if (url) applyEditorCommand("createLink", url);
                          }}
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600"
                        >
                          Link
                        </button>
                        <button type="button" onClick={() => applyEditorCommand("removeFormat")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600">Clear</button>
                      </div>
                      <div className="relative">
                        {!editorHasContent && (
                          <p className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
                            Write your email here...
                          </p>
                        )}
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck
                          onInput={handleRichInput}
                          className="min-h-[320px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {composerMode === "html" && (
                    <textarea
                      value={mailSendBody}
                      onChange={(e) => setMailSendBody(e.target.value)}
                      rows={14}
                      placeholder="<p>Write full HTML email with inline styles...</p>"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm"
                    />
                  )}

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs">Attach files</span>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => void handleComposeAttachments(e.target.files)}
                        className="text-sm"
                      />
                    </label>
                    {composeAttachments.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                        <p className="text-xs text-slate-500 mb-2">Attachments ({composeAttachments.length})</p>
                        <div className="space-y-1">
                          {composeAttachments.map((file, idx) => (
                            <div key={`${file.fileName}-${idx}`} className="flex items-center justify-between text-sm">
                              <span className="truncate">{file.fileName} ({Math.ceil(file.size / 1024)} KB)</span>
                              <button
                                type="button"
                                onClick={() => setComposeAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-red-600 hover:underline text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {mailSendMessage && (
                    <p className={`text-sm ${mailSendMessage.toLowerCase().includes("success") ? "text-emerald-600" : "text-red-600"}`}>
                      {mailSendMessage}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setComposeOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendEmailToUser()}
                      disabled={mailSending}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {mailSending ? "Sending..." : "Send Email"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedServiceRequest && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Service Request Details</h4>
                  <button type="button" onClick={() => setSelectedServiceRequest(null)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Close</button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <p><span className="text-slate-500">Request ID:</span> {selectedServiceRequest.id}</p>
                  <p><span className="text-slate-500">Service:</span> {selectedServiceRequest.service.name} ({selectedServiceRequest.service.code})</p>
                  <p><span className="text-slate-500">Account:</span> {selectedServiceRequest.account.name}</p>
                  <p><span className="text-slate-500">Status:</span> {selectedServiceRequest.status}</p>
                  <p><span className="text-slate-500">Payment:</span> {selectedServiceRequest.paymentStatus}</p>
                  <p><span className="text-slate-500">Amount:</span> {formatCurrency(Number(selectedServiceRequest.paymentAmount ?? selectedServiceRequest.price), selectedServiceRequest.currency ?? "AUD")}</p>
                  <p><span className="text-slate-500">Purchased:</span> {formatDateTime(selectedServiceRequest.purchasedAt)}</p>
                  <div>
                    <p className="text-slate-500 mb-1">Notes:</p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800 p-3 font-sans text-sm">
                      {normalizeDisplayNotes(selectedServiceRequest.notes) || "No notes."}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedAccount && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Account Details</h4>
                  <button type="button" onClick={() => setSelectedAccount(null)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Close</button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <p><span className="text-slate-500">Account ID:</span> {selectedAccount.id}</p>
                  <p><span className="text-slate-500">Name:</span> {selectedAccount.name}</p>
                  <p><span className="text-slate-500">Type:</span> {selectedAccount.accountType}</p>
                  <p><span className="text-slate-500">Status:</span> {selectedAccount.status}</p>
                  <p><span className="text-slate-500">Created:</span> {formatDateTime(selectedAccount.createdAt)}</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">Services: {selectedAccount._count.accountServices}</div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">Consents: {selectedAccount._count.legalConsents}</div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                      Partners: {selectedAccount._count.companyPartners + selectedAccount._count.partnershipPartners + selectedAccount._count.trustPartners}
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Profile Data:</p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800 p-3 font-mono text-xs">
                      {JSON.stringify(
                        selectedAccount.individualProfile ||
                          selectedAccount.companyProfile ||
                          selectedAccount.trustProfile ||
                          selectedAccount.partnershipProfile ||
                          {},
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
