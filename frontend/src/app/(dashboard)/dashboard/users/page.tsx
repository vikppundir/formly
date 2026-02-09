"use client";

/**
 * User management: list, create, edit, deactivate, assign roles.
 * Requires manage_users permission (enforced in layout + API).
 */

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userRoles: { role: { id: string; name: string } }[];
}

interface Role {
  id: string;
  name: string;
}

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION",
    roleIds: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canManage = hasPermission("manage_users");

  async function load() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiGet<{ users: User[]; total: number }>("/users"),
        canManage ? apiGet<{ roles: Role[] }>("/roles") : Promise.resolve({ roles: [] }),
      ]);
      setUsers(usersRes.users);
      setTotal(usersRes.total);
      setRoles(rolesRes.roles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [canManage]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", password: "", status: "ACTIVE", roleIds: [] });
    setModal("create");
    setError("");
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      status: u.status as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION",
      roleIds: u.userRoles.map((ur) => ur.role.id),
    });
    setModal("edit");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (modal === "create") {
        await apiPost("/users", {
          name: form.name,
          email: form.email,
          password: form.password,
          status: form.status,
          roleIds: form.roleIds,
        });
      } else if (editing) {
        const body: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          status: form.status,
          roleIds: form.roleIds,
        };
        if (form.password) body.password = form.password;
        await apiPatch(`/users/${editing.id}`, body);
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

  async function handleActivate(u: User) {
    if (!confirm(`Activate ${u.name}? This will change their status from Pending Verification to Active.`)) return;
    try {
      await apiPatch(`/users/${u.id}`, { status: "ACTIVE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleDeactivate(u: User) {
    if (!confirm(`Deactivate ${u.name}?`)) return;
    try {
      await apiPatch(`/users/${u.id}`, { status: "INACTIVE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleSoftDelete(u: User) {
    if (!confirm(`Remove user ${u.name}? This will deactivate and soft-delete.`)) return;
    try {
      await apiDelete(`/users/${u.id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Users</h1>
        <p className="text-zinc-500 mt-2">You do not have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Users</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-indigo-600 text-white px-4 py-3 min-h-[44px] text-sm font-medium hover:bg-indigo-700 w-full sm:w-auto"
        >
          Create user
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl">
            <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Name</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Roles</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      u.status === "ACTIVE" 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                        : u.status === "PENDING_VERIFICATION"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : u.status === "SUSPENDED"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      {u.status === "PENDING_VERIFICATION" ? "PENDING" : u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {u.userRoles.map((ur) => ur.role.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-indigo-600 dark:text-indigo-400 text-sm min-h-[36px] px-2 hover:underline"
                      >
                        Edit
                      </button>
                      {u.status === "PENDING_VERIFICATION" && (
                        <button
                          type="button"
                          onClick={() => handleActivate(u)}
                          className="text-green-600 dark:text-green-400 text-sm min-h-[36px] px-2 hover:underline"
                        >
                          Activate
                        </button>
                      )}
                      {u.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(u)}
                          className="text-amber-600 dark:text-amber-400 text-sm min-h-[36px] px-2 hover:underline"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSoftDelete(u)}
                        className="text-red-600 dark:text-red-400 text-sm min-h-[36px] px-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="px-4 py-2 text-sm text-slate-500">Total: {total}</p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md sm:mx-auto p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {modal === "create" ? "Create user" : "Edit user"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  disabled={modal === "edit"}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password {modal === "edit" && "(leave blank to keep)"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={modal === "create"}
                  minLength={modal === "create" ? 8 : undefined}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" }))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-h-[48px] text-slate-900 dark:text-slate-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Roles</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(r.id)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            roleIds: e.target.checked
                              ? [...f.roleIds, r.id]
                              : f.roleIds.filter((id) => id !== r.id),
                          }))
                        }
                        className="rounded border-slate-300 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setModal(null); setEditing(null); }}
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
