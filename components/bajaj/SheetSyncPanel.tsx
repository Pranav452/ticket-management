"use client";

import React, { useState } from "react";
import {
  RefreshCw, Eye, CheckCircle, AlertCircle, Loader2, Table2, CloudOff,
  Archive, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Mirrors SheetSyncResult from lib/bajaj/sheet-sync.ts (client-safe copy). */
interface TabSyncResult {
  tab: string;
  module: string;
  /** Month ("YYYY-MM") of the workbook this tab came from. */
  month?: string;
  rows: number;
  inserted: number;
  updated: number;
  moved: number;
  unchanged: number;
  violations: string[];
  missingFromSheet: string[];
  wouldInsert: string[];
  wouldUpdate: string[];
  wouldMove: string[];
}
interface BookingsSyncResult {
  tab: string;
  month?: string;
  rows: number;
  previous: number;
  replaced: boolean;
  error?: string;
}
interface MonthSyncResult {
  month: string;
  label: string;
  sheetId: string;
  tabs: TabSyncResult[];
  bookings?: BookingsSyncResult;
  error?: string;
}
interface UnclaimedRow {
  id: string;
  wo: string;
  module: string;
  month: string;
}
interface SheetSyncResult {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  /** Flattened per-tab results across all months (tabs carry .month). */
  tabs: TabSyncResult[];
  /** Current (latest active) month's bookings result. */
  bookings?: BookingsSyncResult;
  months?: MonthSyncResult[];
  /** Non-archived DB rows absent from their month's sheet. */
  unclaimedRows?: UnclaimedRow[];
  versionKey?: string;
  versionError?: string;
  totals: {
    rows: number;
    inserted: number;
    updated: number;
    moved: number;
    unchanged: number;
    violations: number;
    missingFromSheet: number;
  };
}
interface ArchiveMissingResult {
  ok: boolean;
  error?: string;
  archived: number;
  workOrders: string[];
  rows: UnclaimedRow[];
}

interface SheetSyncPanelProps {
  enabled: boolean;
  missingEnv: string[];
}

/* ── Per-tab result table (rendered once per month section) ──────────────── */
function TabTable({ tabs, dryRun }: { tabs: TabSyncResult[]; dryRun: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-gray-400 dark:text-white/40 border-b border-gray-100 dark:border-white/5">
            <th className="px-4 py-2 font-medium">Sheet tab</th>
            <th className="px-2 py-2 font-medium">Board</th>
            <th className="px-2 py-2 font-medium text-right">Rows</th>
            <th className="px-2 py-2 font-medium text-right">{dryRun ? "Would insert" : "Inserted"}</th>
            <th className="px-2 py-2 font-medium text-right">{dryRun ? "Would update" : "Updated"}</th>
            <th className="px-2 py-2 font-medium text-right">{dryRun ? "Would move" : "Moved"}</th>
            <th className="px-2 py-2 font-medium text-right">Unchanged</th>
            <th className="px-4 py-2 font-medium text-right">Violations</th>
          </tr>
        </thead>
        <tbody>
          {tabs.map((t) => (
            <tr key={`${t.month ?? ""}-${t.tab}`} className="border-b border-gray-50 dark:border-white/5 last:border-0">
              <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">{t.tab}</td>
              <td className="px-2 py-2 text-gray-500 dark:text-white/50">{t.module}</td>
              <td className="px-2 py-2 text-right text-gray-700 dark:text-white/70">{t.rows}</td>
              <td className={cn("px-2 py-2 text-right", t.inserted > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-gray-400 dark:text-white/30")}>
                {t.inserted}
              </td>
              <td className={cn("px-2 py-2 text-right", t.updated > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-400 dark:text-white/30")}>
                {t.updated}
              </td>
              <td className={cn("px-2 py-2 text-right", t.moved > 0 ? "text-violet-600 dark:text-violet-400 font-medium" : "text-gray-400 dark:text-white/30")}>
                {t.moved}
              </td>
              <td className="px-2 py-2 text-right text-gray-400 dark:text-white/40">{t.unchanged}</td>
              <td className={cn("px-4 py-2 text-right", t.violations.length > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-400 dark:text-white/30")}>
                {t.violations.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Per-tab WO detail lists ─────────────────────────────────────────────── */
function TabDetails({ tabs, dryRun }: { tabs: TabSyncResult[]; dryRun: boolean }) {
  const hasAny = tabs.some((t) => t.wouldInsert.length || t.wouldUpdate.length || t.wouldMove.length || t.violations.length || t.missingFromSheet.length);
  if (!hasAny) return null;
  return (
    <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 space-y-3">
      {tabs.map((t) => {
        const hasDetail = t.wouldInsert.length || t.wouldUpdate.length || t.wouldMove.length || t.violations.length || t.missingFromSheet.length;
        if (!hasDetail) return null;
        return (
          <div key={`detail-${t.month ?? ""}-${t.tab}`} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">
              {t.tab}
            </p>
            {t.wouldInsert.length > 0 && (
              <p className="text-[11px] text-gray-600 dark:text-white/60">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {dryRun ? "Would insert" : "Inserted"}:
                </span>{" "}
                WO {t.wouldInsert.join(", ")}
              </p>
            )}
            {t.wouldUpdate.length > 0 && (
              <p className="text-[11px] text-gray-600 dark:text-white/60">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {dryRun ? "Would update" : "Updated"}:
                </span>{" "}
                WO {t.wouldUpdate.join(", ")}
              </p>
            )}
            {t.wouldMove.length > 0 && (
              <div className="text-[11px] text-gray-600 dark:text-white/60 space-y-0.5">
                <span className="text-violet-600 dark:text-violet-400 font-medium">
                  {dryRun ? "Would move" : "Moved"}:
                </span>
                {t.wouldMove.map((m, i) => <p key={i}>WO {m}</p>)}
              </div>
            )}
            {t.violations.length > 0 && (
              <div className="text-[11px] text-red-600 dark:text-red-400 space-y-0.5">
                {t.violations.map((v, i) => <p key={i}>{v}</p>)}
              </div>
            )}
            {t.missingFromSheet.length > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                In the board but missing from the sheet (left untouched): WO{" "}
                {t.missingFromSheet.join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookingsLine({ bookings, monthLabel }: { bookings: BookingsSyncResult; monthLabel?: string }) {
  return (
    <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">
        Bookings{monthLabel ? ` — ${monthLabel}` : ""} ({bookings.tab})
      </p>
      {bookings.error ? (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          Bookings not synced: {bookings.error}
        </p>
      ) : (
        <p className="text-[11px] text-gray-600 dark:text-white/60">
          {bookings.rows} rows in the sheet · {bookings.previous} stored previously ·{" "}
          {bookings.replaced ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">list replaced</span>
          ) : (
            <span className="text-gray-400 dark:text-white/40">preview — not replaced</span>
          )}
        </p>
      )}
    </div>
  );
}

/* ── One collapsible section per workbook month ──────────────────────────── */
function MonthSection({ m, dryRun }: { m: MonthSyncResult; dryRun: boolean }) {
  const [open, setOpen] = useState(true);
  const monthTotals = m.tabs.reduce(
    (t, r) => ({ inserted: t.inserted + r.inserted, updated: t.updated + r.updated, moved: t.moved + r.moved }),
    { inserted: 0, updated: 0, moved: 0 },
  );
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5 text-left"
      >
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{m.label}</span>
        <span className="text-[11px] font-mono text-gray-400 dark:text-white/40">{m.month}</span>
        {m.error ? (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
            failed
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-white/40 ml-auto mr-2">
            +{monthTotals.inserted} · ↻{monthTotals.updated} · →{monthTotals.moved}
          </span>
        )}
        <ChevronDown className={cn("size-3.5 text-gray-400 dark:text-white/40 transition-transform flex-shrink-0", open && "rotate-180", m.error && "ml-auto")} />
      </button>

      {open && (
        m.error ? (
          <div className="flex items-start gap-2 px-4 py-3">
            <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700 dark:text-red-400">{m.error}</p>
          </div>
        ) : (
          <>
            <TabTable tabs={m.tabs} dryRun={dryRun} />
            <TabDetails tabs={m.tabs} dryRun={dryRun} />
            {m.bookings && <BookingsLine bookings={m.bookings} />}
          </>
        )
      )}
    </div>
  );
}

export function SheetSyncPanel({ enabled, missingEnv }: SheetSyncPanelProps) {
  const [running, setRunning] = useState<"preview" | "sync" | null>(null);
  const [result, setResult]   = useState<SheetSyncResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Archive-missing flow
  const [showUnclaimed, setShowUnclaimed] = useState(false);
  const [archiving, setArchiving]         = useState(false);
  const [archResult, setArchResult]       = useState<ArchiveMissingResult | null>(null);

  async function run(dryRun: boolean) {
    if (!dryRun && !window.confirm(
      "Sync every ACTIVE monthly workbook into the boards now?\n\nNew rows are inserted and existing card data is updated. When the sheet data reaches a later stage, cards auto-advance forward — they are never moved backward and nothing is ever deleted.\n\nEach month's bookings list is fully replaced from that workbook's \"Bookings Details\" tab, and a version snapshot is stored afterwards."
    )) return;

    setRunning(dryRun ? "preview" : "sync");
    setError(null);
    setArchResult(null);
    setShowUnclaimed(false);
    try {
      const res  = await fetch("/api/bajaj/sheet-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dryRun }),
      });
      const json = (await res.json()) as SheetSyncResult;
      if (!res.ok || !json.ok) {
        setResult(null);
        setError(json.error ?? `Sync failed (HTTP ${res.status})`);
      } else {
        setResult(json);
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRunning(null);
    }
  }

  async function runArchiveMissing() {
    const count = result?.unclaimedRows?.length ?? 0;
    if (count === 0) return;
    if (!window.confirm(
      `Archive ${count} work order${count !== 1 ? "s" : ""} missing from their month's workbook?\n\nArchived cards leave the boards but are NOT deleted — they move to the Archive page and are auto-restored if their row reappears in the sheet.`
    )) return;

    setArchiving(true);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/sheet-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "archiveMissing" }),
      });
      const json = (await res.json()) as ArchiveMissingResult;
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Archive failed (HTTP ${res.status})`);
      } else {
        setArchResult(json);
        setShowUnclaimed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  }

  /* ── Not configured ────────────────────────────────────────────────────── */
  if (!enabled) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
            <CloudOff className="size-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">
              Google Sheet sync is not configured
            </h2>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1">
              Work-order data now lives in the shared Google Sheet. To enable syncing,
              set the following environment variables and restart the app:
            </p>
            <ul className="mt-2 space-y-1">
              {missingEnv.map((name) => (
                <li key={name} className="text-[12px] font-mono text-amber-600 dark:text-amber-400">
                  {name}
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-2">
              Monthly workbooks are then managed under the <span className="font-medium">Sheet Sources</span> tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const unclaimed = result?.unclaimedRows ?? [];

  return (
    <div className="space-y-4">
      {/* Explainer + actions */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
            <Table2 className="size-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">
              Work orders sync from the monthly Google workbooks
            </h2>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
              Manual entry has been retired — the ops Google workbooks are the single source
              of data, one per month (managed in the Sheet Sources tab). Each recognized tab
              (VIPAR, Sri Lanka, Bangladesh, Nigeria, Triumph) maps to its board and every
              card keeps its workbook month. Syncing inserts new work orders and refreshes
              card data; cards auto-advance forward when the sheet reaches a later stage —
              never backward, and rows are never deleted. After a real sync a version
              snapshot is stored (Versions tab).
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => run(true)}
                disabled={running !== null || archiving}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-white/10",
                  "px-3 py-1.5 text-[12px] font-medium text-gray-700 dark:text-white/80",
                  "hover:bg-gray-50 dark:hover:bg-white/5 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {running === "preview"
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Eye className="size-3.5" />}
                Preview changes
              </button>
              <button
                onClick={() => run(false)}
                disabled={running !== null || archiving}
                className={cn(
                  "flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700",
                  "px-3 py-1.5 text-[12px] font-medium text-white transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {running === "sync"
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <RefreshCw className="size-3.5" />}
                Sync now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Archive result */}
      {archResult && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="size-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[12px] text-emerald-700 dark:text-emerald-400 font-medium">
                Archived {archResult.archived} work order{archResult.archived !== 1 ? "s" : ""}.
              </p>
              {archResult.workOrders.length > 0 && (
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70 mt-1 break-words">
                  WO {archResult.workOrders.join(", ")}
                </p>
              )}
              <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/60 mt-1">
                They are now on the Archive page and will auto-restore if they reappear in the sheet.
              </p>
            </div>
            <button onClick={() => setArchResult(null)} className="ml-auto text-emerald-600/60 hover:text-emerald-700 dark:text-emerald-400/60 dark:hover:text-emerald-300">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Totals strip */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="size-4 text-emerald-500" />
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                {result.dryRun ? "Preview — no changes written" : "Sync complete"}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-white/40">
                {result.months?.length ?? 0} workbook{(result.months?.length ?? 0) !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-white/40 ml-auto tabular-nums">
                {result.totals.rows} sheet rows · {result.totals.inserted} {result.dryRun ? "to insert" : "inserted"} ·{" "}
                {result.totals.updated} {result.dryRun ? "to update" : "updated"} ·{" "}
                {result.totals.moved} {result.dryRun ? "to move" : "moved"} · {result.totals.unchanged} unchanged
                {result.totals.violations > 0 && <> · <span className="text-red-500">{result.totals.violations} violations</span></>}
                {result.totals.missingFromSheet > 0 && <> · <span className="text-amber-500">{result.totals.missingFromSheet} missing</span></>}
              </span>
            </div>
            {result.versionError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                Snapshot warning: {result.versionError}
              </p>
            )}
          </div>

          {/* Per-month sections */}
          {(result.months ?? []).map((m) => (
            <MonthSection key={m.month} m={m} dryRun={result.dryRun} />
          ))}

          {/* Unclaimed rows / archive-missing */}
          {unclaimed.length > 0 && !archResult && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <Archive className="size-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-[12px] text-amber-700 dark:text-amber-400">
                  <span className="font-semibold">{unclaimed.length}</span> work order{unclaimed.length !== 1 ? "s are" : " is"} in
                  the boards but missing from their month&apos;s workbook. The sync never touches them —
                  archive them explicitly to park them off the boards.
                </p>
                <button
                  onClick={() => setShowUnclaimed((v) => !v)}
                  className="ml-auto flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0"
                >
                  {showUnclaimed ? "Hide list" : "Review list"}
                  <ChevronDown className={cn("size-3 transition-transform", showUnclaimed && "rotate-180")} />
                </button>
              </div>

              {showUnclaimed && (
                <>
                  <div className="border-t border-amber-200/70 dark:border-amber-500/20 max-h-56 overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-amber-700/70 dark:text-amber-400/60">
                          <th className="px-4 py-1.5 font-medium">WO</th>
                          <th className="px-2 py-1.5 font-medium">Board</th>
                          <th className="px-4 py-1.5 font-medium">Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unclaimed.map((u) => (
                          <tr key={u.id} className="border-t border-amber-100 dark:border-amber-500/10">
                            <td className="px-4 py-1.5 font-mono text-gray-800 dark:text-white/80">{u.wo || u.id.slice(0, 8)}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-white/60">{u.module}</td>
                            <td className="px-4 py-1.5 font-mono text-gray-600 dark:text-white/60">{u.month}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-amber-200/70 dark:border-amber-500/20">
                    <button
                      onClick={runArchiveMissing}
                      disabled={archiving || running !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
                    >
                      {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                      Archive {unclaimed.length} missing
                    </button>
                    <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60">
                      Cards are stamped archived — never deleted — and auto-restore if the sheet row returns.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
