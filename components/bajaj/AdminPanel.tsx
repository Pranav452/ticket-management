"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, Search, Filter } from "lucide-react";
import { useBajajUsers, useApproveBajajUser, useRejectBajajUser, useBajajAuditLogs } from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajUser, BajajAuditLog } from "@/lib/types/bajaj";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-950/60 text-yellow-400 border-yellow-800",
    approved: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
    rejected: "bg-red-950/60 text-red-400 border-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
      {status}
    </span>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, adminId }: { user: BajajUser; adminId: string }) {
  const approve = useApproveBajajUser();
  const reject = useRejectBajajUser();

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-sm text-neutral-200">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-neutral-400">{user.email}</td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
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
    moved_card: "text-blue-400",
    assigned: "text-amber-400",
    commented: "text-neutral-400",
    imported: "text-emerald-400",
    edited_field: "text-violet-400",
    approved_user: "text-emerald-400",
    rejected_user: "text-red-400",
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
      <td className="px-4 py-3 text-xs text-neutral-600">
        {log.target_type ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-600 max-w-[200px] truncate">
        {log.new_value ? JSON.stringify(log.new_value) : "—"}
      </td>
    </tr>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab] = useState<"requests" | "audit">("requests");
  const [searchEmail, setSearchEmail] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { profile } = useAuthStore();
  const { data: allUsers = [] } = useBajajUsers();
  const { data: auditLogs = [] } = useBajajAuditLogs({
    actorEmail: searchEmail || undefined,
    action: actionFilter || undefined,
    limit: 200,
  });

  const pendingUsers = allUsers.filter((u) => u.status === "pending");
  const allUsersFiltered = searchEmail
    ? allUsers.filter((u) => u.email.includes(searchEmail))
    : allUsers;

  const ACTIONS = [
    "moved_card", "assigned", "commented", "imported",
    "edited_field", "approved_user", "rejected_user", "requested_access",
  ];

  return (
    <div className="min-h-full bg-neutral-950 px-8 py-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-100">Admin Panel</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage access requests and view the full audit log.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800">
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
      </div>

      {/* ── Access Requests tab ───────────────────────────────────── */}
      {tab === "requests" && (
        <div>
          {/* Search */}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsersFiltered.map((u) => (
                  <UserRow key={u.id} user={u} adminId={profile?.id ?? ""} />
                ))}
                {allUsersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-600">
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
          {/* Filters */}
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
    </div>
  );
}
