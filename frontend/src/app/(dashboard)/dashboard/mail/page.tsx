"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";

interface MailAgentConfig {
  enabled: boolean;
  provider: string;
  smtp: { host: string; port: number };
  imap?: { host: string; port: number };
  fromEmail: string;
}

interface FolderItem {
  key: string;
  label: string;
  path: string;
  count: number;
  unread: number;
}

interface MailboxOption {
  id: string;
  label: string;
  email: string;
  kind: "personal" | "assigned";
}

interface MailItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  folder: string;
}

interface MessagesResponse {
  items: MailItem[];
  hasMore: boolean;
  page: number;
  total: number;
}

interface MessageDetail {
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

interface SendAttachment {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function getFolderIcon(label: string, path: string): string {
  const value = `${label} ${path}`.toUpperCase();
  if (value.includes("INBOX")) return "📥";
  if (value.includes("SENT")) return "📤";
  if (value.includes("DRAFT")) return "📝";
  if (value.includes("TRASH") || value.includes("BIN")) return "🗑️";
  if (value.includes("SPAM") || value.includes("JUNK")) return "🚫";
  if (value.includes("ARCHIVE")) return "🗄️";
  if (value.includes("IMPORTANT")) return "❗";
  if (value.includes("STAR")) return "⭐";
  return "✉️";
}

interface MailListCache {
  messages: MailItem[];
  selectedMessageId: string;
  page: number;
  hasMore: boolean;
  savedAt: number;
}

function cacheKey(folder: string, query: string): string {
  return `maildash:${folder}:${query.trim().toLowerCase()}`;
}

export default function AdminMailPage() {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [syncingMessages, setSyncingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [config, setConfig] = useState<MailAgentConfig | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderPath, setFolderPath] = useState("INBOX");

  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [mailboxId, setMailboxId] = useState("");

  const [messages, setMessages] = useState<MailItem[]>([]);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState("");
  const [composeEditorHasContent, setComposeEditorHasContent] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<SendAttachment[]>([]);
  const composeEditorRef = useRef<HTMLDivElement | null>(null);
  const [compactFolders, setCompactFolders] = useState(false);
  const [compactList, setCompactList] = useState(false);
  const [newMailNotice, setNewMailNotice] = useState("");
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(() => messages.filter((m) => m.unread).length, [messages]);
  const allSelected = messages.length > 0 && selectedIds.length === messages.length;

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setError("");
    try {
      const [runtime, folderRes, mailboxRes] = await Promise.all([
        apiGet<MailAgentConfig>("/mail/runtime"),
        apiGet<{ items: FolderItem[] }>("/mail/folders"),
        apiGet<{ items: MailboxOption[] }>("/mail/mailboxes"),
      ]);
      setConfig(runtime);
      const folderItems = folderRes.items || [];
      setFolders(folderItems);
      if (folderItems.length > 0) {
        setFolderPath((prev) => prev || folderItems[0].path || folderItems[0].key);
      }
      setMailboxes(mailboxRes.items || []);
      setMailboxId((prev) => prev || mailboxRes.items?.[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mail configuration.");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (page = 1, append = false, silent = false) => {
      if (!folderPath) return;
      if (append) {
        setLoadingMore(true);
      } else if (silent) {
        setSyncingMessages(true);
      } else {
        setLoadingMessages(true);
      }
      setError("");
      try {
        const params = new URLSearchParams({
          folder: folderPath,
          search: query,
          limit: "40",
          page: String(page),
        });
        const res = await apiGet<MessagesResponse>(`/mail/messages?${params.toString()}`);
        const nextItems = res.items || [];
        if (!append && !silent) {
          notifiedIdsRef.current = new Set(nextItems.map((i) => `${i.folder}:${i.id}`));
        }
        setMessages((prev) => {
          if (append) return [...prev, ...nextItems];
          if (!silent) return nextItems;
          // Silent refresh: merge in new messages on top while keeping current view state.
          const byId = new Map<string, MailItem>();
          for (const item of prev) byId.set(item.id, item);
          for (const item of nextItems) byId.set(item.id, item);
          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const newOnes = nextItems.filter((item) => !notifiedIdsRef.current.has(`${item.folder}:${item.id}`));
          if (newOnes.length > 0) {
            setNewMailNotice(`${newOnes.length} new email${newOnes.length > 1 ? "s" : ""} received`);
            for (const n of newOnes) notifiedIdsRef.current.add(`${n.folder}:${n.id}`);
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              const top = newOnes[0];
              new Notification("New email received", { body: `${top.from}: ${top.subject}` });
            }
          }
          return merged.slice(0, 200);
        });
        setMessagesPage(res.page || page);
        setHasMoreMessages(Boolean(res.hasMore));
        if (!append && nextItems.length > 0) {
          setSelectedMessageId(nextItems[0].id);
        }
        if (!append && nextItems.length === 0) {
          setSelectedMessageId("");
          setSelectedMessage(null);
        }
        if (!append && typeof window !== "undefined") {
          const payload: MailListCache = {
            messages: nextItems,
            selectedMessageId: nextItems[0]?.id || "",
            page: res.page || page,
            hasMore: Boolean(res.hasMore),
            savedAt: Date.now(),
          };
          window.localStorage.setItem(cacheKey(folderPath, query), JSON.stringify(payload));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages.");
        if (!append) {
          setMessages([]);
          setSelectedMessageId("");
          setSelectedMessage(null);
        }
      } finally {
      if (append) setLoadingMore(false);
        else if (silent) setSyncingMessages(false);
        else setLoadingMessages(false);
      }
    },
    [folderPath, query]
  );

  const loadDetail = useCallback(
    async (messageId: string) => {
      if (!messageId || !folderPath) return;
      setLoadingDetail(true);
      try {
        const params = new URLSearchParams({ folder: folderPath });
        const detail = await apiGet<MessageDetail>(`/mail/message/${encodeURIComponent(messageId)}?${params.toString()}`);
        setSelectedMessage(detail);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load message detail.");
        setSelectedMessage(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [folderPath]
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config?.enabled && folderPath) {
      setSelectedIds([]);
      setNewMailNotice("");
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(cacheKey(folderPath, query));
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as MailListCache;
            setMessages(parsed.messages || []);
            setSelectedMessageId(parsed.selectedMessageId || parsed.messages?.[0]?.id || "");
            setMessagesPage(parsed.page || 1);
            setHasMoreMessages(Boolean(parsed.hasMore));
          } catch {
            // ignore invalid cache
          }
        }
      }
      void loadMessages(1, false);
    }
  }, [config?.enabled, folderPath, query, loadMessages]);

