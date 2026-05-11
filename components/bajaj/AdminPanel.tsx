"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, Search, Filter, ShieldCheck, Wrench, RefreshCw, CheckCircle2, AlertTriangle, Trash2, Lock, Plus, X } from "lucide-react";
import {
  useBajajUsers,
  useApproveBajajUser,
  useRejectBajajUser,
  useBajajAuditLogs,
  useBajajRolePermissions,
  useUpdateBajajRolePermission,
  useUpdateBajajUserRole,
  useBajajColumnPerms,
  useUpsertColumnPerm,
  useDeleteColumnPerm,
  useBajajStatuses,
} from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajUser, BajajAuditLog, BajajRolePermission, BajajUserRole, BajajColumnPerm } from "@/lib/types/bajaj";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10"}`}>
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
    viewer:     "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10",
  };
  const r = role ?? "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[r] ?? "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10"}`}>
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
    <tr className="border-b border-gray-100 dark:border-white/6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-white/50">{user.email}</td>
      <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
      <td className="px-4 py-3">
        {canManageRoles ? (
          <select
            value={user.role ?? ""}
            onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value as BajajUserRole })}
            disabled={updateRole.isPending}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-700 dark:text-white/80 px-2 py-1 focus:outline-none focus:border-amber-500 disabled:opacity-50"
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
      <td className="px-4 py-3 text-sm text-gray-400 dark:text-white/40">{user.department ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40">
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
          <span className="text-xs text-gray-300 dark:text-white/25">—</span>
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
    commented:        "text-gray-500 dark:text-white/50",
    imported:         "text-emerald-600",
    edited_field:     "text-violet-600",
    approved_user:    "text-emerald-600",
    rejected_user:    "text-red-500",
    requested_access: "text-yellow-600",
  };

  return (
    <tr className="border-b border-gray-100 dark:border-white/6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40 whitespace-nowrap">
        {new Date(log.created_at).toLocaleString("en-GB", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-white/80">{log.actor_email}</td>
      <td className={`px-4 py-3 text-sm font-medium ${actionColors[log.action] ?? "text-gray-500 dark:text-white/50"}`}>
        {log.action.replace(/_/g, " ")}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40">{log.target_type ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40 max-w-[200px] truncate">
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
    return <div className="text-sm text-gray-400 dark:text-white/40 py-4">Loading permissions…</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-white/10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide w-32">Role</th>
            {PERM_COLS.map((col) => (
              <th key={col.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const row = getPermRow(role);
            return (
              <tr key={role} className="border-b border-gray-100 dark:border-white/6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
        <p className="px-4 py-2.5 text-xs text-gray-400 dark:text-white/40 border-t border-gray-100 dark:border-white/6">
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
      <div className="flex items-center justify-between bg-white dark:bg-[#0d0d0d] rounded-xl border border-gray-200 dark:border-white/10 px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Repair Mode</p>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
            {dryRun
              ? "Dry run — shows what would change, no writes."
              : "Live — writes to the database. Double-check before running."}
          </p>
        </div>
        <button
          onClick={() => setDryRun(d => !d)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRun ? "bg-gray-200 dark:bg-white/10" : "bg-amber-500"}`}
        >
          <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${dryRun ? "translate-x-1" : "translate-x-6"}`} />
        </button>
      </div>

      {/* module repair cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPAIR_MODULES.map(m => {
          const st = states[m.slug];
          return (
            <div key={m.slug} className="bg-white dark:bg-[#0d0d0d] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm px-5 py-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{m.label}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">country = &quot;{m.country}&quot;</p>
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
                    ? "bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-white/80"
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

      <p className="text-xs text-gray-400 dark:text-white/40 leading-relaxed">
        Repair fixes rows in <code className="text-gray-500 dark:text-white/50">bajaj_work_orders</code> where <code className="text-gray-500 dark:text-white/50">country</code> is NULL, empty, or a spelling variant — assigning them the canonical country for that module. Run dry first to preview, then flip the toggle and run live.
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

// ─── Column Permissions Tab ───────────────────────────────────────────────────
const MODULES_LIST = ["vipar","srilanka","nigeria","bangladesh","triumph"] as const;
const PERM_FLAGS: { key: keyof BajajColumnPerm; label: string }[] = [
  { key: "can_view",        label: "View" },
  { key: "can_edit_fields", label: "Edit Fields" },
  { key: "can_move_cards",  label: "Move Cards" },
  { key: "can_assign",      label: "Assign" },
];

function ColumnPermsTab() {
  const [selectedModule, setSelectedModule] = useState<string>("nigeria");
  const [addOpen,        setAddOpen]        = useState(false);
  const [newGranteeType, setNewGranteeType] = useState<"role" | "user">("role");
  const [newGrantee,     setNewGrantee]     = useState("");
  const [newPerms,       setNewPerms]       = useState({ can_view: true, can_edit_fields: false, can_move_cards: false, can_assign: false });

  const { data: perms = [], isLoading }  = useBajajColumnPerms(selectedModule);
  const { data: statuses = [] }          = useBajajStatuses(selectedModule);
  const upsert = useUpsertColumnPerm();
  const del    = useDeleteColumnPerm();

  function statusName(id: string | null) {
    if (!id) return "All columns";
    return statuses.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  }

  async function handleAdd() {
    if (!newGrantee.trim()) return;
    await upsert.mutateAsync({ module_slug: selectedModule, status_id: null, grantee_type: newGranteeType, grantee: newGrantee.trim(), ...newPerms });
    setAddOpen(false);
    setNewGrantee("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-0.5">Column-Level Permissions</h2>
          <p className="text-xs text-gray-400 dark:text-white/40">Per role or user, per Kanban column. User entries override role entries.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-700 dark:text-white/80 px-2.5 py-1.5 focus:outline-none focus:border-amber-500">
            {MODULES_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-medium text-white hover:bg-amber-600 transition-colors">
            <Plus className="size-3.5" /> Add Rule
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">New Permission Rule — {selectedModule}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Grantee Type</label>
              <select value={newGranteeType} onChange={(e) => setNewGranteeType(e.target.value as "role" | "user")}
                className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-700 dark:text-white/80 px-2 py-1.5 focus:outline-none focus:border-amber-500">
                <option value="role">Role</option>
                <option value="user">User (email)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">
                {newGranteeType === "role" ? "Role name" : "Email"}
              </label>
              {newGranteeType === "role" ? (
                <select value={newGrantee} onChange={(e) => setNewGrantee(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-700 dark:text-white/80 px-2 py-1.5 focus:outline-none focus:border-amber-500">
                  <option value="">— pick role —</option>
                  <option value="viewer">viewer</option>
                  <option value="operator">operator</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
              ) : (
                <input type="email" value={newGrantee} onChange={(e) => setNewGrantee(e.target.value)} placeholder="user@example.com"
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-700 dark:text-white/80 px-2 py-1.5 focus:outline-none focus:border-amber-500" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {PERM_FLAGS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-white/70 cursor-pointer">
                <input type="checkbox" checked={!!(newPerms as Record<string, unknown>)[f.key]}
                  onChange={() => setNewPerms((p) => ({ ...p, [f.key]: !p[f.key as keyof typeof p] }))}
                  className="size-3.5 rounded accent-amber-500" />
                {f.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newGrantee || upsert.isPending}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {upsert.isPending ? "Saving…" : "Save Rule"}
            </button>
            <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] shadow-sm">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-white/40"><Loader2 className="size-4 animate-spin inline mr-2" />Loading…</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Applies To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Grantee</th>
                {PERM_FLAGS.map((f) => (
                  <th key={f.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">{f.label}</th>
                ))}
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {perms.map((perm) => (
                <tr key={perm.id} className="border-b border-gray-100 dark:border-white/6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 dark:text-white/50">{statusName(perm.status_id)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${perm.grantee_type === "role" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"}`}>
                        {perm.grantee_type}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-white/80">{perm.grantee}</span>
                    </div>
                  </td>
                  {PERM_FLAGS.map((f) => (
                    <td key={f.key} className="px-3 py-3 text-center">
                      <button onClick={() => upsert.mutate({ module_slug: perm.module_slug, status_id: perm.status_id, grantee_type: perm.grantee_type, grantee: perm.grantee, ...Object.fromEntries(PERM_FLAGS.map((ff) => [ff.key, !!(perm as Record<string, unknown>)[ff.key]])), [f.key]: !(perm as Record<string, unknown>)[f.key] })}
                        className={`size-5 rounded flex items-center justify-center mx-auto text-[10px] font-bold transition-colors ${(perm as Record<string, unknown>)[f.key] ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-white/8 text-gray-300 dark:text-white/25"}`}>
                        {(perm as Record<string, unknown>)[f.key] ? "✓" : "✗"}
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <button onClick={() => del.mutate(perm.id)} className="size-5 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 dark:text-white/25 hover:text-red-500 transition-colors">
                      <X className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {perms.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/40">No permission rules for {selectedModule}. Click Add Rule to create one.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab]               = useState<"requests" | "audit" | "roles" | "data" | "colperms">("requests");
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
    <div className="flex flex-col px-6 py-5 bg-gray-100 dark:bg-[#0d0d0d]" style={{ minHeight: "100%" }}>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] -mx-6 px-6">
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
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
              : "text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
          }`}
        >
          Audit Log
        </button>
        <button
          onClick={() => setTab("roles")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "roles"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          Roles &amp; Permissions
        </button>
        <button
          onClick={() => setTab("colperms")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "colperms"
              ? "text-amber-600 border-b-2 border-amber-500"
              : "text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
          }`}
        >
          <Lock className="size-3.5" />
          Column Access
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setTab("data")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "data"
                ? "text-amber-600 border-b-2 border-amber-500"
                : "text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsersFiltered.map((u) => (
                  <UserRow key={u.id} user={u} adminId={bajajUser?.id ?? ""} canManageRoles={isSuperAdmin} />
                ))}
                {allUsersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/40">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-white/40 pointer-events-none" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-white/80 focus:outline-none focus:border-amber-500 appearance-none transition-colors"
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/40">
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
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-1">Roles &amp; Permissions Matrix</h2>
            <p className="text-xs text-gray-400 dark:text-white/40">
              Default permissions apply to all modules (<code className="text-gray-500 dark:text-white/50">*</code>).
              {!isSuperAdmin && " Only superadmins can modify permissions."}
            </p>
          </div>
          <PermissionsMatrix isSuperAdmin={isSuperAdmin} />
        </div>
      )}

      {/* ── Column Access tab ─────────────────────────────────────── */}
      {tab === "colperms" && <ColumnPermsTab />}

      {/* ── Data Tools tab ────────────────────────────────────────── */}
      {tab === "data" && <DataToolsTab />}
    </div>
  );
}
