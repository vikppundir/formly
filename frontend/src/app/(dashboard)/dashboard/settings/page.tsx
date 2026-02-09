"use client";

/**
 * Settings page - Email/SMS configuration, verification settings, email templates.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Tab = "website" | "email" | "sms" | "verification" | "templates" | "support" | "payment" | "abn";

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables?: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("website");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templateSearch, setTemplateSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateModal, setTemplateModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Test email/SMS
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSms, setTestingSms] = useState(false);

  // Check permission
  useEffect(() => {
    if (!hasPermission("manage_settings")) {
      router.replace("/dashboard");
    }
  }, [hasPermission, router]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      
      // Flatten settings
      const flat: Record<string, string> = {};
      for (const s of data.raw) {
        flat[s.key] = s.value;
      }
      setSettings(flat);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: templatePage.toString(),
        limit: "10",
        ...(templateSearch && { search: templateSearch }),
      });
      const res = await fetch(`${API_URL}/settings/email-templates?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data.items);
      setTemplateTotal(data.total);
    } catch {
      setError("Failed to load templates");
    }
  }, [templatePage, templateSearch]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (tab === "templates") {
      fetchTemplates();
    }
  }, [tab, fetchTemplates]);

  // Update setting
  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  // Save settings
  async function saveSettings(keys: string[]) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const settingsToSave = keys.map((key) => ({ key, value: settings[key] || "" }));
      const res = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings: settingsToSave }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      setSuccess("Settings saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  // Test email
  async function handleTestEmail() {
    if (!testEmail) return;
    setTestingEmail(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_URL}/settings/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      setSuccess("Test email sent successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test email failed");
    } finally {
      setTestingEmail(false);
    }
  }

  // Test SMS
  async function handleTestSms() {
    if (!testPhone) return;
    setTestingSms(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_URL}/settings/test-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: testPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      setSuccess("Test SMS sent successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test SMS failed");
    } finally {
      setTestingSms(false);
    }
  }

  // Save template
  async function saveTemplate() {
    if (!editingTemplate) return;
    setSaving(true);
    setError("");
    try {
      const isNew = !editingTemplate.id;
      const url = isNew
        ? `${API_URL}/settings/email-templates`
        : `${API_URL}/settings/email-templates/${editingTemplate.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: editingTemplate.code,
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          bodyHtml: editingTemplate.bodyHtml,
          bodyText: editingTemplate.bodyText || undefined,
          variables: editingTemplate.variables || undefined,
          isActive: editingTemplate.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      setTemplateModal(false);
      setEditingTemplate(null);
      fetchTemplates();
      setSuccess("Template saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  // Delete template
  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`${API_URL}/settings/email-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      fetchTemplates();
      setSuccess("Template deleted");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // Toggle template active
  async function toggleTemplateActive(id: string) {
    try {
      const res = await fetch(`${API_URL}/settings/email-templates/${id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle");
      fetchTemplates();
    } catch {
      setError("Failed to toggle template status");
    }
  }

  // Preview template
  async function previewTemplate(id: string) {
    try {
      const res = await fetch(`${API_URL}/settings/email-templates/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          variables: { name: "Test User", otp: "123456", expiryMinutes: "10" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreviewHtml(data.bodyHtml);
      setPreviewModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const emailKeys = ["email_provider", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name", "sendgrid_api_key", "sendgrid_from_email", "sendgrid_from_name"];
  const smsKeys = ["sms_provider", "twilio_account_sid", "twilio_auth_token", "twilio_phone_number"];
  const verifyKeys = ["email_verification_enabled", "phone_verification_enabled", "otp_expiry_minutes", "otp_length", "app_name"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(["website", "email", "sms", "verification", "templates", "support", "payment", "abn"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t === "website" ? "Website" : t === "email" ? "Email Config" : t === "sms" ? "SMS Config" : t === "verification" ? "Verification" : t === "templates" ? "Email Templates" : t === "support" ? "Support" : t === "payment" ? "Payment Gateway" : "ABN Lookup"}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Website Tab */}
      {tab === "website" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Brand Settings</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">App Name</label>
              <input
                type="text"
                value={settings.app_name || ""}
                onChange={(e) => updateSetting("app_name", e.target.value)}
                placeholder="JAP Accountants"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tagline</label>
              <input
                type="text"
                value={settings.website_tagline || ""}
                onChange={(e) => updateSetting("website_tagline", e.target.value)}
                placeholder="In-depth Perfect Analysis"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL</label>
              <input
                type="text"
                value={settings.website_logo || ""}
                onChange={(e) => updateSetting("website_logo", e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Enter logo image URL (PNG, JPG recommended)</p>
              {settings.website_logo && (
                <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs text-slate-500 mb-2">Preview:</p>
                  <img src={settings.website_logo} alt="Logo preview" className="max-h-16 object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Contact Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.contact_email || ""}
                  onChange={(e) => updateSetting("contact_email", e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={settings.contact_phone || ""}
                  onChange={(e) => updateSetting("contact_phone", e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={settings.contact_address || ""}
                  onChange={(e) => updateSetting("contact_address", e.target.value)}
                  placeholder="Office address..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Social Accounts</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Facebook</label>
                <input
                  type="url"
                  value={settings.social_facebook || ""}
                  onChange={(e) => updateSetting("social_facebook", e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Twitter / X</label>
                <input
                  type="url"
                  value={settings.social_twitter || ""}
                  onChange={(e) => updateSetting("social_twitter", e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">LinkedIn</label>
                <input
                  type="url"
                  value={settings.social_linkedin || ""}
                  onChange={(e) => updateSetting("social_linkedin", e.target.value)}
                  placeholder="https://linkedin.com/company/yourcompany"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instagram</label>
                <input
                  type="url"
                  value={settings.social_instagram || ""}
                  onChange={(e) => updateSetting("social_instagram", e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">YouTube</label>
                <input
                  type="url"
                  value={settings.social_youtube || ""}
                  onChange={(e) => updateSetting("social_youtube", e.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => saveSettings([
                "app_name", "website_tagline", "website_logo",
                "contact_email", "contact_phone", "contact_address",
                "social_facebook", "social_twitter", "social_linkedin",
                "social_instagram", "social_youtube"
              ])}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Website Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Email Config Tab */}
      {tab === "email" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Provider
            </label>
            <select
              value={settings.email_provider || "smtp"}
              onChange={(e) => updateSetting("email_provider", e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
            >
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </div>

          {settings.email_provider === "sendgrid" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SendGrid API Key</label>
                <input
                  type="password"
                  value={settings.sendgrid_api_key || ""}
                  onChange={(e) => updateSetting("sendgrid_api_key", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Email</label>
                <input
                  type="email"
                  value={settings.sendgrid_from_email || ""}
                  onChange={(e) => updateSetting("sendgrid_from_email", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Name</label>
                <input
                  type="text"
                  value={settings.sendgrid_from_name || ""}
                  onChange={(e) => updateSetting("sendgrid_from_name", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp_host || ""}
                  onChange={(e) => updateSetting("smtp_host", e.target.value)}
                  placeholder="smtp.example.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Port</label>
                <input
                  type="text"
                  value={settings.smtp_port || "587"}
                  onChange={(e) => updateSetting("smtp_port", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP User</label>
                <input
                  type="text"
                  value={settings.smtp_user || ""}
                  onChange={(e) => updateSetting("smtp_user", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Password</label>
                <input
                  type="password"
                  value={settings.smtp_pass || ""}
                  onChange={(e) => updateSetting("smtp_pass", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Email</label>
                <input
                  type="email"
                  value={settings.smtp_from_email || ""}
                  onChange={(e) => updateSetting("smtp_from_email", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Name</label>
                <input
                  type="text"
                  value={settings.smtp_from_name || ""}
                  onChange={(e) => updateSetting("smtp_from_name", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => saveSettings(emailKeys)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Email Settings"}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm w-48"
              />
              <button
                onClick={handleTestEmail}
                disabled={testingEmail || !testEmail}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {testingEmail ? "Sending..." : "Send Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Config Tab */}
      {tab === "sms" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              SMS Provider
            </label>
            <select
              value={settings.sms_provider || "twilio"}
              onChange={(e) => updateSetting("sms_provider", e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
            >
              <option value="twilio">Twilio</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Twilio Account SID</label>
              <input
                type="text"
                value={settings.twilio_account_sid || ""}
                onChange={(e) => updateSetting("twilio_account_sid", e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Twilio Auth Token</label>
              <input
                type="password"
                value={settings.twilio_auth_token || ""}
                onChange={(e) => updateSetting("twilio_auth_token", e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Twilio Phone Number</label>
              <input
                type="text"
                value={settings.twilio_phone_number || ""}
                onChange={(e) => updateSetting("twilio_phone_number", e.target.value)}
                placeholder="+1234567890"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => saveSettings(smsKeys)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save SMS Settings"}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                placeholder="+91XXXXXXXXXX"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm w-48"
              />
              <button
                onClick={handleTestSms}
                disabled={testingSms || !testPhone}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {testingSms ? "Sending..." : "Send Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Tab */}
      {tab === "verification" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">App Name</label>
            <input
              type="text"
              value={settings.app_name || ""}
              onChange={(e) => updateSetting("app_name", e.target.value)}
              className="w-full max-w-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Used in email templates and SMS</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">Email Verification</div>
                <div className="text-sm text-slate-500">Require email OTP during registration</div>
              </div>
              <button
                onClick={() => updateSetting("email_verification_enabled", settings.email_verification_enabled === "true" ? "false" : "true")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.email_verification_enabled === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.email_verification_enabled === "true" ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">Phone Verification</div>
                <div className="text-sm text-slate-500">Require phone OTP during registration</div>
              </div>
              <button
                onClick={() => updateSetting("phone_verification_enabled", settings.phone_verification_enabled === "true" ? "false" : "true")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.phone_verification_enabled === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.phone_verification_enabled === "true" ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OTP Length</label>
              <input
                type="number"
                min="4"
                max="8"
                value={settings.otp_length || "6"}
                onChange={(e) => updateSetting("otp_length", e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OTP Expiry (minutes)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.otp_expiry_minutes || "10"}
                onChange={(e) => updateSetting("otp_expiry_minutes", e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => saveSettings(verifyKeys)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Verification Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => {
                setTemplateSearch(e.target.value);
                setTemplatePage(1);
              }}
              className="w-full sm:w-64 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
            />
            <button
              onClick={() => {
                setEditingTemplate({
                  id: "",
                  code: "",
                  name: "",
                  subject: "",
                  bodyHtml: "",
                  bodyText: "",
                  variables: "",
                  isActive: true,
                });
                setTemplateModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              + New Template
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Subject</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Active</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{t.code}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{t.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{t.subject}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleTemplateActive(t.id)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            t.isActive
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {t.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => previewTemplate(t.id)}
                            className="text-slate-500 hover:text-indigo-600"
                            title="Preview"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingTemplate(t);
                              setTemplateModal(true);
                            }}
                            className="text-slate-500 hover:text-indigo-600"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            className="text-slate-500 hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No templates found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {templateTotal > 10 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm text-slate-500">{templateTotal} templates</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
                    disabled={templatePage === 1}
                    className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setTemplatePage((p) => p + 1)}
                    disabled={templatePage * 10 >= templateTotal}
                    className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Modal */}
      {templateModal && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingTemplate.id ? "Edit Template" : "New Template"}
              </h2>
              <button
                onClick={() => {
                  setTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    value={editingTemplate.code}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, code: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") })}
                    disabled={!!editingTemplate.id}
                    placeholder="email_verification"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="Use {{variableName}} for dynamic values"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">HTML Body</label>
                <textarea
                  rows={8}
                  value={editingTemplate.bodyHtml}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyHtml: e.target.value })}
                  placeholder="<h1>Hello {{name}}</h1>..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plain Text Body (optional)</label>
                <textarea
                  rows={3}
                  value={editingTemplate.bodyText || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyText: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Variables (JSON array)</label>
                <input
                  type="text"
                  value={editingTemplate.variables || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, variables: e.target.value })}
                  placeholder='["name", "otp", "expiryMinutes"]'
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm font-mono"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingTemplate({ ...editingTemplate, isActive: !editingTemplate.isActive })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    editingTemplate.isActive ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      editingTemplate.isActive ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <button
                onClick={() => {
                  setTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving || !editingTemplate.code || !editingTemplate.name || !editingTemplate.subject || !editingTemplate.bodyHtml}
                className="px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Tab */}
      {tab === "support" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Support Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Configure support availability and contact details</p>
          </div>

          <div className="space-y-6">
            {/* Support Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Support Availability</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="support_type"
                    checked={settings.support_type === "24/7"}
                    onChange={() => updateSetting("support_type", "24/7")}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">24/7 Support</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="support_type"
                    checked={settings.support_type === "working_hours"}
                    onChange={() => updateSetting("support_type", "working_hours")}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Working Hours</span>
                </label>
              </div>
            </div>

            {/* Working Hours (shown only if working_hours selected) */}
            {settings.support_type === "working_hours" && (
              <div className="grid sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={settings.support_hours_start || "09:00"}
                    onChange={(e) => updateSetting("support_hours_start", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={settings.support_hours_end || "18:00"}
                    onChange={(e) => updateSetting("support_hours_end", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
                  <select
                    value={settings.support_timezone || "Asia/Kolkata"}
                    onChange={(e) => updateSetting("support_timezone", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Working Days</label>
                  <input
                    type="text"
                    value={settings.support_days || "Mon,Tue,Wed,Thu,Fri"}
                    onChange={(e) => updateSetting("support_days", e.target.value)}
                    placeholder="Mon,Tue,Wed,Thu,Fri"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Comma-separated (e.g., Mon,Tue,Wed,Thu,Fri)</p>
                </div>
              </div>
            )}

            {/* Support Contact Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.support_email || ""}
                  onChange={(e) => updateSetting("support_email", e.target.value)}
                  placeholder="support@example.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Support Phone</label>
                <input
                  type="tel"
                  value={settings.support_phone || ""}
                  onChange={(e) => updateSetting("support_phone", e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Enable/Disable Support */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Enable Support System</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Allow users to create support tickets</p>
              </div>
              <button
                onClick={() => updateSetting("support_enabled", settings.support_enabled === "true" ? "false" : "true")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.support_enabled === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.support_enabled === "true" ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Support Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Payment Gateway Tab */}
      {tab === "payment" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Payment Gateway Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configure Stripe payment gateway for service purchases</p>
          </div>

          {/* Payment Gateway Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Payment Gateway
            </label>
            <select
              value={settings.payment_gateway || "stripe"}
              onChange={(e) => updateSetting("payment_gateway", e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
            >
              <option value="stripe">Stripe</option>
              <option value="none">Disabled</option>
            </select>
          </div>

          {settings.payment_gateway !== "none" && (
            <>
              {/* Stripe Configuration */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#635bff] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Stripe</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Accept credit cards, debit cards, and more</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mode
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="stripe_mode"
                          checked={settings.stripe_mode !== "live"}
                          onChange={() => updateSetting("stripe_mode", "test")}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Test Mode</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="stripe_mode"
                          checked={settings.stripe_mode === "live"}
                          onChange={() => updateSetting("stripe_mode", "live")}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Live Mode</span>
                      </label>
                    </div>
                    {settings.stripe_mode !== "live" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Test mode - No real payments will be processed
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Publishable Key
                    </label>
                    <input
                      type="text"
                      value={settings.stripe_publishable_key || ""}
                      onChange={(e) => updateSetting("stripe_publishable_key", e.target.value)}
                      placeholder={settings.stripe_mode === "live" ? "pk_live_..." : "pk_test_..."}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      value={settings.stripe_secret_key || ""}
                      onChange={(e) => updateSetting("stripe_secret_key", e.target.value)}
                      placeholder={settings.stripe_mode === "live" ? "sk_live_..." : "sk_test_..."}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Webhook Secret
                    </label>
                    <input
                      type="password"
                      value={settings.stripe_webhook_secret || ""}
                      onChange={(e) => updateSetting("stripe_webhook_secret", e.target.value)}
                      placeholder="whsec_..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm font-mono"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Webhook URL: {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">Payment Settings</h4>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={settings.payment_currency || "AUD"}
                      onChange={(e) => updateSetting("payment_currency", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                    >
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="INR">INR - Indian Rupee</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.payment_tax_rate || "10"}
                      onChange={(e) => updateSetting("payment_tax_rate", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">GST rate (Australia: 10%)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Require Payment for Services</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Services must be paid before activation</p>
                  </div>
                  <button
                    onClick={() => updateSetting("payment_required", settings.payment_required === "true" ? "false" : "true")}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.payment_required === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings.payment_required === "true" ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Include Tax in Display Price</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Show prices as tax-inclusive</p>
                  </div>
                  <button
                    onClick={() => updateSetting("payment_tax_inclusive", settings.payment_tax_inclusive === "true" ? "false" : "true")}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.payment_tax_inclusive === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings.payment_tax_inclusive === "true" ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => saveSettings([
                "payment_gateway", "stripe_mode", "stripe_publishable_key", "stripe_secret_key", 
                "stripe_webhook_secret", "payment_currency", "payment_tax_rate", 
                "payment_required", "payment_tax_inclusive"
              ])}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Payment Settings"}
            </button>
          </div>
        </div>
      )}

      {/* ABN Lookup Tab */}
      {tab === "abn" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">ABN Lookup API Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure Australian Business Number lookup integration. When enabled, users entering an ABN in their Individual account will have it validated and business details auto-filled.
            </p>
          </div>

          {/* Enable/Disable ABN Validation */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Enable ABN Validation</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Validate ABN numbers using the ABN Lookup API when users enter them
              </p>
            </div>
            <button
              onClick={() => updateSetting("abn_lookup_enabled", settings.abn_lookup_enabled === "true" ? "false" : "true")}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.abn_lookup_enabled === "true" ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.abn_lookup_enabled === "true" ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* API Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                ABN Lookup API Key (GUID)
              </label>
              <input
                type="password"
                value={settings.abn_lookup_api_key || ""}
                onChange={(e) => updateSetting("abn_lookup_api_key", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm font-mono"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Get your free API key from{" "}
                <a href="https://abr.business.gov.au/Tools/WebServices" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  ABR Web Services
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                ABN Lookup API URL
              </label>
              <input
                type="text"
                value={settings.abn_lookup_api_url || "https://abr.business.gov.au/json/AbnDetails.aspx"}
                onChange={(e) => updateSetting("abn_lookup_api_url", e.target.value)}
                placeholder="https://abr.business.gov.au/json/AbnDetails.aspx"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Default: Australian Business Register JSON endpoint
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>User selects &quot;Do you have an ABN?&quot; → Yes</li>
                  <li>User enters their 11-digit ABN</li>
                  <li>System validates ABN with the ABR API</li>
                  <li>Registered business name and status auto-fill</li>
                  <li>If ABN is invalid or cancelled, user is notified</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => saveSettings([
                "abn_lookup_enabled", "abn_lookup_api_key", "abn_lookup_api_url"
              ])}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save ABN Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Email Preview</h2>
              <button
                onClick={() => {
                  setPreviewModal(false);
                  setPreviewHtml("");
                }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div
                className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
