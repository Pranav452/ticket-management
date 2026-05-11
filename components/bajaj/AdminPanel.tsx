"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, Search, Filter, ShieldCheck, Wrench, RefreshCw, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
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
    pending:  "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {status}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  const styles: Record<string, string> = {
    superadmin: "bg-violet-50 text-violet-700 border-violet-200",
    admin:      "bg-amber-50 text-amber-700 border-amber-200",
    operator:   "bg-blue-50 text-blue-700 border-blue-200",
    viewer:     "bg-gray-100 text-gray-500 border-gray-200",
  };
  const r = role ?? "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[r] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {r}
    </span>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, adminId, canManageRoles }: { user: BajajUser; adminId: string; canManageRoles: boolean }) {
  const approve    = useApproveBajajUser();
  const reject     = useRejectBajajUser();
  const updateRole = useUpdateBajajUserRole();

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-800">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
      <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
      <td className="px-4 py-3">
        {canManageRoles ? (
          <select
            value={user.role ?? ""}
            onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value as BajajUserRole })}
            disabled={updateRole.isPending}
            className="bg-white border border-gray-200 rounded-md text-xs text-gray-700 px-2 py-1 focus:outline-none focus:border-amber-500 disabled:opacity-50"
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
      <td className="px-4 py-3 text-sm text-gray-400">{user.department ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(user.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td className="px-4 py-3">
        {user.status === "pending" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => approve.mutate({ bajajUserId: user.id, adminId })}
              disabled={approve.isPending}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-500 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
              Approve
            </button>
            <button
              onClick={() => reject.mutate({ bajajUserId: user.id })}
              disabled={reject.isPending}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-50 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
            >
              {reject.isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
              Reject
            </button>
          </div>
        )}
        {user.status !== "pending" && (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Audit log row ────────────────────────────────────────────────────────────
function AuditRow({ log }: { log: BajajAuditLog }) {
  const actionColors: Record<string, string> = {
    moved_card:       "text-blue-600",
    assigned:         "text-amber-600",
    commented:        "text-gray-500",
    imported:         "text-emerald-600",
    edited_field:     "text-violet-600",
    approved_user:    "text-emerald-600",
    rejected_user:    "text-red-500",
    requested_access: "text-yellow-600",
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {new Date(log.created_at).toLocaleString("en-GB", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{log.actor_email}</td>
      <td className={`px-4 py-3 text-sm font-medium ${actionColors[log.action] ?? "text-gray-500"}`}>
        {log.action.replace(/_/g, " ")}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{log.target_type ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">
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
    return <div className="text-sm text-gray-400 py-4">Loading permissions…</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-32">Role</th>
            {PERM_COLS.map((col) => (
              <th key={col.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const row = getPermRow(role);
            return (
              <tr key={role} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
        <p className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">
          Only superadmins can edit role permissions.
        </p>
      )}
    </div>
  );
}

// ─── Data Tools tab ───────────────────────────────────────────────────────────
const REPAIR_MODULES = [
  { slug: "bangladesh", label: "Bangladesh",   country: "Bangladesh" },
  { slug: "srilanka",   label: "Sri Lanka",    country: "Sri Lanka" },
  { slug: "nigeria",    label: "Nigeria",      country: "Nigeria" },
  { slug: "triumph",    label: "Triumph (UK)", country: "United Kingdom" },
  { slug: "vipar",      label: "VIPAR",        country: "VIPAR" },
];

type RepairState = { status: "idle" | "running" | "done" | "error"; result?: string };

function DataToolsTab() {
  const [states, setStates] = useState<Record<string, RepairState>>(
    Object.fromEntries(REPAIR_MODULES.map(m => [m.slug, { status: "idle" }]))
  );
  const [dryRun, setDryRun] = useState(true);

  async function runRepair(slug: string) {
    setStates(prev => ({ ...prev, [slug]: { status: "running" } }));
    try {
      const res  = await fetch("/api/bajaj/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleSlug: slug, dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");

      const msg = dryRun
        ? `Dry run: ${json.wouldUpdateNullRows} null rows + ${json.wouldFixSpellingVariants} variants`
        : `Updated ${json.updatedNullRows ?? 0} rows, fixed ${json.fixedVariants ?? 0} variants`;

      setStates(prev => ({ ...prev, [slug]: { status: "done", result: msg } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStates(prev => ({ ...prev, [slug]: { status: "error", result: msg } }));
    }
  }

  return (
    <div className="space-y-6">
      {/* dry-run toggle */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-800">Repair Mode</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dryRun
              ? "Dry run — shows what would change, no writes."
              : "Live — writes to the database. Double-check before running."}
          </p>
        </div>
        <button
          onClick={() => setDryRun(d => !d)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRun ? "bg-gray-200" : "bg-amber-500"}`}
        >
          <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${dryRun ? "translate-x-1" : "translate-x-6"}`} />
        </button>
      </div>

      {/* module repair cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPAIR_MODULES.map(m => {
          const st = states[m.slug];
          return (
            <div key={m.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">country = &quot;{m.country}&quot;</p>
              </div>

              {st.result && (
                <p className={`text-xs rounded-lg px-3 py-2 leading-relaxed ${st.status === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                  {st.status === "error"
                    ? <span className="flex items-start gap-1.5"><AlertTriangle className="size-3 mt-0.5 flex-shrink-0" />{st.result}</span>
                    : <span className="flex items-start gap-1.5"><CheckCircle2 className="size-3 mt-0.5 flex-shrink-0" />{st.result}</span>
                  }
                </p>
              )}

              <button
                onClick={() => runRepair(m.slug)}
                disabled={st.status === "running"}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  dryRun
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                } disabled:opacity-50`}
              >
                {st.status === "running"
                  ? <><Loader2 className="size-3.5 animate-spin" /> Running…</>
                  : dryRun
                    ? <><RefreshCw className="size-3.5" /> Dry Run</>
                    : <><Wrench className="size-3.5" /> Run Repair</>
                }
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Repair fixes rows in <code className="text-gray-500">bajaj_work_orders</code> where <code className="text-gray-500">country</code> is NULL, empty, or a spelling variant — assigning them the canonical country for that module. Run dry first to preview, then flip the toggle and run live.
      </p>

      {/* ── Danger: Clear all data ─────────────────────────────────── */}
      <ClearDataSection />
    </div>
  );
}

function ClearDataSection() {
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="size-4 text-red-500" />
        <p className="text-sm font-semibold text-red-700">Clear All Work Orders</p>
      </div>
      <p className="text-xs text-red-500 mb-4">
        Permanently deletes every row in <code>bajaj_work_orders</code> and <code>bajaj_wo_meta</code>. Cannot be undone. Use before re-importing fresh data.
      </p>
      {msg && (
        <p className={`text-xs mb-3 ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p>
      )}
      <button
        disabled={clearing}
        onClick={async () => {
          if (!confirm("Delete ALL work orders? This cannot be undone.")) return;
          setClearing(true);
          setMsg(null);
          try {
            const res = await fetch("/api/bajaj/work-orders/clear", { method: "DELETE" });
            if (!res.ok) throw new Error(await res.text());
            setMsg("✓ All work orders deleted. You can now re-import.");
          } catch (e: unknown) {
            setMsg(`✗ ${e instanceof Error ? e.message : "Unknown error"}`);
          } finally {
            setClearing(false);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
      >
        {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        {clearing ? "Clearing…" : "Clear All Data"}
      </button>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab]               = useState<"requests" | "audit" | "roles" | "data">("requests");
  const [searchEmail, setSearchEmail] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { bajajUser } = useAuthStore();
  const { data: allUsers = [] } = useBajajUsers();
  const { data: auditLogs = [] } = useBajajAuditLogs({
    actorEmail: searchEmail || undefined,
    action:     actionFilter || undefined,
    limit:      200,
  });

  const pendingUsers     = allUsers.filter((u) => u.status === "pending");
  const allUsersFiltered = searchEmail
    ? allUsers.filter((u) => u.email.includes(searchEmail))
    : allUsers;

  const isSuperAdmin = bajajUser?.role === "superadmin";

  const ACTIONS = [
    "moved_card", "assigned", "commented", "imported",
    "edited_field", "approved_user", "rejected_user", "requested_access",
  ];

  return (
    <div className="flex flex-col px-6 py-5" style={{ background: "#F5F5F5", minHeight: "100%" }}>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 bg-white -mx-6 px-6">
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 hover:text-gray-700"
          }`}
        >
          Access Requests
          {pendingUsers.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-[10px] text-white">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "audit"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 hover:text-gray-700"
          }`}
        >
          Audit Log
        </button>
        <button
          onClick={() => setTab("roles")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "roles"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 hover:text-gray-700"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          Roles &amp; Permissions
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setTab("data")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "data"
                ? "text-amber-600 border-b-2 border-amber-500"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Wrench className="size-3.5" />
            Data Tools
          </button>
        )}
      </div>

      {/* ── Access Requests tab ───────────────────────────────────── */}
      {tab === "requests" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsersFiltered.map((u) => (
                  <UserRow key={u.id} user={u} adminId={bajajUser?.id ?? ""} canManageRoles={isSuperAdmin} />
                ))}
                {allUsersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-amber-500 appearance-none transition-colors"
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
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
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Roles &amp; Permissions Matrix</h2>
            <p className="text-xs text-gray-400">
              Default permissions apply to all modules (<code className="text-gray-500">*</code>).
              {!isSuperAdmin && " Only superadmins can modify permissions."}
            </p>
          </div>
          <PermissionsMatrix isSuperAdmin={isSuperAdmin} />
        </div>
      )}

      {/* ── Data Tools tab ────────────────────────────────────────── */}
      {tab === "data" && <DataToolsTab />}
    </div>
  );
}
