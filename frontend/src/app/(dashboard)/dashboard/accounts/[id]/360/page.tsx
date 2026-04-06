"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type AccountType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Account360Response {
  account: {
    id: string;
    userId: string;
    name: string;
    accountType: AccountType;
    status: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string } | null;
    individualProfile?: Record<string, unknown> | null;
    companyProfile?: Record<string, unknown> | null;
    trustProfile?: Record<string, unknown> | null;
    partnershipProfile?: Record<string, unknown> | null;
  };
  summary: {
    totalLinkedUsers: number;
    totalDirectors: number;
    totalShareholders: number;
    totalTrustees: number;
    totalBeneficiaries: number;
    totalConsents: number;
    totalServices: number;
  };
  data: {
    linkedUsers: Array<{
      relationType: string;
      role: string;
      status: string;
      userId: string | null;
      name: string | null;
      email: string;
      invitedAt: string | null;
      respondedAt: string | null;
      isDirector: boolean;
      isShareholder: boolean;
    }>;
    consents: Array<{
      id: string;
      consentType: string;
      acceptedAt: string;
      documentVersion: string | null;
      signatureData?: string | null;
      signatureType?: string | null;
      signedName?: string | null;
      ipAddress?: string | null;
      user?: { id: string; name: string; email: string } | null;
    }>;
    services: Array<{
      id: string;
      status: string;
      paymentStatus: string;
      financialYear: string | null;
      purchasedAt: string;
      price: number | string;
      paymentAmount: number | string | null;
      notes?: string | null;
      service: { id: string; code: string; name: string; category: string | null };
    }>;
  };
}

interface ChecklistDoc {
  id: string;
  fileName?: string;
  originalName?: string;
  filePath?: string;
  documentType?: string | null;
  createdAt?: string;
}

