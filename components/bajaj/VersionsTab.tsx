"use client";

/**
 * Admin › Versions — board snapshots written after every successful real sheet
 * sync (lib/bajaj/versions.ts keeps the newest 15). Rollback restores a
 * snapshot wholesale via POST /api/bajaj/sheet-sync { action: "rollback" },
 * guarded by a typed confirmation ("ROLLBACK").
 */

import React, { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionEntry {
  key: string;
  created_at: string;
  actor: string;
  workOrders: number;
  moved: number;
  inserted: number;
}

interface RollbackResult {
  ok: boolean;
  error?: string;
  restored?: number;
  deleted?: number;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function VersionsTab() {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Rollback dialog state
  const [target, setTarget]         = useState<VersionEntry | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [rollingBack, setRollingBack] = useState(false);
  const [result, setResult]         = useState<{ key: string; res: RollbackResult } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/versions");
      const json = (await res.json().catch(() => ({}))) as { versions?: VersionEntry[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setVersions(Array.isArray(json.versions) ? json.versions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runRollback() {
    if (!target || confirmText !== "ROLLBACK") return;
    setRollingBack(true);
    try {
      const res = await fetch("/api/bajaj/sheet-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "rollback", versionKey: target.key }),
      });
      const json = (await res.json().catch(() => ({}))) as RollbackResult;
      setResult({ key: target.key, res: json.ok ? json : { ok: false, error: json.error ?? `HTTP ${res.status}` } });
    } catch (e) {
      setResult({ key: target.key, res: { ok: false, error: e instanceof Error ? e.message : "Rollback failed" } });
    } finally {
      setRollingBack(false);
      setTarget(null);
      setConfirmText("");
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-900/20 flex-shrink-0">
            <History className="size-4 text-violet-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">Board version snapshots</h2>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
              A full snapshot of every board (work orders + per-month bookings) is stored
              after each successful real sync — the newest 15 are kept. Rolling back
              restores the snapshot wholesale: rows are upserted, rows created after the
              snapshot are deleted (their comments go with them), and the bookings lists
              are restored.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3">
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Rollback result */}
      {result && (
        <div className={cn(
          "flex items-start gap-2 rounded-xl border p-3",
          result.res.ok
            ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10",
        )}>
          {result.res.ok
            ? <CheckCircle2 className="size-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />}
          <p className={cn("text-[12px]", result.res.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
            {result.res.ok
              ? <>Rollback complete — {result.res.restored ?? 0} work orders restored, {result.res.deleted ?? 0} newer rows removed.</>
              : <>Rollback failed: {result.res.error}</>}
          </p>
          <button onClick={() => setResult(null)} className="ml-auto text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Versions table */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Snapshots</span>
          <span className="text-[11px] text-gray-400 dark:text-white/40">newest first · max 15 kept</span>
          <button onClick={load} disabled={loading}
            className="ml-auto size-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors disabled:opacity-50"
            title="Reload">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 dark:text-white/40">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-gray-400 dark:text-white/40">
            No snapshots yet — one is written after every successful real sync.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-400 dark:text-white/40 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Actor</th>
                <th className="px-2 py-2 font-medium text-right">Work orders</th>
                <th className="px-2 py-2 font-medium text-right">Inserted</th>
                <th className="px-2 py-2 font-medium text-right">Moved</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.key} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-white whitespace-nowrap">{formatWhen(v.created_at)}</td>
                  <td className="px-2 py-2.5 text-gray-500 dark:text-white/50">{v.actor}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-white/70">{v.workOrders}</td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums", v.inserted > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-white/30")}>{v.inserted}</td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums", v.moved > 0 ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-white/30")}>{v.moved}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => { setTarget(v); setConfirmText(""); setResult(null); }}
                      disabled={rollingBack}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 dark:border-red-500/30 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Undo2 className="size-3" /> Rollback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Typed-confirmation dialog */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 flex-shrink-0">
                <AlertTriangle className="size-4.5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">Roll back the boards?</p>
                <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
                  This restores the snapshot from <span className="font-medium text-gray-800 dark:text-white/80">{formatWhen(target.created_at)}</span>{" "}
                  ({target.workOrders} work orders, by {target.actor}). Rows created after
                  that snapshot are deleted, along with their comments. This cannot be undone.
                </p>
              </div>
            </div>

            <label className="block text-[11px] font-medium text-gray-500 dark:text-white/50 mt-4 mb-1">
              Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">ROLLBACK</span> to confirm
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-[13px] font-mono text-gray-800 dark:text-white/90 focus:border-red-400 focus:outline-none"
              placeholder="ROLLBACK"
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setTarget(null); setConfirmText(""); }}
                disabled={rollingBack}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runRollback}
                disabled={confirmText !== "ROLLBACK" || rollingBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {rollingBack ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                Roll back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
