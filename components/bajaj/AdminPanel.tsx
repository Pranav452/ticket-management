"use client";

import React, { useState } from "react";
import {
  CheckCircle, XCircle, Loader2, Search, Filter,
  Trash2, Plus, ShieldCheck, ShieldOff, Check,
  AlertTriangle, CheckCircle2, RefreshCw, Wrench, ChevronDown, ExternalLink,
  BookOpen, ShieldAlert, Bell, Zap, Lock, Eye, Users,
} from "lucide-react";
import {
  useBajajUsers, useApproveBajajUser, useRejectBajajUser, useBajajAuditLogs,
  useBajajColumnAssignments, useUpsertColumnAssignment, useDeleteColumnAssignment,
  useBajajColumnRequests, useReviewColumnRequest,
  useColumnRequiredFields, useUpsertColumnRequiredField, useDeleteColumnRequiredField,
  useAutoProgressionRules, useUpsertAutoProgressionRule, useDeleteAutoProgressionRule,
} from "@/lib/queries/bajaj";
import { useBajajModules, useBajajStatuses } from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajUser, BajajAuditLog, BajajColumnAssignment, BajajColumnRequest } from "@/lib/types/bajaj";

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

// ─── Column Assignments Tab ───────────────────────────────────────────────────
function ColumnAssignmentsTab() {
  const { data: modules = [] } = useBajajModules();
  const [selectedModule, setSelectedModule] = useState<string>("");
  const moduleSlug = selectedModule || modules[0]?.slug || "";

  const { data: assignments = [], isLoading: loadingAssign } = useBajajColumnAssignments(moduleSlug);
  const { data: requests = [], isLoading: loadingReqs } = useBajajColumnRequests(moduleSlug);
  const { data: statuses = [] } = useBajajStatuses(moduleSlug);
  const { data: allUsersRaw = [] } = useBajajUsers();
  const allUsers = allUsersRaw.filter((u) => u.status === "approved");

  const upsert = useUpsertColumnAssignment();
  const deleteAssign = useDeleteColumnAssignment();
  const reviewRequest = useReviewColumnRequest();

  const [newEmail, setNewEmail] = useState("");
  const [newStatusId, setNewStatusId] = useState<string>("__all__");
  const [newCanEdit, setNewCanEdit] = useState(true);
  const [newCanMove, setNewCanMove] = useState(true);
  const [newCanAssign, setNewCanAssign] = useState(true);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  function handleAdd() {
    if (!newEmail || !moduleSlug) return;
    upsert.mutate({
      module_slug: moduleSlug,
      status_id: newStatusId === "__all__" ? null : newStatusId,
      user_email: newEmail,
      can_edit: newCanEdit,
      can_move: newCanMove,
      can_assign: newCanAssign,
    }, {
      onSuccess: () => {
        setNewEmail("");
        setNewStatusId("__all__");
        setNewCanEdit(true);
        setNewCanMove(true);
        setNewCanAssign(true);
      },
    });
  }

  const moduleChoices = modules.length > 0 ? modules : [{ slug: moduleSlug, name: moduleSlug }];

  return (
    <div className="space-y-8">

      {/* Module selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-neutral-400 font-medium">Module</label>
        <select
          value={selectedModule || moduleSlug}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-amber-600"
        >
          {moduleChoices.map((m) => (
            <option key={m.slug} value={m.slug}>{m.name || m.slug}</option>
          ))}
        </select>
      </div>

      {/* Pending access requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            Column Access Requests
            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-[10px] text-white">{pendingRequests.length}</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-900/80 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Column</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((r) => {
                  const statusName = r.status_id
                    ? (statuses.find((s) => s.id === r.status_id)?.name ?? r.status_id)
                    : "All columns";
                  return (
                    <tr key={r.id} className="border-b border-neutral-800 hover:bg-neutral-900/50">
                      <td className="px-4 py-3 text-sm text-neutral-200">{r.user_email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-400">{statusName}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 max-w-[200px] truncate">{r.reason ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => reviewRequest.mutate({ id: r.id, status: "approved" })}
                            disabled={reviewRequest.isPending}
                            className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-700 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                          >
                            <ShieldCheck className="size-3" /> Approve
                          </button>
                          <button
                            onClick={() => reviewRequest.mutate({ id: r.id, status: "rejected" })}
                            disabled={reviewRequest.isPending}
                            className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-900/60 text-xs text-red-300 hover:bg-red-800 disabled:opacity-50 transition-colors border border-red-800"
                          >
                            <ShieldOff className="size-3" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current assignments */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Current Assignments</h2>

        {/* Add form */}
        <div className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">User email</label>
            <input
              type="email"
              list="approved-emails"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 w-52"
            />
            <datalist id="approved-emails">
              {allUsers.map((u) => <option key={u.id} value={u.email} />)}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Column</label>
            <select
              value={newStatusId}
              onChange={(e) => setNewStatusId(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-amber-600"
            >
              <option value="__all__">All columns</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-500">Permissions</label>
            <div className="flex items-center gap-3">
              {(["can_edit", "can_move", "can_assign"] as const).map((flag) => {
                const checked = flag === "can_edit" ? newCanEdit : flag === "can_move" ? newCanMove : newCanAssign;
                const setter = flag === "can_edit" ? setNewCanEdit : flag === "can_move" ? setNewCanMove : setNewCanAssign;
                return (
                  <label key={flag} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setter(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-xs text-neutral-400">{flag.replace("can_", "")}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!newEmail || upsert.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {upsert.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Assign
          </button>
        </div>

        {loadingAssign ? (
          <div className="flex items-center gap-2 py-6 text-neutral-500 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-900/80 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Column</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wide">Edit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wide">Move</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wide">Assign</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const statusName = a.status_id
                    ? (statuses.find((s) => s.id === a.status_id)?.name ?? a.status_id)
                    : <span className="text-neutral-500 italic">All columns</span>;
                  const Tick = ({ v }: { v: boolean }) => (
                    <span className={v ? "text-emerald-400" : "text-neutral-700"}>
                      {v ? <CheckCircle className="size-4 mx-auto" /> : <XCircle className="size-4 mx-auto" />}
                    </span>
                  );
                  return (
                    <tr key={a.id} className="border-b border-neutral-800 hover:bg-neutral-900/50">
                      <td className="px-4 py-3 text-sm text-neutral-200">{a.user_email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-400">{statusName}</td>
                      <td className="px-4 py-3 text-center"><Tick v={a.can_edit} /></td>
                      <td className="px-4 py-3 text-center"><Tick v={a.can_move} /></td>
                      <td className="px-4 py-3 text-center"><Tick v={a.can_assign} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteAssign.mutate({ id: a.id, moduleSlug })}
                          disabled={deleteAssign.isPending}
                          className="p-1 rounded hover:bg-red-900/40 text-neutral-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-600">
                      No assignments yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column Rules Tab ─────────────────────────────────────────────────────────
const LIFECYCLE_NAMES = [
  "Planning", "Booking Request", "Booking", "Container Allocation",
  "SI Filing", "Custom Clearance", "Gate Open", "Billing", "BL Release", "Completed",
];

// All known field keys with friendly labels
const ALL_FIELD_KEYS: { key: string; label: string }[] = [
  { key: "wo",             label: "WO Number" },
  { key: "agent",          label: "CHA / Agent" },
  { key: "plant",          label: "Plant" },
  { key: "veh",            label: "Brand / Vehicle" },
  { key: "type",           label: "Variant" },
  { key: "qty",            label: "Quantity" },
  { key: "cont",           label: "Containers" },
  { key: "country",        label: "Country" },
  { key: "ib_stuffing_date", label: "IB Stuffing Date" },
  { key: "s_line",         label: "Carrier / Shipping Line" },
  { key: "vslname",        label: "Vessel Name" },
  { key: "vessel_etd",     label: "Vessel ETD" },
  { key: "booking_no",     label: "Booking Number" },
  { key: "port_cut_off",   label: "Port Cut-off" },
  { key: "si_cutoff",      label: "SI Cut-off" },
  { key: "docs_cut_off",   label: "Docs Cut-off" },
  { key: "do_etd",         label: "DO ETD" },
  { key: "vgm_cut_off",    label: "VGM Cut-off" },
  { key: "transporter",    label: "Transporter" },
  { key: "current_etd",    label: "Current ETD" },
  { key: "erp_exp_no",     label: "ERP-EXP Number" },
  { key: "container_no",   label: "Container Numbers" },
  { key: "sbno",           label: "SB Number" },
  { key: "hbl_no",         label: "HBL Number" },
  { key: "gross_weight",   label: "Gross Weight" },
  { key: "net_weight",     label: "Net Weight" },
  { key: "pkgs_cases",     label: "Pkgs / Cases" },
  { key: "mbl_no",         label: "MBL Number" },
  { key: "pol",            label: "POL" },
  { key: "leo_date",       label: "LEO Date" },
  { key: "gate_in_date",   label: "Gate In Date" },
  { key: "gate_details",   label: "Gate Details" },
  { key: "e_doc",          label: "E-Docs" },
  { key: "bldt",           label: "BL Date" },
  { key: "invoice_no",     label: "Invoice Number" },
];

const MODULE_SLUGS = ["vipar", "srilanka", "nigeria", "bangladesh", "triumph"];

function ColumnRulesTab() {
  const [selectedModule, setSelectedModule] = useState("vipar");
  const [openStage, setOpenStage]           = useState<string | null>("Booking Request");

  const { data: rules = [], isLoading } = useColumnRequiredFields(selectedModule);
  const upsert = useUpsertColumnRequiredField();
  const remove  = useDeleteColumnRequiredField();

  function isRequired(statusName: string, fieldKey: string) {
    const row = rules.find((r) => r.status_name === statusName);
    return row?.field_keys.includes(fieldKey) ?? false;
  }

  function toggle(statusName: string, fieldKey: string) {
    const currently = isRequired(statusName, fieldKey);
    if (currently) {
      remove.mutate({ module_slug: selectedModule, status_name: statusName, field_key: fieldKey });
    } else {
      upsert.mutate({ module_slug: selectedModule, status_name: statusName, field_key: fieldKey });
    }
  }

  // Stages with requirements (skip Planning + Completed for simplicity)
  const activeStages = LIFECYCLE_NAMES.filter(
    (n) => n !== "Planning" && n !== "Completed"
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-neutral-100">Column Rules</h2>
          <p className="text-[12px] text-neutral-500 mt-0.5">
            Check the fields that must be filled before a card auto-advances to the next column.
          </p>
        </div>
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:outline-none focus:border-amber-600"
        >
          {MODULE_SLUGS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-neutral-500 py-8">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {activeStages.map((stageName) => {
            const stageRules = rules.find((r) => r.status_name === stageName);
            const count = stageRules?.field_keys.length ?? 0;
            const isOpen = openStage === stageName;

            return (
              <div key={stageName} className="rounded-xl border border-neutral-800 overflow-hidden">
                {/* Accordion header */}
                <button
                  onClick={() => setOpenStage(isOpen ? null : stageName)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-neutral-900 hover:bg-neutral-900/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-neutral-200">{stageName}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 border border-amber-600/30 font-medium">
                        {count} required
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-600 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="px-4 py-4 bg-neutral-950 grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {ALL_FIELD_KEYS.map(({ key, label }) => {
                      const checked = isRequired(stageName, key);
                      const busy = upsert.isPending || remove.isPending;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <button
                            disabled={busy}
                            onClick={() => toggle(stageName, key)}
                            className={`size-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                              checked
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "bg-neutral-900 border-neutral-700 group-hover:border-amber-600/60"
                            }`}
                          >
                            {checked && <Check className="size-2.5" />}
                          </button>
                          <span className={`text-[12px] transition-colors ${checked ? "text-neutral-200 font-medium" : "text-neutral-500 group-hover:text-neutral-400"}`}>
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Violations Audit ─────────────────────────────────────────────────────────
interface WOSummary { id: string; wo: string; qty: number; containers: string[] }
interface VesselViolation { vesselName: string; containerCount: number; workOrders: WOSummary[] }
interface ContainerConflict { woId: string; woA: string; woB: string; containers: string[]; assyA: string; assyB: string }
interface AuditResult {
  containerConflicts: ContainerConflict[];
  vesselViolations:   VesselViolation[];
}

function VesselViolationRow({ v }: { v: VesselViolation }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-orange-900/40 overflow-hidden">
      {/* summary row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-orange-950/30 hover:bg-orange-950/50 px-3 py-2 text-xs transition-colors"
      >
        <AlertTriangle className="size-3.5 text-orange-400 flex-shrink-0" />
        <span className="font-medium text-orange-300 text-left flex-1">{v.vesselName}</span>
        <span className="tabular-nums font-semibold text-orange-400">{v.containerCount}</span>
        <span className="text-orange-600 mr-1">/ 25</span>
        <ChevronDown className={`size-3.5 text-orange-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* expanded WO list */}
      {open && (
        <div className="bg-neutral-950/60 border-t border-orange-900/30 divide-y divide-neutral-800/50">
          {v.workOrders.map(wo => (
            <a
              key={wo.id}
              href={`/bajaj/work-orders/${wo.id}`}
              className="flex items-center gap-3 px-3 py-2 hover:bg-orange-950/20 transition-colors group"
            >
              <span className="text-[11px] font-mono text-neutral-400 group-hover:text-orange-300 transition-colors">
                WO {wo.wo}
              </span>
              <span className="text-[11px] text-neutral-600 flex-1 truncate">
                {wo.containers.length} container{wo.containers.length !== 1 ? "s" : ""}
                {wo.containers.length > 0 && (
                  <span className="text-neutral-700 ml-1">· {wo.containers.slice(0, 3).join(", ")}{wo.containers.length > 3 ? "…" : ""}</span>
                )}
              </span>
              <ExternalLink className="size-3 text-neutral-700 group-hover:text-orange-400 transition-colors flex-shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ViolationsAuditPanel() {
  const [result,  setResult]  = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  async function run() {
    setLoading(true); setErr(null); setResult(null);
    try {
      const res  = await fetch("/api/bajaj/validation");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Audit failed");
      setResult(json);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  const total = (result?.containerConflicts.length ?? 0) + (result?.vesselViolations.length ?? 0);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-100">Existing Violations Audit</p>
          <p className="text-xs text-neutral-500 mt-0.5">Sri Lanka · LINKS only — container conflicts &amp; vessel over-limit</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Run Audit
        </button>
      </div>

      {err && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 px-3 py-2 rounded-lg">{err}</p>}

      {result && total === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="size-3.5" /> No violations — all LINKS Sri Lanka data is clean.
        </div>
      )}

      {/* Container conflicts */}
      {(result?.containerConflicts.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">
            Spare/Frame Container Conflicts ({result!.containerConflicts.length})
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {result!.containerConflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <a href={`/bajaj/work-orders/${c.woId}`}
                        className="font-medium text-red-300 hover:text-red-200 hover:underline transition-colors">
                        WO {c.woA}
                      </a>
                      <span className="text-red-600">↔</span>
                      <span className="font-medium text-red-300">WO {c.woB}</span>
                    </div>
                    <p className="text-red-500 mt-0.5 truncate">
                      Container: {c.containers.join(", ")} · {c.assyA} vs {c.assyB}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vessel violations — expandable */}
      {(result?.vesselViolations.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">
            Vessels Over 25 Containers ({result!.vesselViolations.length}) · click to expand
          </p>
          <div className="space-y-1.5">
            {result!.vesselViolations.map((v, i) => (
              <VesselViolationRow key={i} v={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Repair Modules ───────────────────────────────────────────────────────────
const REPAIR_MODULES = [
  { slug: "bangladesh", label: "Bangladesh",   country: "Bangladesh" },
  { slug: "srilanka",   label: "Sri Lanka",    country: "Sri Lanka" },
  { slug: "nigeria",    label: "Nigeria",      country: "Nigeria" },
  { slug: "triumph",    label: "Triumph (UK)", country: "United Kingdom" },
  { slug: "vipar",      label: "VIPAR",        country: "VIPAR" },
];

type RepairState = { status: "idle" | "running" | "done" | "error"; result?: string };

function RepairModulesPanel() {
  const [states,  setStates]  = useState<Record<string, RepairState>>(
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
        ? `Dry run: ${json.wouldUpdateNullRows} null + ${json.wouldFixSpellingVariants} variants`
        : `Updated ${json.updatedNullRows ?? 0} rows, fixed ${json.fixedVariants ?? 0} variants`;
      setStates(prev => ({ ...prev, [slug]: { status: "done", result: msg } }));
    } catch (e: unknown) {
      setStates(prev => ({ ...prev, [slug]: { status: "error", result: e instanceof Error ? e.message : String(e) } }));
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-100">Country Repair</p>
          <p className="text-xs text-neutral-500 mt-0.5">Fix NULL / misspelled country values per module</p>
        </div>
        <button onClick={() => setDryRun(d => !d)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRun ? "bg-neutral-700" : "bg-amber-500"}`}>
          <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${dryRun ? "translate-x-1" : "translate-x-6"}`} />
        </button>
      </div>
      <p className="text-xs text-neutral-500">{dryRun ? "Dry run mode — no writes" : "⚠ Live mode — will write to DB"}</p>
      <div className="grid grid-cols-2 gap-3">
        {REPAIR_MODULES.map(m => {
          const st = states[m.slug];
          return (
            <div key={m.slug} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-2">
              <div>
                <p className="text-xs font-semibold text-neutral-200">{m.label}</p>
                <p className="text-[10px] text-neutral-600">&quot;{m.country}&quot;</p>
              </div>
              {st.result && (
                <p className={`text-[10px] rounded px-2 py-1 ${st.status === "error" ? "bg-red-950/40 text-red-400" : "bg-emerald-950/40 text-emerald-400"}`}>
                  {st.result}
                </p>
              )}
              <button onClick={() => runRepair(m.slug)} disabled={st.status === "running"}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-50 ${dryRun ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300" : "bg-amber-600 hover:bg-amber-500 text-white"}`}>
                {st.status === "running" ? <><Loader2 className="size-3 animate-spin" />Running…</> : dryRun ? <><RefreshCw className="size-3" />Dry Run</> : <><Wrench className="size-3" />Run Repair</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Auto-Progression Tab ─────────────────────────────────────────────────────
const MODULE_SLUGS_LABELS: { slug: string; label: string }[] = [
  { slug: "vipar",      label: "VIPAR" },
  { slug: "srilanka",   label: "Sri Lanka" },
  { slug: "nigeria",    label: "Nigeria" },
  { slug: "bangladesh", label: "Bangladesh" },
  { slug: "triumph",    label: "Triumph" },
];

const LIFECYCLE_TARGETS = [
  "Planning", "Booking Request", "Booking", "Container Allocation",
  "SI Filing", "Custom Clearance", "Gate Open", "BL Release", "Billing", "Completed",
];

function AutoProgressionTab() {
  const [selectedModule, setSelectedModule] = useState("srilanka");
  const [triggerField,   setTriggerField]   = useState("");
  const [targetStage,    setTargetStage]    = useState(LIFECYCLE_TARGETS[2]);
  const [description,    setDescription]    = useState("");

  const { data: rules = [], isLoading } = useAutoProgressionRules(selectedModule);
  const upsert = useUpsertAutoProgressionRule();
  const remove  = useDeleteAutoProgressionRule();

  function handleAdd() {
    if (!triggerField.trim() || !targetStage) return;
    upsert.mutate({
      module_slug:        selectedModule,
      trigger_field:      triggerField.trim().toLowerCase(),
      target_status_name: targetStage,
      description:        description.trim() || undefined,
    }, { onSuccess: () => { setTriggerField(""); setDescription(""); } });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-neutral-100">Auto-Progression Rules</h2>
        <p className="text-[12px] text-neutral-500 mt-1">
          When a field goes from empty → filled on save, the work order automatically
          advances to the target stage — but only if it hasn&apos;t already passed it.
        </p>
      </div>

      {/* Module selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-neutral-500 font-medium">Module</label>
        <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-amber-600">
          {MODULE_SLUGS_LABELS.map(m => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
      </div>

      {/* Add rule form */}
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Add Rule</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Trigger field (data key)</label>
            <input
              type="text"
              value={triggerField}
              onChange={e => setTriggerField(e.target.value)}
              placeholder="e.g. booking_no, sbno, blno"
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Move to stage</label>
            <select value={targetStage} onChange={e => setTargetStage(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-amber-600">
              {LIFECYCLE_TARGETS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Booking number received → advance to Booking stage"
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 w-full"
          />
        </div>
        <button onClick={handleAdd} disabled={!triggerField.trim() || upsert.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {upsert.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-neutral-500 text-sm py-4">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4">No auto-progression rules for this module yet.</p>
      ) : (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900/80 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Trigger field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">→ Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-b border-neutral-800 hover:bg-neutral-900/50">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-neutral-800 text-amber-300 px-1.5 py-0.5 rounded">{r.trigger_field}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-300">{r.target_status_name}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{r.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove.mutate({ id: r.id, moduleSlug: selectedModule })}
                      disabled={remove.isPending}
                      className="p-1 rounded hover:bg-red-900/40 text-neutral-600 hover:text-red-400 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-xs text-neutral-500 space-y-1">
        <p className="font-semibold text-neutral-400">⚠ Notes</p>
        <p>• LINKS invoice_no → Completed is hard-coded and always active (not listed here).</p>
        <p>• A WO never moves backwards — if it&apos;s already at or past the target stage, the rule is skipped.</p>
        <p>• If multiple rules fire on the same save, the WO moves to the highest-order stage triggered.</p>
        <p>• The field key must match the exact JSONB key used in the work order data (case-insensitive).</p>
      </div>
    </div>
  );
}

// ─── Business Rules Tab ───────────────────────────────────────────────────────

interface RuleSection {
  icon: React.ReactNode;
  title: string;
  color: string;
  borderColor: string;
  rules: { label: string; detail: string; tag?: string; tagColor?: string }[];
}

const BIZ_RULES: RuleSection[] = [
  {
    icon: <Lock className="size-4" />,
    title: "Hard Blocks — Cannot be overridden",
    color: "text-red-400",
    borderColor: "border-red-900/50",
    rules: [
      {
        label: "Billing prerequisites",
        detail: "A work order cannot enter the Billing stage until BL Number, SB Number, and E-Document are all filled in. No override possible.",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
      {
        label: "HAZ container isolation",
        detail: "A work order marked as HAZ (hazardous cargo) cannot share a container number with any non-HAZ work order, and vice versa. Applies to all modules. No override possible.",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
    ],
  },
  {
    icon: <ShieldAlert className="size-4" />,
    title: "Soft Blocks — Can be overridden with confirmation",
    color: "text-amber-400",
    borderColor: "border-amber-900/50",
    rules: [
      {
        label: "Spare parts + frames in same container",
        detail: "Spare parts (assy_config contains 'spare') and frame/SKD units (assy_config contains 'frame', 'skd', or 'f.k.d') cannot share the same container. User sees a warning and must confirm to override.",
        tag: "Sri Lanka · LINKS only",
        tagColor: "bg-blue-950 text-blue-400",
      },
      {
        label: "More than 25 containers per vessel",
        detail: "A single vessel cannot carry more than 25 containers worth of LINKS Sri Lanka work orders. If adding a container would push the vessel over 25, the user is warned and must confirm to override.",
        tag: "Sri Lanka · LINKS only",
        tagColor: "bg-blue-950 text-blue-400",
      },
      {
        label: "Required fields gate (admin-configurable)",
        detail: "Before a card can be moved to a stage, all fields configured as 'required' for that stage must be filled. Configured per-module in the Required Fields tab. User sees which fields are missing and can override.",
        tag: "Configurable",
        tagColor: "bg-amber-950 text-amber-400",
      },
    ],
  },
  {
    icon: <Zap className="size-4" />,
    title: "Auto-Progressions — System moves the card automatically",
    color: "text-emerald-400",
    borderColor: "border-emerald-900/50",
    rules: [
      {
        label: "LINKS invoice → Completed",
        detail: "When a work order with agent = LINKS has its Invoice Number field filled for the first time (was empty, now set), the system automatically moves it to the Completed stage.",
        tag: "Sri Lanka · LINKS only",
        tagColor: "bg-blue-950 text-blue-400",
      },
      {
        label: "Admin-configurable field → stage",
        detail: "Admins can define additional field-triggered progressions in the Auto-Progression tab. When a trigger field goes from empty → filled, the WO advances to the configured target stage if it hasn't already passed it.",
        tag: "Configurable",
        tagColor: "bg-amber-950 text-amber-400",
      },
    ],
  },
  {
    icon: <Bell className="size-4" />,
    title: "Automated Alerts — Sent by email to assignees + superadmins",
    color: "text-violet-400",
    borderColor: "border-violet-900/50",
    rules: [
      {
        label: "BL Release 48-hour overdue alert",
        detail: "If a work order has a Sailing Date set but no BL Number, and the sailing date was between 0–48 hours ago, an alert email is sent to the BL Release column assignees and all superadmins. Fires on every field save AND via hourly cron (Vercel Cron, 0 * * * *).",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
      {
        label: "SI Cutoff missed alert",
        detail: "If the SI Cutoff date has passed and the SI has not been filed (si_filed / sifiling / sifile fields all empty), an alert email is sent to the SI Filing column assignees and all superadmins. Deduped — fires at most once per work order per day. Fires on field save AND via daily cron (0 6 * * *, 6am UTC).",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
      {
        label: "Reminder system",
        detail: "Admins and operators can create manual reminders with a future due date, a message, and a recipient list. The reminder cron (30 3 * * *, 3:30am UTC) fires emails for all pending reminders whose due_at has passed. Reminders with a past due date are rejected at creation time.",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
    ],
  },
  {
    icon: <Users className="size-4" />,
    title: "Access & Roles",
    color: "text-sky-400",
    borderColor: "border-sky-900/50",
    rules: [
      {
        label: "New user default role",
        detail: "When an admin approves a new user access request, the user is always granted the 'viewer' role by default — regardless of any previous DB value. Role can be upgraded manually after approval.",
        tag: "Security",
        tagColor: "bg-red-950 text-red-400",
      },
      {
        label: "Admin page access guard",
        detail: "The Admin Panel is only accessible to users with role = 'admin' or 'superadmin' AND status = 'approved'. All other users are silently redirected to /bajaj/home. The nav link is also hidden for non-admins.",
        tag: "Security",
        tagColor: "bg-red-950 text-red-400",
      },
      {
        label: "Superadmin-only role grants",
        detail: "Only a superadmin can grant the superadmin role to another user. Admins can only assign admin-or-below. This prevents privilege escalation.",
        tag: "Security",
        tagColor: "bg-red-950 text-red-400",
      },
      {
        label: "Column auto-assignment",
        detail: "When a card is moved to a new stage, if exactly one user is assigned to that column with can_edit = true, the system auto-populates the assigned_to_<stage> field on the work order. If multiple users are assigned, no auto-assignment (ambiguous — human decides).",
        tag: "Configurable",
        tagColor: "bg-amber-950 text-amber-400",
      },
    ],
  },
  {
    icon: <Eye className="size-4" />,
    title: "Validations & Data Integrity",
    color: "text-neutral-300",
    borderColor: "border-neutral-700",
    rules: [
      {
        label: "Reminder due date must be in the future",
        detail: "Creating a reminder with a due date in the past or equal to now is rejected with a 400 error at the API level.",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
      {
        label: "BL Release before Billing in lifecycle",
        detail: "The workflow lifecycle order is: Planning → Booking Request → Booking → Container Allocation → SI Filing → Custom Clearance → Gate Open → BL Release → Billing → Completed. BL Release (7) always comes before Billing (8).",
        tag: "All modules",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
      {
        label: "Violations audit (admin tool)",
        detail: "The Data tab provides a manual audit tool that scans all Sri Lanka LINKS work orders for: (1) spare/frame container conflicts, and (2) vessels with more than 25 containers. Results show expandable vessel rows with deep-links to each work order.",
        tag: "Sri Lanka · LINKS only",
        tagColor: "bg-blue-950 text-blue-400",
      },
      {
        label: "Country field repair tool",
        detail: "The Data tab includes a repair utility that finds work orders with null or misspelled country values per module and normalises them to the canonical country name. Supports dry-run mode before writing.",
        tag: "Admin tool",
        tagColor: "bg-neutral-800 text-neutral-400",
      },
    ],
  },
];

function BusinessRulesTab() {
  return (
    <div className="max-w-3xl space-y-6 pb-8">
      <div>
        <h2 className="text-[15px] font-semibold text-neutral-100 flex items-center gap-2">
          <BookOpen className="size-4 text-amber-400" />
          Custom Business Rules — Reference
        </h2>
        <p className="text-[12px] text-neutral-500 mt-1">
          Every rule enforced by the system. Read-only — for engineering changes, update <code className="text-amber-400/80">lib/bajaj/workflow.ts</code>.
        </p>
      </div>

      {BIZ_RULES.map(section => (
        <div key={section.title} className={`rounded-xl border ${section.borderColor} overflow-hidden`}>
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-neutral-900/80 border-b border-neutral-800">
            <span className={section.color}>{section.icon}</span>
            <span className={`text-[13px] font-semibold ${section.color}`}>{section.title}</span>
          </div>

          {/* Rules */}
          <div className="divide-y divide-neutral-800/60">
            {section.rules.map((rule, i) => (
              <div key={i} className="px-4 py-3.5 bg-neutral-950/40 hover:bg-neutral-900/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-neutral-200">{rule.label}</p>
                  {rule.tag && (
                    <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${rule.tagColor}`}>
                      {rule.tag}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">{rule.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-[11px] text-neutral-700 pt-2">
        Last updated: auto-generated from workflow engine · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab] = useState<"requests" | "columns" | "rules" | "autoprogress" | "bizrules" | "audit" | "data">("requests");
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
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

  const tabs: { key: "requests" | "columns" | "rules" | "autoprogress" | "bizrules" | "audit" | "data"; label: string; badge: number; danger?: boolean }[] = [
    { key: "requests",     label: "Access Requests",  badge: pendingUsers.length },
    { key: "columns",      label: "Column Access",    badge: 0 },
    { key: "rules",        label: "Required Fields",  badge: 0 },
    { key: "autoprogress", label: "Auto-Progression", badge: 0 },
    { key: "bizrules",     label: "Business Rules",   badge: 0 },
    { key: "audit",        label: "Audit Log",        badge: 0 },
    { key: "data",         label: "Data",             badge: 0, danger: true },
  ];

  return (
    <div className="min-h-full bg-neutral-950 px-8 py-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-100">Admin Panel</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage access requests, column permissions, and the audit log.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? t.danger
                  ? "text-red-400 border-b-2 border-red-500"
                  : "text-amber-400 border-b-2 border-amber-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-600 text-[10px] text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
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

      {/* ── Column Access tab ─────────────────────────────────────── */}
      {tab === "columns" && <ColumnAssignmentsTab />}

      {/* ── Data tab ─────────────────────────────────────────────── */}
      {tab === "data" && (
        <div className="space-y-6 max-w-2xl">
          <ViolationsAuditPanel />
          <RepairModulesPanel />
          <div className="max-w-lg">
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="size-5 text-red-400" />
              <h2 className="text-base font-semibold text-red-300">Clear All Work Orders</h2>
            </div>
            <p className="text-sm text-neutral-400 mb-5">
              Permanently deletes every row in <code className="text-red-300">bajaj_work_orders</code> and <code className="text-red-300">bajaj_wo_meta</code>.
              This cannot be undone. Use before re-importing fresh data.
            </p>
            {clearMsg && (
              <p className={`text-sm mb-4 ${clearMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                {clearMsg}
              </p>
            )}
            <button
              disabled={clearing}
              onClick={async () => {
                if (!confirm("Delete ALL work orders? This is irreversible.")) return;
                setClearing(true);
                setClearMsg(null);
                try {
                  const res = await fetch("/api/bajaj/work-orders/clear", { method: "DELETE" });
                  if (!res.ok) throw new Error(await res.text());
                  setClearMsg("✓ All work orders deleted. You can now re-import.");
                } catch (e: unknown) {
                  setClearMsg(`✗ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
                } finally {
                  setClearing(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {clearing ? "Clearing…" : "Clear All Data"}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ── Required Fields tab ──────────────────────────────────── */}
      {tab === "rules" && <ColumnRulesTab />}

      {/* ── Auto-Progression tab ─────────────────────────────────── */}
      {tab === "autoprogress" && <AutoProgressionTab />}

      {/* ── Business Rules tab ───────────────────────────────────── */}
      {tab === "bizrules" && <BusinessRulesTab />}

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
    </div>
  );
}