function formatDateTime(value?: string | null): string {
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

function formatDateOnly(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toSpacedTitle(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatProfileValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const raw = String(value);
  const keyLower = key.toLowerCase();
  if (keyLower.includes("date") || keyLower.includes("dob")) return formatDateOnly(raw);
  if (keyLower.includes("email")) return raw.toLowerCase();
  if (keyLower.includes("status") || keyLower.includes("type") || keyLower.includes("gender")) {
    return raw
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return raw;
}

export default function Account360Page() {
  const params = useParams<{ id: string }>();
  const accountId = params?.id;
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Account360Response | null>(null);
  const [selectedConsent, setSelectedConsent] = useState<Account360Response["data"]["consents"][number] | null>(null);
  const [consentContent, setConsentContent] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<
    Array<{ id: string; text: string; createdAt: string; createdByUserId: string; createdByName: string }>
  >([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const canAccess = hasPermission("manage_users");

  useEffect(() => {
    if (!accountId || !canAccess) return;
    let mounted = true;
    setLoading(true);
    setError("");
    apiGet<Account360Response>(`/admin/accounts/${accountId}/360`)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load account 360");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [accountId, canAccess]);

  useEffect(() => {
    if (!accountId || !canAccess) return;
    apiGet<{ notes: Array<{ id: string; text: string; createdAt: string; createdByUserId: string; createdByName: string }> }>(
      `/admin/accounts/${accountId}/notes`
    )
      .then((res) => setNotes(res.notes || []))
      .catch(() => setNotes([]));
  }, [accountId, canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    apiGet<{ content: Record<string, string> }>("/consents/content")
      .then((res) => setConsentContent(res.content || {}))
      .catch(() => {
        // keep fallback empty map
      });
  }, [canAccess]);

  const profileData = useMemo<Record<string, unknown>>(() => {
    if (!data) return {};
    return (data.account.individualProfile ||
      data.account.companyProfile ||
      data.account.trustProfile ||
      data.account.partnershipProfile ||
      {}) as Record<string, unknown>;
  }, [data]);

  const checklistDocs = useMemo(() => {
    if (!data) return [] as ChecklistDoc[];
    const docs: ChecklistDoc[] = [];
    for (const s of data.data.services) {
      if (!s.notes) continue;
      try {
        const parsed = JSON.parse(s.notes) as {
          checklist?: Record<string, { documents?: ChecklistDoc[] }>;
        };
        const checklist = parsed?.checklist || {};
        for (const entry of Object.values(checklist)) {
          if (!Array.isArray(entry?.documents)) continue;
          for (const doc of entry.documents) docs.push(doc);
        }
      } catch {
        // ignore invalid legacy notes payloads
      }
    }
    return docs;
  }, [data]);

  if (!canAccess) {
    return <p className="text-slate-500">You do not have permission to access this page.</p>;
  }

  function downloadConsent(consent: Account360Response["data"]["consents"][number]) {
    const account = data?.account;
    if (!account) return;
    const individualProfile = (account.individualProfile || null) as Record<string, unknown> | null;
    const companyProfile = (account.companyProfile || null) as Record<string, unknown> | null;
    const trustProfile = (account.trustProfile || null) as Record<string, unknown> | null;
    const partnershipProfile = (account.partnershipProfile || null) as Record<string, unknown> | null;
    const profile = individualProfile || companyProfile || trustProfile || partnershipProfile;

    const clientName =
      (individualProfile
        ? `${String(individualProfile.firstName || "")} ${String(individualProfile.middleName || "")} ${String(individualProfile.lastName || "")}`.trim()
        : String(companyProfile?.companyName || trustProfile?.trustName || partnershipProfile?.partnershipName || account.name)) || account.name;

    const tfn = String(profile?.tfn || "Not provided");
    const abn = String(profile?.abn || "Not provided");
    const address = String(
      individualProfile?.address ||
      companyProfile?.businessAddress ||
      trustProfile?.address ||
      partnershipProfile?.businessAddress ||
      "Not provided"
    );
    const suburb = String(profile?.suburb || "");
    const state = String(profile?.state || "");
    const postcode = String(profile?.postcode || "");
    const fullAddress = [address, suburb, state, postcode].filter(Boolean).join(", ");

    const consentTitle = consent.consentType.replace(/_/g, " ");
    const consentBody =
      consentContent[consent.consentType] ||
      `<p>I accept and sign the consent document: <strong>${consentTitle}</strong>.</p>`;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${consentTitle} - ${clientName}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
          .header h1 { color: #1e40af; margin: 0 0 5px 0; font-size: 22pt; }
          .header h2 { color: #374151; margin: 0; font-size: 13pt; font-weight: normal; }
          .section { margin: 20px 0; }
          .section-title { font-size: 12pt; font-weight: bold; color: #1e40af; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .field-row { display: flex; margin: 8px 0; }
          .field-label { width: 180px; font-weight: bold; color: #4b5563; }
          .field-value { flex: 1; color: #111827; }
          .content-box { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; }
          .signature-box { border: 2px solid #1e40af; padding: 20px; border-radius: 8px; background: #f8fafc; margin-top: 25px; }
          .signature-image { max-width: 300px; max-height: 100px; margin: 15px 0; }
          .signature-typed { font-family: 'Brush Script MT', cursive; font-size: 28pt; color: #1e3a8a; margin: 15px 0; }
          .signature-details { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
          .signature-detail { text-align: center; }
          .signature-detail-label { font-size: 9pt; color: #6b7280; }
          .signature-detail-value { font-weight: bold; color: #111827; }
          .footer { margin-top: 35px; padding-top: 20px; border-top: 2px solid #1e40af; text-align: center; font-size: 9pt; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${consentTitle}</h1>
          <h2>Signed Legal Consent Document</h2>
        </div>

        <div class="section">
          <div class="section-title">Account / Client Details</div>
          <div class="field-row"><span class="field-label">Client Name:</span><span class="field-value">${clientName}</span></div>
          <div class="field-row"><span class="field-label">Account Name:</span><span class="field-value">${account.name}</span></div>
          <div class="field-row"><span class="field-label">Account Type:</span><span class="field-value">${account.accountType}</span></div>
          <div class="field-row"><span class="field-label">TFN:</span><span class="field-value">${tfn}</span></div>
          <div class="field-row"><span class="field-label">ABN:</span><span class="field-value">${abn}</span></div>
          <div class="field-row"><span class="field-label">Address:</span><span class="field-value">${fullAddress || "Not provided"}</span></div>
        </div>

        <div class="content-box">
          ${consentBody}
        </div>

        <div class="signature-box">
          <p>I confirm that I have read and accepted this consent document.</p>
          ${
            consent.signatureType === "draw" && consent.signatureData
              ? `<img src="${consent.signatureData}" alt="Signature" class="signature-image" />`
              : consent.signedName
                ? `<div class="signature-typed">${consent.signedName}</div>`
                : '<div style="height: 60px; border-bottom: 1px solid #000; margin: 20px 0;"></div>'
          }
          <div class="signature-details">
            <div class="signature-detail">
              <div class="signature-detail-label">Signed By</div>
              <div class="signature-detail-value">${consent.user?.name || clientName}</div>
            </div>
            <div class="signature-detail">
              <div class="signature-detail-label">Date Signed</div>
              <div class="signature-detail-value">${new Date(consent.acceptedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
            <div class="signature-detail">
              <div class="signature-detail-label">IP Address</div>
              <div class="signature-detail-value">${consent.ipAddress || "N/A"}</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Document ID: ${consent.id}</p>
          <p>Generated on ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })} at ${new Date().toLocaleTimeString()}</p>
          <p>This document was digitally signed and is legally binding.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    }
  }

  async function addNote() {
    if (!accountId || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`${API_URL}/admin/accounts/${accountId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: newNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save note");
      setNotes(data.notes || []);
      setNewNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Account 360 View</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Account-wise linked users, directors, documents and services.</p>
        </div>
        <Link href="/dashboard/accounts" className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
          Back to Accounts
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading account 360...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-xs text-slate-500">Account</p><p className="font-medium">{data.account.name}</p></div>
              <div><p className="text-xs text-slate-500">Type</p><p className="font-medium">{data.account.accountType}</p></div>
              <div><p className="text-xs text-slate-500">Status</p><p className="font-medium">{data.account.status}</p></div>
              <div><p className="text-xs text-slate-500">Owner</p><p className="font-medium">{data.account.user?.name || "—"}</p></div>
            </div>
            <p className="text-xs text-slate-500 mt-3 font-mono">{data.account.id}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Linked Users</p><p className="text-xl font-semibold">{data.summary.totalLinkedUsers}</p></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Directors</p><p className="text-xl font-semibold">{data.summary.totalDirectors}</p></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Shareholders</p><p className="text-xl font-semibold">{data.summary.totalShareholders}</p></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Trustees</p><p className="text-xl font-semibold">{data.summary.totalTrustees}</p></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Beneficiaries</p><p className="text-xl font-semibold">{data.summary.totalBeneficiaries}</p></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><p className="text-xs text-slate-500">Signed Docs</p><p className="text-xl font-semibold">{data.summary.totalConsents}</p></div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium">Linked Users (Owner + Directors/Partners/Trust Roles)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-xs text-slate-500">Name</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Email</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Relation</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Role</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Status</th>
                    <th className="px-4 py-2 text-xs text-slate-500">Invited</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.linkedUsers.map((u, idx) => (
                    <tr key={`${u.email}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 text-sm">{u.name || "—"}</td>
                      <td className="px-4 py-2 text-sm">
                        {u.userId ? (
                          <Link href={`/dashboard/users/${u.userId}/360`} className="text-violet-600 dark:text-violet-400 hover:underline">
                            {u.email}
                          </Link>
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">{u.relationType}</td>
                      <td className="px-4 py-2 text-sm">{u.role}</td>
                      <td className="px-4 py-2 text-sm">{u.status}</td>
                      <td className="px-4 py-2 text-sm">{formatDateTime(u.invitedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium">Account Notes</h3>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Add admin note for this account..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={savingNote || !newNote.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingNote ? "Saving..." : "Add Note"}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notes.length === 0 && <p className="text-sm text-slate-500 py-2">No notes yet.</p>}
                {notes.map((n) => (
                  <div key={n.id} className="py-3">
                    <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{n.text}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {n.createdByName} · {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800"><h3 className="font-medium">Signed Documents / Consents</h3></div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.consents.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No signed documents.</p>}
                {data.data.consents.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{c.consentType}</p>
                      <p className="text-xs text-slate-500">{c.user?.name || "Unknown"} · {formatDateTime(c.acceptedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedConsent(c)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadConsent(c)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800"><h3 className="font-medium">Services on this Account</h3></div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.services.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No services purchased.</p>}
                {data.data.services.map((s) => (
                  <div key={s.id} className="px-4 py-3">
                    <p className="font-medium text-sm">{s.service.name}</p>
                    <p className="text-xs text-slate-500">{s.status} · {s.paymentStatus} · {formatDateTime(s.purchasedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800"><h3 className="font-medium">Profile Details</h3></div>
            <div className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
              {Object.entries(profileData)
                .filter(
                  ([k, v]) =>
                    v !== null &&
                    v !== "" &&
                    typeof v !== "object" &&
                    !k.toLowerCase().includes("hash")
                )
                .slice(0, 18)
                .map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                    <p className="text-xs text-slate-500">{toSpacedTitle(k)}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{formatProfileValue(k, v)}</p>
                  </div>
                ))}
              {Object.entries(profileData).every(([, v]) => v === null || v === "" || typeof v === "object") && (
                <p className="text-slate-500">No profile fields available.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium">Account Related Files</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {checklistDocs.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-500">No checklist files found for this account.</p>
              )}
              {checklistDocs.map((doc, idx) => {
                const fileName = doc.originalName || doc.fileName || "Document";
                const rawPath = doc.filePath || "";
                const href = rawPath
                  ? rawPath.startsWith("http")
                    ? rawPath
                    : `${API_URL}${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`
                  : "";
                return (
                  <div key={`${doc.id || fileName}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{fileName}</p>
                      <p className="text-xs text-slate-500">
                        {doc.documentType || "Document"} · {formatDateTime(doc.createdAt || null)}
                      </p>
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No file path</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selectedConsent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Consent Details</h4>
              <button type="button" onClick={() => setSelectedConsent(null)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Close
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <p><span className="text-slate-500">Consent:</span> {selectedConsent.consentType}</p>
              <p><span className="text-slate-500">Accepted:</span> {formatDateTime(selectedConsent.acceptedAt)}</p>
              <p><span className="text-slate-500">Version:</span> {selectedConsent.documentVersion || "—"}</p>
              <p><span className="text-slate-500">Signed by:</span> {selectedConsent.signedName || selectedConsent.user?.name || "—"}</p>
              <p><span className="text-slate-500">Email:</span> {selectedConsent.user?.email || "—"}</p>
              <p><span className="text-slate-500">IP:</span> {selectedConsent.ipAddress || "—"}</p>
              {selectedConsent.signatureType === "draw" && selectedConsent.signatureData && (
                <div>
                  <p className="text-slate-500 mb-2">Signature</p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
                    <img src={selectedConsent.signatureData} alt="Signature" className="max-h-24" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => downloadConsent(selectedConsent)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

