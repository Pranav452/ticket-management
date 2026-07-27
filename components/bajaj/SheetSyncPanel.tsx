"use client";

import React, { useState } from "react";
import {
  RefreshCw, Eye, CheckCircle, AlertCircle, Loader2, Table2, CloudOff,
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
interface SheetSyncResult {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  /** Flattened per-tab results across all months (tabs carry .month). */
  tabs: TabSyncResult[];
  /** Current (latest active) month's bookings result. */
  bookings?: BookingsSyncResult;
  months?: MonthSyncResult[];
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

interface SheetSyncPanelProps {
  enabled: boolean;
  missingEnv: string[];
}

export function SheetSyncPanel({ enabled, missingEnv }: SheetSyncPanelProps) {
  const [running, setRunning] = useState<"preview" | "sync" | null>(null);
  const [result, setResult]   = useState<SheetSyncResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!dryRun && !window.confirm(
      "Sync the Google Sheet into the boards now?\n\nNew rows are inserted and existing card data is updated. When the sheet data reaches a later stage, cards auto-advance forward — they are never moved backward and nothing is ever deleted.\n\nThe bookings list is fully replaced from the sheet's \"Bookings Details\" tab."
    )) return;

    setRunning(dryRun ? "preview" : "sync");
    setError(null);
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
          </div>
        </div>
      </div>
    );
  }

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
              Work orders sync from the Google Sheet
            </h2>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
              Manual entry has been retired — the ops Google Sheet is now the single source of
              data. Each recognized tab (VIPAR, Sri Lanka, Bangladesh, Nigeria, Triumph) maps to
              its board. Syncing inserts new work orders and refreshes card data on existing ones.
              When the sheet data reaches a later stage, cards auto-advance forward — they are
              never moved backward, and rows are never deleted.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => run(true)}
                disabled={running !== null}
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
                disabled={running !== null}
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

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <CheckCircle className="size-4 text-emerald-500" />
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {result.dryRun ? "Preview — no changes written" : "Sync complete"}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-white/40 ml-auto">
              {result.totals.rows} sheet rows · {result.totals.inserted} {result.dryRun ? "to insert" : "inserted"} ·{" "}
              {result.totals.updated} {result.dryRun ? "to update" : "updated"} ·{" "}
              {result.totals.moved} {result.dryRun ? "to move" : "moved"} · {result.totals.unchanged} unchanged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-gray-400 dark:text-white/40 border-b border-gray-100 dark:border-white/5">
                  <th className="px-4 py-2 font-medium">Sheet tab</th>
                  <th className="px-2 py-2 font-medium">Board</th>
                  <th className="px-2 py-2 font-medium text-right">Rows</th>
                  <th className="px-2 py-2 font-medium text-right">{result.dryRun ? "Would insert" : "Inserted"}</th>
                  <th className="px-2 py-2 font-medium text-right">{result.dryRun ? "Would update" : "Updated"}</th>
                  <th className="px-2 py-2 font-medium text-right">{result.dryRun ? "Would move" : "Moved"}</th>
                  <th className="px-2 py-2 font-medium text-right">Unchanged</th>
                  <th className="px-4 py-2 font-medium text-right">Violations</th>
                </tr>
              </thead>
              <tbody>
                {result.tabs.map((t) => (
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

          {/* WO detail lists */}
          {result.tabs.some((t) => t.wouldInsert.length || t.wouldUpdate.length || t.wouldMove.length || t.violations.length || t.missingFromSheet.length) && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 space-y-3">
              {result.tabs.map((t) => {
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
                          {result.dryRun ? "Would insert" : "Inserted"}:
                        </span>{" "}
                        WO {t.wouldInsert.join(", ")}
                      </p>
                    )}
                    {t.wouldUpdate.length > 0 && (
                      <p className="text-[11px] text-gray-600 dark:text-white/60">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {result.dryRun ? "Would update" : "Updated"}:
                        </span>{" "}
                        WO {t.wouldUpdate.join(", ")}
                      </p>
                    )}
                    {t.wouldMove.length > 0 && (
                      <div className="text-[11px] text-gray-600 dark:text-white/60 space-y-0.5">
                        <span className="text-violet-600 dark:text-violet-400 font-medium">
                          {result.dryRun ? "Would move" : "Moved"}:
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
          )}

          {/* Bookings list */}
          {result.bookings && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">
                Bookings — {result.bookings.tab}
              </p>
              {result.bookings.error ? (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  Bookings not synced: {result.bookings.error}
                </p>
              ) : (
                <p className="text-[11px] text-gray-600 dark:text-white/60">
                  {result.bookings.rows} rows in the sheet · {result.bookings.previous} stored previously ·{" "}
                  {result.bookings.replaced ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">list replaced</span>
                  ) : (
                    <span className="text-gray-400 dark:text-white/40">preview — not replaced</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
