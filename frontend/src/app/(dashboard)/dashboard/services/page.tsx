"use client";

/**
 * Service management: list, create, edit, activate/deactivate services.
 * Services are account-type aware with pricing per type.
 * Requires manage_settings permission (enforced in layout + API).
 */

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

const ACCOUNT_TYPES = ["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

interface Service {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  allowedTypes: AccountType[];
  pricing: Record<AccountType, number>;
  isActive: boolean;
  requiresConsent: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ServiceStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: { category: string; count: number }[];
}

export default function ServicesPage() {
  const { hasPermission } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    allowedTypes: [] as AccountType[],
    pricing: {} as Record<AccountType, number>,
    isActive: true,
    requiresConsent: true,
    sortOrder: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const canManage = hasPermission("manage_settings");

  async function load() {
    setLoading(true);
    try {
      const [servicesRes, statsRes, categoriesRes] = await Promise.all([
        apiGet<{ services: Service[] }>("/admin/services"),
        apiGet<{ stats: ServiceStats }>("/admin/services/stats"),
        apiGet<{ categories: string[] }>("/services/categories"),
      ]);
      setServices(servicesRes.services);
      setStats(statsRes.stats);
      setCategories(categoriesRes.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) load();
  }, [canManage]);

  function openCreate() {
    setEditing(null);
    setForm({
      code: "",
      name: "",
      description: "",
      category: categories[0] || "",
      allowedTypes: [],
      pricing: {},
      isActive: true,
      requiresConsent: true,
      sortOrder: services.length + 1,
    });
    setModal("create");
    setError("");
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      description: s.description || "",
      category: s.category || "",
      allowedTypes: s.allowedTypes,
      pricing: s.pricing,
      isActive: s.isActive,
      requiresConsent: s.requiresConsent,
      sortOrder: s.sortOrder,
    });
    setModal("edit");
    setError("");
  }

  function toggleAccountType(type: AccountType) {
    setForm((f) => {
      const newTypes = f.allowedTypes.includes(type)
        ? f.allowedTypes.filter((t) => t !== type)
        : [...f.allowedTypes, type];
      const newPricing = { ...f.pricing };
      if (!newTypes.includes(type)) {
        delete newPricing[type];
      } else if (newPricing[type] === undefined) {
        newPricing[type] = 0;
      }
      return { ...f, allowedTypes: newTypes, pricing: newPricing };
    });
  }

  function updatePricing(type: AccountType, value: string) {
    const numValue = parseFloat(value) || 0;
    setForm((f) => ({
      ...f,
      pricing: { ...f.pricing, [type]: numValue },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.allowedTypes.length === 0) {
      setError("Select at least one account type");
      return;
    }
    const missingPricing = form.allowedTypes.some(
      (t) => form.pricing[t] === undefined || form.pricing[t] < 0
    );
    if (missingPricing) {
      setError("Provide valid pricing for all selected account types");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const body = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        allowedTypes: form.allowedTypes,
        pricing: form.pricing,
        isActive: form.isActive,
        requiresConsent: form.requiresConsent,
        sortOrder: form.sortOrder,
      };

      if (modal === "create") {
        await apiPost("/admin/services", body);
      } else if (editing) {
        await apiPatch(`/admin/services/${editing.id}`, body);
      }
      setModal(null);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(s: Service) {
    try {
      await apiPost(`/admin/services/${s.id}/toggle`, {});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Delete service "${s.name}"? This cannot be undone if no purchases exist.`))
      return;
    try {
      await apiDelete(`/admin/services/${s.id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const filteredServices = services.filter((s) => {
    if (filter === "active" && !s.isActive) return false;
    if (filter === "inactive" && s.isActive) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    return true;
  });

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Services</h1>
        <p className="text-zinc-500 mt-2">You do not have permission to manage services.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Services
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[44px] text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto"
        >
          Create service
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Services</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
              {stats.active}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Inactive</p>
            <p className="text-2xl font-semibold text-slate-500">{stats.inactive}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Categories</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {stats.byCategory?.length || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "active" | "inactive")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Service
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Types
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Pricing
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{s.code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.category && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {s.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.allowedTypes.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-0.5">
                        {s.allowedTypes.map((t) => (
                          <div key={t} className="text-xs text-slate-600 dark:text-slate-400">
                            {t}: ${s.pricing[t] ?? 0}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          s.isActive
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                      {s.requiresConsent && (
                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                          (consent)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="text-indigo-600 dark:text-indigo-400 text-sm min-h-[36px] px-2 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(s)}
                          className={`text-sm min-h-[36px] px-2 hover:underline ${
                            s.isActive
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {s.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="text-red-600 dark:text-red-400 text-sm min-h-[36px] px-2 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-sm text-slate-500">
            Showing {filteredServices.length} of {services.length} services
          </p>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg sm:mx-auto p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {modal === "create" ? "Create Service" : "Edit Service"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      }))
                    }
                    required
                    disabled={modal === "edit"}
                    placeholder="tax_return_individual"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Tax, Accounting, etc."
                    list="categories"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Individual Tax Return"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of the service..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Allowed Account Types & Pricing
                </label>
                <div className="space-y-2">
                  {ACCOUNT_TYPES.map((type) => (
                    <div key={type} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 min-w-[140px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.allowedTypes.includes(type)}
                          onChange={() => toggleAccountType(type)}
                          className="rounded border-slate-300 w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{type}</span>
                      </label>
                      {form.allowedTypes.includes(type) && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-slate-500">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.pricing[type] ?? ""}
                            onChange={(e) => updatePricing(type, e.target.value)}
                            placeholder="0.00"
                            className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-slate-300 w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresConsent}
                    onChange={(e) => setForm((f) => ({ ...f, requiresConsent: e.target.checked }))}
                    className="rounded border-slate-300 w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Requires legal consent
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                  min="0"
                  className="w-24 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setEditing(null);
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : modal === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