  useEffect(() => {
    if (!config?.enabled || !folderPath) return;
    const timer = window.setInterval(() => {
      void loadMessages(1, false, true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [config?.enabled, folderPath, query, loadMessages]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (selectedMessageId) {
      void loadDetail(selectedMessageId);
    }
  }, [selectedMessageId, loadDetail]);

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? messages.map((m) => m.id) : []);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function deleteMessage(id: string) {
    try {
      await apiDelete(`/mail/message/${encodeURIComponent(id)}?folder=${encodeURIComponent(folderPath)}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (selectedMessageId === id) {
        setSelectedMessageId("");
        setSelectedMessage(null);
      }
      if (typeof window !== "undefined") {
        const key = cacheKey(folderPath, query);
        const raw = window.localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as MailListCache;
            const next = { ...parsed, messages: (parsed.messages || []).filter((m) => m.id !== id) };
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch {
            // ignore invalid cache
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete email.");
      throw e;
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    for (const id of ids) {
      // Keep IMAP operations sequentially to reduce mailbox lock contention.
      // eslint-disable-next-line no-await-in-loop
      await deleteMessage(id);
    }
    setSuccess("Selected emails moved to trash.");
    setSelectedIds([]);
  }

  function markSelectedRead(read: boolean) {
    if (selectedIds.length === 0) return;
    setMessages((prev) => prev.map((m) => (selectedIds.includes(m.id) ? { ...m, unread: !read } : m)));
    setSuccess(read ? "Selected emails marked as read." : "Selected emails marked as unread.");
    setSelectedIds([]);
  }

  async function handleAttachmentFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: SendAttachment[] = [];
    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const encoded = result.includes(",") ? result.split(",")[1] || "" : result;
          resolve(encoded);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      next.push({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: base64,
      });
    }
    setComposeAttachments((prev) => [...prev, ...next]);
  }

  async function handleSend() {
    const html = composeHtml.trim();
    const text = stripHtml(html);
    if (!composeTo || !composeSubject || (!html && !text)) {
      setError("To, subject and body are required.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      await apiPost("/mail/send", {
        to: composeTo,
        cc: composeCc || undefined,
        bcc: composeBcc || undefined,
        subject: composeSubject,
        html,
        text,
        attachments: composeAttachments,
      });
      setSuccess("Email sent successfully.");
      setComposeOpen(false);
      setComposeMinimized(false);
      setShowCcBcc(false);
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject("");
      setComposeHtml("");
      setComposeEditorHasContent(false);
      setComposeAttachments([]);
      void loadConfig();
      void loadMessages(1, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!composeOpen || composeMinimized || !composeEditorRef.current) return;
    composeEditorRef.current.innerHTML = composeHtml || "<p><br></p>";
    setComposeEditorHasContent(stripHtml(composeEditorRef.current.innerHTML).length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen, composeMinimized]);

  function syncComposeEditor() {
    if (!composeEditorRef.current) return;
    const html = composeEditorRef.current.innerHTML;
    setComposeHtml(html);
    setComposeEditorHasContent(stripHtml(html).length > 0);
  }

  function applyComposeCommand(command: string, value?: string) {
    if (!composeEditorRef.current) return;
    composeEditorRef.current.focus();
    document.execCommand(command, false, value);
    syncComposeEditor();
  }

  const gridClassName =
    compactFolders && compactList
      ? "grid xl:grid-cols-[84px_320px_1fr] gap-4 h-full min-h-0"
      : compactFolders
        ? "grid xl:grid-cols-[84px_420px_1fr] gap-4 h-full min-h-0"
        : compactList
          ? "grid xl:grid-cols-[250px_320px_1fr] gap-4 h-full min-h-0"
          : "grid xl:grid-cols-[250px_420px_1fr] gap-4 h-full min-h-0";

  return (
    <div className="space-y-4 h-[calc(100vh-9rem)] min-h-[640px] overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Mail Workspace</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dynamic folders, full email preview, attachments and compose with attachments.
          </p>
        </div>
        <div className="flex gap-2">
          {syncingMessages && (
            <div className="inline-flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500">
              <span className="inline-block h-3.5 w-3.5 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
              Syncing
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              void loadConfig();
              void loadMessages(1, false);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setComposeMinimized(false);
            }}
            className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
          >
            Compose
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {newMailNotice && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-4 py-3 text-sm flex items-center justify-between">
          <span>{newMailNotice}</span>
          <button
            type="button"
            onClick={() => setNewMailNotice("")}
            className="ml-3 text-indigo-600 dark:text-indigo-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!loadingConfig && config && !config.enabled && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm">
          Mail Agent is disabled. Enable it from Settings -&gt; Mail Agent.
        </div>
      )}

      <div className={gridClassName}>
        <aside className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 h-full min-h-0 overflow-hidden flex flex-col">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              {!compactFolders && <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Mailbox</label>}
              <button
                type="button"
                onClick={() => setCompactFolders((v) => !v)}
                className="ml-auto px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                title={compactFolders ? "Expand folders" : "Compact folders"}
              >
                {compactFolders ? ">>" : "<<"}
              </button>
            </div>
            {!compactFolders && (
              <select
                value={mailboxId}
                onChange={(e) => setMailboxId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                {mailboxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.label} ({box.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setComposeMinimized(false);
            }}
            className={`rounded-xl bg-teal-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-teal-700 ${compactFolders ? "w-10 h-10 p-0 self-center" : "w-full"}`}
          >
            {compactFolders ? "+" : "+ Compose"}
          </button>

          <nav className="space-y-1 overflow-y-auto min-h-0 pr-1">
            {folders.map((f) => {
              const active = folderPath === f.path;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFolderPath(f.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    active
                      ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="inline-flex items-center gap-2" title={f.label}>
                    <span aria-hidden>{getFolderIcon(f.label, f.path)}</span>
                    {!compactFolders && <span>{f.label}</span>}
                  </span>
                  {!compactFolders && (
                    <span className="text-xs">
                      {f.count}
                      {f.unread > 0 ? ` (${f.unread})` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 h-full min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markSelectedRead(true)}
                disabled={selectedIds.length === 0}
                className="h-8 w-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center"
                title="Mark Read"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => markSelectedRead(false)}
                disabled={selectedIds.length === 0}
                className="h-8 w-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center"
                title="Mark Unread"
              >
                ●
              </button>
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={selectedIds.length === 0}
                className="h-8 w-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center"
                title="Delete selected"
              >
                🗑
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCompactList((v) => !v)}
              className="h-8 w-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center"
              title={compactList ? "Expand list panel" : "Compact list panel"}
            >
              {compactList ? "⤢" : "⤡"}
            </button>
          </div>
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setQuery(queryInput.trim());
                }}
                placeholder="Search by sender, subject, recipient..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setQuery(queryInput.trim())}
                className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              Select all
            </label>
            <span>
              {messages.length} emails • {unreadCount} unread
            </span>
          </div>

          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-1 min-h-0">
            {(loadingMessages || loadingMore || syncingMessages) && (
              <div className="absolute right-3 top-3 z-10 h-4 w-4 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
            )}
            {loadingMessages ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading emails...</div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No emails found for this folder.</div>
            ) : (
              <div className="h-full overflow-y-auto">
                {messages.map((m) => {
                  const active = selectedMessageId === m.id;
                  const checked = selectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMessageId(m.id)}
                      className={`px-3 py-3 border-b border-slate-200 dark:border-slate-800 last:border-0 transition-colors cursor-pointer ${
                        active ? "bg-teal-50 dark:bg-teal-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelected(m.id);
                          }}
                          className="mt-1 rounded border-slate-300 dark:border-slate-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate ${m.unread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                              {m.from}
                            </p>
                            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {new Date(m.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${m.unread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                            {m.subject}
                          </p>
                          {!compactList && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.snippet}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!loadingMessages && messages.length > 0 && (
            <div className="pt-1">
              {hasMoreMessages ? (
                <button
                  type="button"
                  onClick={() => void loadMessages(messagesPage + 1, true)}
                  disabled={loadingMore}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  {loadingMore ? "Loading older emails..." : "Load Older Emails"}
                </button>
              ) : (
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 py-2">All older emails loaded.</p>
              )}
            </div>
          )}
        </section>

        <section className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 h-full min-h-0 overflow-hidden">
          {loadingDetail && (
            <div className="absolute right-4 top-4 z-10 h-4 w-4 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
          )}
          {loadingDetail ? (
            <div className="h-full min-h-[520px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Loading message...
            </div>
          ) : !selectedMessage ? (
            <div className="h-full min-h-[520px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Select an email to preview.
            </div>
          ) : (
            <div className="space-y-4 h-full min-h-0 overflow-y-auto pr-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 break-words">{selectedMessage.subject}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(selectedMessage.date).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void deleteMessage(selectedMessage.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeOpen(true);
                      setComposeMinimized(false);
                      setComposeTo(selectedMessage.from.includes("<") ? selectedMessage.from.split("<").pop()?.replace(">", "").trim() || "" : "");
                      setComposeSubject(selectedMessage.subject.startsWith("Re:") ? selectedMessage.subject : `Re: ${selectedMessage.subject}`);
                      setComposeHtml(
                        `<p><br/></p><p>On ${new Date(selectedMessage.date).toLocaleString()}, ${selectedMessage.from} wrote:</p><blockquote style="margin:0;padding-left:12px;border-left:2px solid #d1d5db;">${(selectedMessage.html || selectedMessage.text || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")}</blockquote>`
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeOpen(true);
                      setComposeMinimized(false);
                      setComposeSubject(selectedMessage.subject.startsWith("Fwd:") ? selectedMessage.subject : `Fwd: ${selectedMessage.subject}`);
                      setComposeHtml(
                        `<p><br/></p><p>--- Forwarded message ---</p><p><b>From:</b> ${selectedMessage.from}</p><p><b>To:</b> ${selectedMessage.to}</p><p><b>Subject:</b> ${selectedMessage.subject}</p><p><br/></p><pre>${(selectedMessage.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Forward
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1 text-sm">
                <p><span className="text-slate-500 dark:text-slate-400">From:</span> {selectedMessage.from}</p>
                <p><span className="text-slate-500 dark:text-slate-400">To:</span> {selectedMessage.to}</p>
                {selectedMessage.cc !== "-" && <p><span className="text-slate-500 dark:text-slate-400">Cc:</span> {selectedMessage.cc}</p>}
                {selectedMessage.bcc !== "-" && <p><span className="text-slate-500 dark:text-slate-400">Bcc:</span> {selectedMessage.bcc}</p>}
              </div>

              {selectedMessage.attachments.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Attachments</h3>
                  <div className="space-y-1">
                    {selectedMessage.attachments.map((a) => (
                      <a
                        key={`${selectedMessage.id}-${a.index}`}
                        href={`${API_URL}/mail/message/${encodeURIComponent(selectedMessage.id)}/attachments/${a.index}?folder=${encodeURIComponent(selectedMessage.folder)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        {a.fileName} ({Math.ceil(a.size / 1024)} KB)
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                {selectedMessage.html ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">{selectedMessage.text}</pre>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {composeOpen && (
        <div className="fixed z-50 bottom-4 right-4 w-[95vw] md:w-[620px] shadow-2xl">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Message</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setComposeMinimized((v) => !v)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title={composeMinimized ? "Expand" : "Minimize"}
                >
                  {composeMinimized ? "+" : "-"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposeOpen(false);
                    setComposeMinimized(false);
                  }}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="Close"
                >
                  x
                </button>
              </div>
            </div>

            {!composeMinimized && (
              <div className="p-3 space-y-2">
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Recipients"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowCcBcc((v) => !v)}
                      className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                    >
                      {showCcBcc ? "Hide Cc/Bcc" : "Add Cc/Bcc"}
                    </button>
                    <label className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                      Attach
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          void handleAttachmentFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {showCcBcc && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Cc"
                        value={composeCc}
                        onChange={(e) => setComposeCc(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="Bcc"
                        value={composeBcc}
                        onChange={(e) => setComposeBcc(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Subject"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-1 bg-slate-50 dark:bg-slate-800/50">
                    <button type="button" onClick={() => applyComposeCommand("undo")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Undo</button>
                    <button type="button" onClick={() => applyComposeCommand("redo")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Redo</button>
                    <button type="button" onClick={() => applyComposeCommand("bold")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">B</button>
                    <button type="button" onClick={() => applyComposeCommand("italic")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">I</button>
                    <button type="button" onClick={() => applyComposeCommand("underline")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">U</button>
                    <button type="button" onClick={() => applyComposeCommand("insertUnorderedList")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">UL</button>
                    <button type="button" onClick={() => applyComposeCommand("insertOrderedList")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">OL</button>
                    <button type="button" onClick={() => applyComposeCommand("justifyLeft")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Left</button>
                    <button type="button" onClick={() => applyComposeCommand("justifyCenter")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Center</button>
                    <button type="button" onClick={() => applyComposeCommand("justifyRight")} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Right</button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = window.prompt("Enter link URL");
                        if (url) applyComposeCommand("createLink", url);
                      }}
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700"
                    >
                      Link
                    </button>
                  </div>
                  <div className="relative">
                    {!composeEditorHasContent && (
                      <p className="absolute left-3 top-2 text-sm text-slate-400 pointer-events-none">Compose email...</p>
                    )}
                    <div
                      ref={composeEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck
                      onInput={syncComposeEditor}
                      className="min-h-[220px] max-h-[320px] overflow-auto px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {composeAttachments.map((a, idx) => (
                      <span
                        key={`${a.fileName}-${idx}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
                      >
                        {a.fileName}
                        <button
                          type="button"
                          onClick={() => setComposeAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-500"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTo("");
                      setComposeCc("");
                      setComposeBcc("");
                      setComposeSubject("");
                      setComposeHtml("");
                      setComposeAttachments([]);
                      setComposeEditorHasContent(false);
                      if (composeEditorRef.current) composeEditorRef.current.innerHTML = "<p><br></p>";
                    }}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
