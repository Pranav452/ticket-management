"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, Search, Filter, ShieldCheck } from "lucide-react";
import {
  useBajajUsers,
  useApproveBajajUser,
  useRejectBajajUser,
  useBajajAuditLogs,
  useBajajRolePermissions,
  useUpdateBajajRolePermission,
  useUpdateBajajUserRole,
} from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajUser, BajajAuditLog, BajajRolePermission, BajajUserRole } from "@/lib/types/bajaj";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-yellow-950/60 text-yellow-400 border-yellow-800",
    approved: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
    rejected: "bg-red-950/60 text-red-400 border-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
      {status}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  const styles: Record<string, string> = {
    superadmin: "bg-violet-950/60 text-violet-300 border-violet-800",
    admin:      "bg-amber-950/60  text-amber-300  border-amber-800",
    operator:   "bg-blue-950/60   text-blue-300   border-blue-800",
    viewer:     "bg-neutral-800   text-neutral-400 border-neutral-700",
  };
  const r = role ?? "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[r] ?? "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
      {r}
    </span>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, adminId, canManageRoles }: { user: BajajUser; adminId: string; canManageRoles: boolean }) {
  const approve = useApproveBajajUser();
  const reject  = useRejectBajajUser();
  const updateRole = useUpdateBajajUserRole();

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-sm text-neutral-200">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-neutral-400">{user.email}</td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3">
        {canManageRoles ? (
          <select
            value={user.role ?? ""}
            onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value as BajajUserRole })}
            disabled={updateRole.isPending}
            className="bg-neutral-900 border border-neutral-700 rounded-md text-xs text-neutral-300 px-2 py-1 focus:outline-none focus:border-amber-600 disabled:opacity-50"
          >
            <option value="">— no role —</option>
            <option value="superadmin">superadmin</option>
            <option value="admin">admin</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
        ) : (
          <RoleBadge role={user.role} />
        )}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">{user.department ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-neutral-600">
        {new Date(user.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td className="px-4 py-3">
        {user.status === "pending" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => approve.mutate({ bajajUserId: user.id, adminId })}
              disabled={approve.isPending}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-700 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
              Approve
            </button>
            <button
              onClick={() => reject.mutate({ bajajUserId: user.id })}
              disabled={reject.isPending}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-900/60 text-xs text-red-300 hover:bg-red-800 disabled:opacity-50 transition-colors border border-red-800"
            >
              {reject.isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
              Reject
            </button>
          </div>
        )}
        {user.status !== "pending" && (
          <span className="text-xs text-neutral-700">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Audit log row ────────────────────────────────────────────────────────────
function AuditRow({ log }: { log: BajajAuditLog }) {
  const actionColors: Record<string, string> = {
    moved_card:       "text-blue-400",
    assigned:         "text-amber-400",
    commented:        "text-neutral-400",
    imported:         "text-emerald-400",
    edited_field:     "text-violet-400",
    approved_user:    "text-emerald-400",
    rejected_user:    "text-red-400",
    requested_access: "text-yellow-400",
  };

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
        {new Date(log.created_at).toLocaleString("en-GB", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-300">{log.actor_email}</td>
      <td className={`px-4 py-3 text-sm font-medium ${actionColors[log.action] ?? "text-neutral-400"}`}>
        {log.action.replace(/_/g, " ")}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-600">{log.target_type ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-neutral-600 max-w-[200px] truncate">
        {log.new_value ? JSON.stringify(log.new_value) : "—"}
      </td>
    </tr>
  );
}

// ─── Permissions Matrix ───────────────────────────────────────────────────────
const ROLES: BajajUserRole[] = ["superadmin", "admin", "operator", "viewer"];

const PERM_COLS: { key: keyof BajajRolePermission; label: string }[] = [
  { key: "can_view",         label: "View" },
  { key: "can_edit_fields",  label: "Edit Fields" },
  { key: "can_move_stage",   label: "Move Stage" },
  { key: "can_import",       label: "Import" },
  { key: "can_export",       label: "Export" },
  { key: "can_manage_users", label: "Manage Users" },
];

function PermissionsMatrix({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { data: perms = [], isLoading } = useBajajRolePermissions();
  const update = useUpdateBajajRolePermission();

  function getPermRow(role: BajajUserRole): BajajRolePermission | undefined {
    return perms.find((p) => p.role === role && p.module_slug === "*");
  }

  function toggle(role: BajajUserRole, key: keyof BajajRolePermission, currentVal: boolean) {
    if (!isSuperAdmin) return;
    const row = getPermRow(role) ?? {
      id: "",
      role,
      module_slug: "*",
      can_view: false,
      can_edit_fields: false,
      can_move_stage: false,
      can_import: false,
      can_export: false,
      can_manage_users: false,
    };
    update.mutate({ ...row, [key]: !currentVal });
  }

  if (isLoading) {
    return <div className="text-sm text-neutral-600 py-4">Loading permissions…</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full">
        <thead className="bg-neutral-900/80 border-b border-neutral-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide w-32">Role</th>
            {PERM_COLS.map((col) => (
              <th key={col.key} className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wide">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const row = getPermRow(role);
            return (
              <tr key={role} className="border-b border-neutral-800 hover:bg-neutral-900/30">
                <td className="px-4 py-3">
                  <RoleBadge role={role} />
                </td>
                {PERM_COLS.map((col) => {
                  const val = row ? !!(row[col.key] as boolean | number) : false;
                  return (
                    <td key={col.key} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => toggle(role, col.key, val)}
                        disabled={!isSuperAdmin || update.isPending}
                        className="size-4 rounded accent-amber-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!isSuperAdmin && (
        <p className="px-4 py-2.5 text-xs text-neutral-600 border-t border-neutral-800">
          Only superadmins can edit role permissions.
        </p>
      )}
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab]               = useState<"requests" | "audit" | "roles">("requests");
  const [searchEmail, setSearchEmail] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { profile } = useAuthStore();
  const { data: allUsers = [] } = useBajajUsers();
  const { data: auditLogs = [] } = useBajajAuditLogs({
    actorEmail: searchEmail || undefined,
    action:     actionFilter || undefined,
    limit:      200,
  });

  const pendingUsers      = allUsers.filter((u) => u.status === "pending");
  const allUsersFiltered  = searchEmail
    ? allUsers.filter((u) => u.email.includes(searchEmail))
    : allUsers;

  const isSuperAdmin = (profile as { role?: string } | null)?.role === "superadmin";

  const ACTIONS = [
    "moved_card", "assigned", "commented", "imported",
    "edited_field", "approved_user", "rejected_user", "requested_access",
  ];

  return (
    <div className="flex flex-col bg-neutral-950 px-6 py-5">

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-neutral-800">
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "text-amber-400 border-b-2 border-amber-500"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Access Requests
          {pendingUsers.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-600 text-[10px] text-white">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "audit"
              ? "text-amber-400 border-b-2 border-amber-500"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Audit Log
        </button>
        <button
          onClick={() => setTab("roles")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "roles"
              ? "text-amber-400 border-b-2 border-amber-500"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          Roles &amp; Permissions
        </button>
      </div>

      {/* ── Access Requests tab ───────────────────────────────────── */}
      {tab === "requests" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-600" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-900/80 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsersFiltered.map((u) => (
                  <UserRow key={u.id} user={u} adminId={profile?.id ?? ""} canManageRoles={isSuperAdmin} />
                ))}
                {allUsersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-600">
                      No access requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Audit Log tab ─────────────────────────────────────────── */}
      {tab === "audit" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-600" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-600" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:outline-none focus:border-amber-600 appearance-none"
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-900/80 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-600">
                      No audit logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Roles & Permissions tab ───────────────────────────────── */}
      {tab === "roles" && (
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-neutral-200 mb-1">Roles &amp; Permissions Matrix</h2>
            <p className="text-xs text-neutral-600">
              Default permissions apply to all modules (<code className="text-neutral-500">*</code>).
              {!isSuperAdmin && " Only superadmins can modify permissions."}
            </p>
          </div>
          <PermissionsMatrix isSuperAdmin={isSuperAdmin} />
        </div>
      )}
    </div>
  );
}
