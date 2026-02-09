"use client";

/**
 * Single page: Roles & Permissions - full CRUD.
 * Pagination + search for scale (thousands of permissions, large role sets).
 */

import { useAuth } from "@/contexts/auth-context";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

const PAGE_SIZE = 20;

interface Role {
  id: string;
  name: string;
  description: string | null;
  rolePermissions: { permission: { id: string; code: string; name: string } }[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

type Tab = "roles" | "permissions";

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("roles");
  const [error, setError] = useState("");

  const canManage = hasPermission("manage_roles");

  // ---- Roles state ----
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesTotal, setRolesTotal] = useState(0);
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesSearch, setRolesSearch] = useState("");
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleModal, setRoleModal] = useState<"create" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissionIds: [] as string[] });
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [permSearchForRole, setPermSearchForRole] = useState("");
  const [permOptions, setPermOptions] = useState<Permission[]>([]);
  const [permOptionsPage, setPermOptionsPage] = useState(1);
  const [permOptionsTotal, setPermOptionsTotal] = useState(0);
  const [permOptionsLoading, setPermOptionsLoading] = useState(false);

  // ---- Permissions state ----
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permTotal, setPermTotal] = useState(0);
  const [permPage, setPermPage] = useState(1);
  const [permSearch, setPermSearch] = useState("");
  const [permLoading, setPermLoading] = useState(false);
  const [permModal, setPermModal] = useState<"create" | "edit" | null>(null);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [permForm, setPermForm] = useState({ code: "", name: "", description: "" });
  const [permSubmitting, setPermSubmitting] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!canManage) return;
    setRolesLoading(true);
    setError("");
    try {
      const res = await apiGet<{ roles: Role[]; total: number; page: number; limit: number }>(
        `/roles?page=${rolesPage}&limit=${PAGE_SIZE}&search=${encodeURIComponent(rolesSearch)}`
      );
      setRoles(res.roles);
      setRolesTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  }, [canManage, rolesPage, rolesSearch]);

  const loadPermissions = useCallback(async () => {
    if (!canManage) return;
    setPermLoading(true);
    setError("");
    try {
      const res = await apiGet<{ permissions: Permission[]; total: number; page: number; limit: number }>(
        `/permissions?page=${permPage}&limit=${PAGE_SIZE}&search=${encodeURIComponent(permSearch)}`
      );
      setPermissions(res.permissions);
      setPermTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load permissions");
    } finally {
      setPermLoading(false);
    }
  }, [canManage, permPage, permSearch]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const loadPermOptions = useCallback(
    async (page = 1, append = false) => {
      setPermOptionsLoading(true);
      try {
        const res = await apiGet<{ permissions: Permission[]; total: number }>(
          `/permissions?page=${page}&limit=50&search=${encodeURIComponent(permSearchForRole)}`
        );
        setPermOptions((prev) => (append ? [...prev, ...res.permissions] : res.permissions));
        setPermOptionsTotal(res.total);
        setPermOptionsPage(page);
      } finally {
        setPermOptionsLoading(false);
      }
    },
    [permSearchForRole]
  );

  useEffect(() => {
    if (roleModal) loadPermOptions(1, false);
  }, [roleModal, permSearchForRole, loadPermOptions]);

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Roles & Permissions</h1>
        <p className="text-zinc-500 mt-2">You do not have permission.</p>
      </div>
    );
  }

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm({ name: "", description: "", permissionIds: [] });
    setRoleModal("create");
    setError("");
  }
  function openEditRole(r: Role) {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      description: r.description ?? "",
      permissionIds: r.rolePermissions.map((rp) => rp.permission.id),
    });
    setRoleModal("edit");
    setError("");
  }
  async function submitRole(e: React.FormEvent) {
    e.preventDefault();
    setRoleSubmitting(true);
    setError("");
    try {
      if (roleModal === "create") {
        await apiPost("/roles", {
          name: roleForm.name,
          description: roleForm.description || null,
          permissionIds: roleForm.permissionIds,
        });
      } else if (editingRole) {
        await apiPatch(`/roles/${editingRole.id}`, {
          name: roleForm.name,
          description: roleForm.description || null,
          permissionIds: roleForm.permissionIds,
        });
      }
      setRoleModal(null);
      setEditingRole(null);
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRoleSubmitting(false);
    }
  }
  async function deleteRole(r: Role) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await apiDelete(`/roles/${r.id}`);
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }
  function toggleRolePermission(id: string) {
    setRoleForm((f) =>
      f.permissionIds.includes(id)
        ? { ...f, permissionIds: f.permissionIds.filter((x) => x !== id) }
        : { ...f, permissionIds: [...f.permissionIds, id] }
    );
  }

  function openCreatePerm() {
    setEditingPerm(null);
    setPermForm({ code: "", name: "", description: "" });
    setPermModal("create");
    setError("");
  }
  function openEditPerm(p: Permission) {
    setEditingPerm(p);
    setPermForm({ code: p.code, name: p.name, description: p.description ?? "" });
    setPermModal("edit");
    setError("");
  }
  async function submitPerm(e: React.FormEvent) {
    e.preventDefault();
    setPermSubmitting(true);
    setError("");
    try {
      if (permModal === "create") {
        await apiPost("/permissions", {
          code: permForm.code,
          name: permForm.name,
          description: permForm.description || null,
        });
      } else if (editingPerm) {
        await apiPatch(`/permissions/${editingPerm.id}`, {
          code: permForm.code,
          name: permForm.name,
          description: permForm.description || null,
        });
      }
      setPermModal(null);
      setEditingPerm(null);
      loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPermSubmitting(false);
    }
  }
  async function deletePerm(p: Permission) {
    if (!confirm(`Delete permission "${p.code}"?`)) return;
    try {
      await apiDelete(`/permissions/${p.id}`);
      loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const totalRolesPages = Math.ceil(rolesTotal / PAGE_SIZE) || 1;
  const totalPermPages = Math.ceil(permTotal / PAGE_SIZE) || 1;
  const hasMorePermOptions = permOptions.length < permOptionsTotal;

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4 sm:mb-6">Roles & Permissions</h1>

      <div className="flex gap-1 sm:gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium border-b-2 -mb-px min-h-[44px] flex-shrink-0 ${
            tab === "roles"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          Roles
        </button>
        <button
          type="button"
          onClick={() => setTab("permissions")}
          className={`px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium border-b-2 -mb-px min-h-[44px] flex-shrink-0 ${
            tab === "permissions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          Permissions
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tab === "roles" && (
        <>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
            <input
              type="search"
              placeholder="Search roles..."
              value={rolesSearch}
              onChange={(e) => {
                setRolesSearch(e.target.value);
                setRolesPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-sm w-full sm:w-48"
            />
            <button
              type="button"
              onClick={openCreateRole}
              className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto"
            >
              Create Role
            </button>
          </div>
          {rolesLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl">
                <table className="w-full text-left min-w-[560px]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Description</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Permissions</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{r.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.description ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {r.rolePermissions.map((rp) => rp.permission.code).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEditRole(r)} className="text-indigo-600 dark:text-indigo-400 text-sm min-h-[36px] px-2 hover:underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteRole(r)} className="text-red-600 dark:text-red-400 text-sm min-h-[36px] px-2 hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-sm text-slate-500">
                <span>Total: {rolesTotal}</span>
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <button
                    type="button"
                    disabled={rolesPage <= 1}
                    onClick={() => setRolesPage((p) => p - 1)}
                    className="min-h-[40px] px-3 disabled:opacity-50 hover:underline rounded-lg"
                  >
                    Previous
                  </button>
                  <span className="text-center">
                    Page {rolesPage} of {totalRolesPages}
                  </span>
                  <button
                    type="button"
                    disabled={rolesPage >= totalRolesPages}
                    onClick={() => setRolesPage((p) => p + 1)}
                    className="min-h-[40px] px-3 disabled:opacity-50 hover:underline rounded-lg"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "permissions" && (
        <>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
            <input
              type="search"
              placeholder="Search permissions..."
              value={permSearch}
              onChange={(e) => {
                setPermSearch(e.target.value);
                setPermPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-sm w-full sm:w-64"
            />
            <button
              type="button"
              onClick={openCreatePerm}
              className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto"
            >
              Create Permission
            </button>
          </div>
          {permLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl">
                <table className="w-full text-left min-w-[480px]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Code</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Description</th>
                    <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-mono text-sm text-slate-900 dark:text-slate-100">{p.code}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.description ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEditPerm(p)} className="text-indigo-600 dark:text-indigo-400 text-sm min-h-[36px] px-2 hover:underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => deletePerm(p)} className="text-red-600 dark:text-red-400 text-sm min-h-[36px] px-2 hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-sm text-slate-500">
                <span>Total: {permTotal}</span>
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <button
                    type="button"
                    disabled={permPage <= 1}
                    onClick={() => setPermPage((p) => p - 1)}
                    className="min-h-[40px] px-3 disabled:opacity-50 hover:underline rounded-lg"
                  >
                    Previous
                  </button>
                  <span className="text-center">
                    Page {permPage} of {totalPermPages}
                  </span>
                  <button
                    type="button"
                    disabled={permPage >= totalPermPages}
                    onClick={() => setPermPage((p) => p + 1)}
                    className="min-h-[40px] px-3 disabled:opacity-50 hover:underline rounded-lg"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Role modal (create/edit) - permissions selector with search + load more */}
      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg sm:mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              {roleModal === "create" ? "Create Role" : "Edit Role"}
            </h2>
            <form onSubmit={submitRole} className="p-4 space-y-4 flex-1 overflow-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Permissions</label>
                <input
                  type="search"
                  placeholder="Search permissions..."
                  value={permSearchForRole}
                  onChange={(e) => setPermSearchForRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-sm text-slate-900 dark:text-slate-100 mb-2"
                />
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                  {permOptionsLoading && !permOptions.length ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : (
                    permOptions.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 py-2 min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={roleForm.permissionIds.includes(p.id)}
                          onChange={() => toggleRolePermission(p.id)}
                          className="rounded border-slate-300 w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{p.code}</span>
                        <span className="text-xs text-slate-500">({p.name})</span>
                      </label>
                    ))
                  )}
                  {hasMorePermOptions && (
                    <button
                      type="button"
                      onClick={() => loadPermOptions(permOptionsPage + 1, true)}
                      disabled={permOptionsLoading}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 mt-2 min-h-[44px] px-2"
                    >
                      {permOptionsLoading ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setRoleModal(null); setEditingRole(null); }}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {roleSubmitting ? "Saving..." : roleModal === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission modal (create/edit) */}
      {permModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md sm:mx-auto p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {permModal === "create" ? "Create Permission" : "Edit Permission"}
            </h2>
            <form onSubmit={submitPerm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code (lowercase, underscores)</label>
                <input
                  type="text"
                  value={permForm.code}
                  onChange={(e) => setPermForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                  required
                  placeholder="e.g. view_reports"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={permForm.name}
                  onChange={(e) => setPermForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={permForm.description}
                  onChange={(e) => setPermForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setPermModal(null); setEditingPerm(null); }}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 min-h-[48px] text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={permSubmitting}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[48px] text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {permSubmitting ? "Saving..." : permModal === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
