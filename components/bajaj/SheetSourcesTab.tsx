"use client";

/**
 * Admin › Sheet Sources — the monthly Google-workbook list behind the sync.
 * Reads GET /api/bajaj/sheet-sources, saves the full list via PUT.
 * Sheet IDs are masked to first/last 6 chars in the table; the share hint
 * shows the service-account email (never the private key).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2, Plus, RefreshCw, Table2, AlertCircle, CheckCircle2, ArchiveRestore, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetSource {
  month: string; // "YYYY-MM"
  label: string;
  sheetId: string;
  status: "active" | "archived";
}

interface SourcesResponse {
  updated_at: string | null;
  sources: SheetSource[];
  envFallback: SheetSource | null;
  serviceAccountEmail: string | null;
}

function maskSheetId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

/* "2026-07" → "July 2026" */
function autoLabel(month: string): string {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function SheetSourcesTab() {
  const [data, setData]       = useState<SourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  // Add form
  const [newMonth, setNewMonth]     = useState("");
  const [newLabel, setNewLabel]     = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [newSheetId, setNewSheetId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/sheet-sources");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? `HTTP ${res.status}`);
      setData((await res.json()) as SourcesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sheet sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(sources: SheetSource[]) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/bajaj/sheet-sources", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sources }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Save failed (HTTP ${res.status})`);
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const sources = data?.sources ?? [];
  const sorted = [...sources].sort((a, b) => b.month.localeCompare(a.month));

  function toggleStatus(month: string) {
    const next = sources.map((s): SheetSource =>
      s.month === month ? { ...s, status: s.status === "active" ? "archived" : "active" } : s,
    );
    save(next);
  }

  function addSource(e: React.FormEvent) {
    e.preventDefault();
    const month = newMonth.trim();
    const sheetId = newSheetId.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { setError('Month must be "YYYY-MM".'); return; }
    if (!sheetId) { setError("Sheet ID is required."); return; }
    if (sources.some((s) => s.month === month)) { setError(`A source for ${month} already exists.`); return; }
    const label = (labelTouched && newLabel.trim()) || autoLabel(month);
    // If the config was empty, keep the env-fallback source so history stays reachable.
    const base = sources.length === 0 && data?.envFallback ? [data.envFallback] : sources;
    const next = base.some((s) => s.month === month)
      ? base
      : [...base, { month, label, sheetId, status: "active" as const }];
    save(next);
    setNewMonth(""); setNewLabel(""); setLabelTouched(false); setNewSheetId("");
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
            <Table2 className="size-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">Monthly workbook sources</h2>
            <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
              Ops starts a new Google workbook each month (same tab layout). Every ACTIVE
              source is pulled on each sync; archive a month once all its shipments are
              closed to stop syncing it. Cards keep their workbook month
              (<code className="text-[11px]">sheet_month</code>) either way.
            </p>
            <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-2 leading-relaxed">
              Every workbook must be shared (Viewer access) with the sync service account
              {data?.serviceAccountEmail
                ? <>: <span className="font-mono text-[11px] break-all">{data.serviceAccountEmail}</span></>
                : " (the GOOGLE_SA_EMAIL address)"}
              . Without that share the sync returns a 403 for that month.
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

      {/* Sources table */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Configured workbooks</span>
          <span className="text-[11px] text-gray-400 dark:text-white/40">
            {sorted.length} source{sorted.length !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-3.5" /> Saved</span>}
            <button onClick={load} disabled={loading || saving}
              className="size-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors disabled:opacity-50"
              title="Reload">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 dark:text-white/40">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-gray-400 dark:text-white/40">
            No sources configured yet.
            {data?.envFallback && (
              <span className="block mt-1">
                Falling back to the BAJAJ_SHEET_ID env workbook ({data.envFallback.label} ·{" "}
                <span className="font-mono">{maskSheetId(data.envFallback.sheetId)}</span>).
                It is auto-registered on the first real sync.
              </span>
            )}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-400 dark:text-white/40 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-2 py-2 font-medium">Label</th>
                <th className="px-2 py-2 font-medium">Sheet ID</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.month} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-white">{s.month}</td>
                  <td className="px-2 py-2.5 text-gray-700 dark:text-white/70">{s.label}</td>
                  <td className="px-2 py-2.5 font-mono text-gray-500 dark:text-white/50" title="Masked — full id stays server-side">
                    {maskSheetId(s.sheetId)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                      s.status === "active"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border-gray-200 dark:border-neutral-700",
                    )}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => toggleStatus(s.month)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {s.status === "active"
                        ? <><Archive className="size-3" /> Archive</>
                        : <><ArchiveRestore className="size-3" /> Reactivate</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add source form */}
      <form onSubmit={addSource} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-4 space-y-3">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Add a month&apos;s workbook</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">Month</label>
            <input
              type="month"
              value={newMonth}
              onChange={(e) => {
                setNewMonth(e.target.value);
                if (!labelTouched) setNewLabel(e.target.value ? autoLabel(e.target.value) : "");
              }}
              className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">Label</label>
            <input
              type="text"
              value={newLabel}
              placeholder="August 2026"
              onChange={(e) => { setNewLabel(e.target.value); setLabelTouched(true); }}
              className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">Google Sheet ID</label>
            <input
              type="text"
              value={newSheetId}
              placeholder="the long id in the sheet URL"
              onChange={(e) => setNewSheetId(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] font-mono text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add source
          </button>
          <p className="text-[11px] text-gray-400 dark:text-white/40">
            Remember to share the new workbook with the service account first.
          </p>
        </div>
      </form>
    </div>
  );
}
