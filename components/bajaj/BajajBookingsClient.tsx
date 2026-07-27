"use client";

/**
 * Booking desk + rate-card view, stored as JSON in app_config. Bookings are
 * synced from the Google Sheet ("Bookings Details" tab) and are read-only in
 * the app — the sheet is the single source of truth. The rate card remains
 * editable here (optimistic lock so two desks editing at once don't silently
 * clobber each other).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, DollarSign, Search, RefreshCw, Plus, Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useSelectedMonthParam } from "@/lib/stores/month";
import { MonthSelector } from "@/components/bajaj/MonthSelector";
import { cn } from "@/lib/utils";

type Tab = "bookings" | "rates";
type Booking = Record<string, string>;

const BOOKING_COLS: { key: string; label: string }[] = [
  { key: "ref_no",        label: "Ref No" },
  { key: "bkg_no",        label: "Booking No" },
  { key: "bkg_no_alt",    label: "Alt Booking" },
  { key: "cntr_qty",      label: "Cntr Qty" },
  { key: "pod",           label: "POD" },
  { key: "place_req_vsl", label: "Required Vessel" },
  { key: "received_vsl",  label: "Received Vessel" },
  { key: "etd_required",  label: "ETD (req)" },
  { key: "etd_received",  label: "ETD (recv)" },
  { key: "line",          label: "Line" },
  { key: "validity",      label: "Validity" },
  { key: "remark",        label: "Remark" },
  { key: "wo_ref",        label: "WO Ref" },
];

function remarkClass(remark: string): string {
  const r = remark.toUpperCase();
  if (r.includes("CANCEL")) return "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30";
  if (r.includes("HOLD"))   return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30";
  if (r.includes("RELEAS")) return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30";
  if (r.includes("PLAN"))   return "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30";
  if (r.includes("AVAIL") || r.includes("TAKE")) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";
  return "bg-gray-50 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10";
}

export function BajajBookingsClient() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Rate-card editing
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [ratesEdit, setRatesEdit] = useState(false);
  const [gridDraft, setGridDraft] = useState<string[][]>([]);
  const [savingRates, setSavingRates] = useState(false);

  // Global month filter — bookings live per workbook month
  // (app_config "bajaj_bookings:<YYYY-MM>"); no month = legacy/current key.
  const month = useSelectedMonthParam();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bookingsUrl = month
        ? `/api/bajaj/reference?type=bookings&month=${month}`
        : "/api/bajaj/reference?type=bookings";
      const [b, r] = await Promise.all([
        fetch(bookingsUrl).then((x) => x.json()),
        fetch("/api/bajaj/reference?type=rates").then((x) => x.json()),
      ]);
      setBookings(Array.isArray(b.rows) ? b.rows : []);
      setUpdatedAt(b.updated_at ?? null);
      setGrid(Array.isArray(r.grid) ? r.grid : []);
      setRatesUpdatedAt(r.updated_at ?? null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  function startRatesEdit() { setGridDraft(grid.map((row) => [...row])); setRatesEdit(true); setError(null); }
  function cancelRatesEdit() { setRatesEdit(false); setGridDraft([]); }
  function setCell(ri: number, ci: number, v: string) {
    setGridDraft((g) => g.map((row, r) => (r === ri ? row.map((c, cI) => (cI === ci ? v : c)) : row)));
  }
  function addRatesRow() { setGridDraft((g) => [...g, Array(g[0]?.length ?? 1).fill("")]); }
  function addRatesCol() { setGridDraft((g) => g.map((row) => [...row, ""])); }
  function deleteRatesRow(ri: number) { setGridDraft((g) => g.filter((_, r) => r !== ri)); }

  async function saveRates() {
    setSavingRates(true);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/reference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rates", grid: gridDraft, baseUpdatedAt: ratesUpdatedAt }),
      });
      if (res.status === 409) { setError("The rate card was changed by someone else. Reloading…"); await load(); setRatesEdit(false); return; }
      if (!res.ok) throw new Error("Save failed");
      const payload = await res.json();
      setGrid(Array.isArray(payload.grid) ? payload.grid : gridDraft);
      setRatesUpdatedAt(payload.updated_at ?? null);
      setRatesEdit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingRates(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter((b) => JSON.stringify(b).toLowerCase().includes(q));
  }, [bookings, search]);

  const tabBtn = (t: Tab, label: string, Icon: typeof BookOpen) => (
    <button
      onClick={() => setTab(t)}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
        tab === t
          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400"
          : "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:border-gray-300 dark:hover:border-white/20")}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--main-bg)" }}>
      <div className="p-5 max-w-screen-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white/90">Bookings &amp; Rates</h1>
            <p className="text-[13px] text-gray-500 dark:text-white/50 mt-0.5">Bookings sync from the Google Sheet · rate card editable</p>
          </div>
          <div className="flex items-center gap-2">
            <MonthSelector />
            {tabBtn("bookings", `Bookings (${bookings.length})`, BookOpen)}
            {tabBtn("rates", "Rate Card", DollarSign)}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
            <AlertTriangle className="size-3.5 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 dark:text-white/40"><RefreshCw className="size-5 animate-spin" /></div>
        ) : tab === "bookings" ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-gray-500 dark:text-white/50"><span className="font-medium text-gray-800 dark:text-white/90">{filteredBookings.length}</span> bookings</span>
                {updatedAt && (
                  <span className="text-[12px] text-gray-400 dark:text-white/40">
                    Last synced {new Date(updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 dark:text-white/40 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings…"
                  className="h-8 w-56 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] pl-8 pr-3 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161616]">
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      {BOOKING_COLS.map((c) => <th key={c.key} className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr><td colSpan={BOOKING_COLS.length} className="px-4 py-8 text-center text-gray-400 dark:text-white/40">No bookings.</td></tr>
                    ) : filteredBookings.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                        {BOOKING_COLS.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2 text-gray-700 dark:text-white/70 whitespace-nowrap", c.key === "bkg_no" && "font-mono font-medium")}>
                            {c.key === "remark" ? (
                              b.remark ? (
                                <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", remarkClass(b.remark))}>
                                  {b.remark}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-white/30">—</span>
                              )
                            ) : (
                              b[c.key] || <span className="text-gray-300 dark:text-white/30">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-end gap-2">
              {savingRates && <span className="flex items-center gap-1 text-[12px] text-amber-600"><Loader2 className="size-3 animate-spin" /> Saving…</span>}
              {!ratesEdit ? (
                <button onClick={startRatesEdit}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-[12px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <Pencil className="size-3.5" /> Edit rate card
                </button>
              ) : (
                <>
                  <button onClick={addRatesRow} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-[12px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"><Plus className="size-3.5" /> Row</button>
                  <button onClick={addRatesCol} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-[12px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"><Plus className="size-3.5" /> Column</button>
                  <button onClick={cancelRatesEdit} className="h-8 px-3 rounded-lg text-[12px] text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
                  <button onClick={saveRates} disabled={savingRates}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                    {savingRates ? <Loader2 className="size-3.5 animate-spin" /> : null} Save
                  </button>
                </>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-[12px] border-collapse">
                  <tbody>
                    {(ratesEdit ? gridDraft : grid).length === 0 ? (
                      <tr><td className="px-4 py-8 text-center text-gray-400 dark:text-white/40">No rate card data.</td></tr>
                    ) : (ratesEdit ? gridDraft : grid).map((row, ri) => (
                      <tr key={ri} className={cn(!ratesEdit && ri === 0 && "bg-amber-50/50 dark:bg-amber-500/10 font-semibold")}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-gray-100 dark:border-white/[0.06] text-gray-700 dark:text-white/70 whitespace-nowrap p-0">
                            {ratesEdit ? (
                              <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)}
                                className="w-full min-w-[90px] bg-transparent px-2 py-1.5 text-[12px] text-gray-800 dark:text-white/90 focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-500/10" />
                            ) : (
                              <span className="block px-3 py-1.5">{cell}</span>
                            )}
                          </td>
                        ))}
                        {ratesEdit && (
                          <td className="border border-gray-100 dark:border-white/[0.06] px-1 text-center">
                            <button onClick={() => deleteRatesRow(ri)} title="Delete row" className="size-6 inline-flex items-center justify-center rounded text-gray-400 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="size-3.5" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 text-[11px] text-gray-400 dark:text-white/40">
                June buy-rate card (Sheet10). {ratesEdit ? "Editing — add rows/columns, then Save." : "Click Edit rate card to update for a new month."}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
