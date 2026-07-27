"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle, XCircle, Loader2, Search, Filter,
  Trash2, Check,
  AlertTriangle, CheckCircle2, RefreshCw, Wrench, ChevronDown, ExternalLink,
} from "lucide-react";
import {
  useBajajUsers, useApproveBajajUser, useRejectBajajUser, useBajajAuditLogs,
} from "@/lib/queries/bajaj";
import { useBajajModules, useBajajBoardConfig, useUpdateBajajBoardConfig } from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SheetSyncPanel } from "@/components/bajaj/SheetSyncPanel";
import type { BajajUser, BajajAuditLog } from "@/lib/types/bajaj";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    approved: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-700"}`}>
      {status}
    </span>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, adminId }: { user: BajajUser; adminId: string }) {
  const approve = useApproveBajajUser();
  const reject = useRejectBajajUser();

  return (
    <tr className="border-b border-gray-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-sm text-gray-800 dark:text-neutral-200">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">{user.email}</td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-neutral-600">
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
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-100 dark:bg-red-900/60 text-xs text-red-700 dark:text-red-300 hover:bg-red-800 disabled:opacity-50 transition-colors border border-red-200 dark:border-red-800"
            >
              {reject.isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
              Reject
            </button>
          </div>
        )}
        {user.status !== "pending" && (
          <span className="text-xs text-gray-300 dark:text-neutral-700">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Audit log row ────────────────────────────────────────────────────────────
function AuditRow({ log }: { log: BajajAuditLog }) {
  const actionColors: Record<string, string> = {
    moved_card: "text-blue-700 dark:text-blue-400",
    assigned: "text-amber-400",
    commented: "text-gray-600 dark:text-neutral-400",
    imported: "text-emerald-700 dark:text-emerald-400",
    edited_field: "text-violet-700 dark:text-violet-400",
    approved_user: "text-emerald-700 dark:text-emerald-400",
    rejected_user: "text-red-700 dark:text-red-400",
    requested_access: "text-yellow-700 dark:text-yellow-400",
  };

  return (
    <tr className="border-b border-gray-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-neutral-600 whitespace-nowrap">
        {new Date(log.created_at).toLocaleString("en-GB", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{log.actor_email}</td>
      <td className={`px-4 py-3 text-sm font-medium ${actionColors[log.action] ?? "text-gray-600 dark:text-neutral-400"}`}>
        {log.action.replace(/_/g, " ")}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-neutral-600">
        {log.target_type ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-neutral-600 max-w-[200px] truncate">
        {log.new_value ? JSON.stringify(log.new_value) : "—"}
      </td>
    </tr>
  );
}

// ─── (Column Access / Required Fields / Auto-Progression / Business Rules tabs
//      removed — the Google Sheet drives movement and permissions are simple
//      roles: admin/superadmin edit, everyone else read-only.) ────────────────
const MODULE_SLUGS = ["vipar", "srilanka", "nigeria", "bangladesh", "triumph"];

// Canonical work-order data keys that can be shown as chips on board cards.
const CARD_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "category",     label: "Category (Parts/Frames)" },
  { key: "veh",          label: "Vehicle" },
  { key: "variant",      label: "Variant" },
  { key: "qty",          label: "Qty" },
  { key: "cont",         label: "Containers" },
  { key: "cont_type",    label: "Container Type" },
  { key: "veh_category", label: "Assembly" },
  { key: "haz",          label: "HAZ" },
  { key: "country",      label: "Country" },
  { key: "port",         label: "Port" },
  { key: "vslname",      label: "Vessel" },
  { key: "s_line",       label: "Shipping Line" },
  { key: "agent",        label: "Agent / CHA" },
  { key: "transporter",  label: "Transporter" },
  { key: "consignee",    label: "Consignee" },
  { key: "booking_no",   label: "Booking No" },
  { key: "container_no", label: "Container No" },
  { key: "current_etd",  label: "Current ETD" },
  { key: "stuffing_dt",  label: "Stuffing Date" },
  { key: "si_cutoff",    label: "SI Cutoff" },
  { key: "blno",         label: "BL No" },
  { key: "bldt",         label: "BL Date" },
  { key: "sbno",         label: "SB No" },
  { key: "plant",        label: "Plant" },
  { key: "po_no",        label: "PO No" },
  { key: "e_doc_status", label: "E-Doc Status" },
];

function CardDisplayTab() {
  const { data: modules = [] } = useBajajModules();
  const [slug, setSlug] = useState("vipar");
  const { data: config } = useBajajBoardConfig(slug);
  const update = useUpdateBajajBoardConfig();
  const [fields, setFields]       = useState<string[]>([]);
  const [uniqueKey, setUniqueKey] = useState("wo");
  const [saved, setSaved]         = useState(false);

  React.useEffect(() => {
    setFields(config?.card_face_fields ?? []);
    setUniqueKey(config?.unique_key_field ?? "wo");
    setSaved(false);
  }, [config, slug]);

  const moduleId = modules.find((m) => m.slug === slug)?.id;

  function toggle(key: string) {
    setSaved(false);
    setFields((prev) => prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]);
  }
  async function save() {
    if (!moduleId) return;
    await update.mutateAsync({ moduleId, cardFaceFields: fields, uniqueKeyField: uniqueKey || null });
    setSaved(true);
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
        Choose which fields appear as chips on the board cards for each module. Applies to all users
        (individual users can still override locally via the board&apos;s <span className="text-gray-700 dark:text-neutral-300">View</span> panel).
      </p>

      <div className="flex items-center gap-2 mb-5">
        {MODULE_SLUGS.map((s) => (
          <button
            key={s}
            onClick={() => setSlug(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              slug === s
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 p-4 mb-4">
        <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider mb-3">Card chips ({fields.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {CARD_FIELD_OPTIONS.map(({ key, label }) => {
            const on = fields.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  on
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-amber-600/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 p-4 mb-5">
        <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Unique key field</label>
        <select
          value={uniqueKey}
          onChange={(e) => { setUniqueKey(e.target.value); setSaved(false); }}
          className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-gray-800 dark:text-neutral-200 focus:outline-none focus:border-amber-600"
        >
          {[{ key: "wo", label: "WO Number" }, ...CARD_FIELD_OPTIONS].map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <p className="text-[11px] text-gray-400 dark:text-neutral-600 mt-1.5">Used for dedup on import and as the card&apos;s primary identifier.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={update.isPending || !moduleId}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save for {slug}
        </button>
        {saved && <span className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Saved</span>}
        {update.isError && <span className="text-sm text-red-700 dark:text-red-400">Failed — admin only.</span>}
      </div>
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
    <div className="rounded-lg border border-orange-200 dark:border-orange-900/40 overflow-hidden">
      {/* summary row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-50 dark:hover:bg-orange-950/50 px-3 py-2 text-xs transition-colors"
      >
        <AlertTriangle className="size-3.5 text-orange-700 dark:text-orange-400 flex-shrink-0" />
        <span className="font-medium text-orange-700 dark:text-orange-300 text-left flex-1">{v.vesselName}</span>
        <span className="tabular-nums font-semibold text-orange-700 dark:text-orange-400">{v.containerCount}</span>
        <span className="text-orange-600 mr-1">/ 25</span>
        <ChevronDown className={`size-3.5 text-orange-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* expanded WO list */}
      {open && (
        <div className="bg-gray-50 dark:bg-neutral-950/60 border-t border-orange-200 dark:border-orange-900/30 divide-y divide-gray-200 dark:divide-neutral-800/50">
          {v.workOrders.map(wo => (
            <a
              key={wo.id}
              href={`/bajaj/work-orders/${wo.id}`}
              className="flex items-center gap-3 px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors group"
            >
              <span className="text-[11px] font-mono text-gray-600 dark:text-neutral-400 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors">
                WO {wo.wo}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-neutral-600 flex-1 truncate">
                {wo.containers.length} container{wo.containers.length !== 1 ? "s" : ""}
                {wo.containers.length > 0 && (
                  <span className="text-gray-300 dark:text-neutral-700 ml-1">· {wo.containers.slice(0, 3).join(", ")}{wo.containers.length > 3 ? "…" : ""}</span>
                )}
              </span>
              <ExternalLink className="size-3 text-gray-300 dark:text-neutral-700 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors flex-shrink-0" />
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
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Existing Violations Audit</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Sri Lanka · LINKS only — container conflicts &amp; vessel over-limit</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Run Audit
        </button>
      </div>

      {err && <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-2 rounded-lg">{err}</p>}

      {result && total === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="size-3.5" /> No violations — all LINKS Sri Lanka data is clean.
        </div>
      )}

      {/* Container conflicts */}
      {(result?.containerConflicts.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-widest mb-2">
            Spare/Frame Container Conflicts ({result!.containerConflicts.length})
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {result!.containerConflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-3.5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <a href={`/bajaj/work-orders/${c.woId}`}
                        className="font-medium text-red-700 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200 hover:underline transition-colors">
                        WO {c.woA}
                      </a>
                      <span className="text-red-600">↔</span>
                      <span className="font-medium text-red-700 dark:text-red-300">WO {c.woB}</span>
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
          <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-widest mb-2">
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
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Country Repair</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Fix NULL / misspelled country values per module</p>
        </div>
        <button onClick={() => setDryRun(d => !d)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRun ? "bg-gray-200 dark:bg-neutral-700" : "bg-amber-500"}`}>
          <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${dryRun ? "translate-x-1" : "translate-x-6"}`} />
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-neutral-500">{dryRun ? "Dry run mode — no writes" : "⚠ Live mode — will write to DB"}</p>
      <div className="grid grid-cols-2 gap-3">
        {REPAIR_MODULES.map(m => {
          const st = states[m.slug];
          return (
            <div key={m.slug} className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-neutral-200">{m.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-neutral-600">&quot;{m.country}&quot;</p>
              </div>
              {st.result && (
                <p className={`text-[10px] rounded px-2 py-1 ${st.status === "error" ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"}`}>
                  {st.result}
                </p>
              )}
              <button onClick={() => runRepair(m.slug)} disabled={st.status === "running"}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-50 ${dryRun ? "bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300" : "bg-amber-600 hover:bg-amber-500 text-white"}`}>
                {st.status === "running" ? <><Loader2 className="size-3 animate-spin" />Running…</> : dryRun ? <><RefreshCw className="size-3" />Dry Run</> : <><Wrench className="size-3" />Run Repair</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
// Next stage will add "sheet-sources" and "versions" tabs — extend the union +
// ADMIN_TAB_KEYS + tabs list below when they land.
type AdminTab = "requests" | "card-display" | "audit" | "sync" | "data";
const ADMIN_TAB_KEYS: AdminTab[] = ["requests", "card-display", "audit", "sync", "data"];

export function AdminPanel({ sheetSync }: { sheetSync: { enabled: boolean; missingEnv: string[] } }) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<AdminTab>(
    urlTab && (ADMIN_TAB_KEYS as string[]).includes(urlTab) ? (urlTab as AdminTab) : "requests"
  );
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

  const tabs: { key: AdminTab; label: string; badge: number; danger?: boolean }[] = [
    { key: "requests",     label: "Access Requests",  badge: pendingUsers.length },
    { key: "card-display", label: "Card Display",     badge: 0 },
    { key: "audit",        label: "Audit Log",        badge: 0 },
    { key: "sync",         label: "Data Sync",        badge: 0 },
    { key: "data",         label: "Data",             badge: 0, danger: true },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-neutral-950 px-8 py-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Admin Panel</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Manage access requests, sheet sync, and the audit log.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? t.danger
                  ? "text-red-700 dark:text-red-400 border-b-2 border-red-500"
                  : "text-amber-400 border-b-2 border-amber-500"
                : "text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-neutral-600" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
            <table className="w-full">
              <thead className="bg-white dark:bg-neutral-900/80 border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsersFiltered.map((u) => (
                  <UserRow key={u.id} user={u} adminId={profile?.id ?? ""} />
                ))}
                {allUsersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-neutral-600">
                      No access requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Card Display tab ──────────────────────────────────────── */}
      {tab === "card-display" && <CardDisplayTab />}

      {/* ── Data tab ─────────────────────────────────────────────── */}
      {tab === "data" && (
        <div className="space-y-6 max-w-2xl">
          <ViolationsAuditPanel />
          <RepairModulesPanel />
          <div className="max-w-lg">
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="size-5 text-red-700 dark:text-red-400" />
              <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Clear All Work Orders</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mb-5">
              Permanently deletes every row in <code className="text-red-700 dark:text-red-300">bajaj_work_orders</code> and <code className="text-red-700 dark:text-red-300">bajaj_wo_meta</code>.
              This cannot be undone. Use before re-importing fresh data.
            </p>
            {clearMsg && (
              <p className={`text-sm mb-4 ${clearMsg.startsWith("✓") ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
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

      {/* ── Data Sync tab ────────────────────────────────────────── */}
      {tab === "sync" && (
        <div className="max-w-3xl">
          <SheetSyncPanel enabled={sheetSync.enabled} missingEnv={sheetSync.missingEnv} />
        </div>
      )}

      {/* ── Audit Log tab ─────────────────────────────────────────── */}
      {tab === "audit" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-neutral-600" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-neutral-600" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-gray-700 dark:text-neutral-300 focus:outline-none focus:border-amber-600 appearance-none"
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
            <table className="w-full">
              <thead className="bg-white dark:bg-neutral-900/80 border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-neutral-600">
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
