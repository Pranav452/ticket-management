"use client";

/**
 * Booking desk (the June file's Sheet8) + rate-card view (Sheet10), stored as
 * JSON in app_config. Bookings are fully editable in-app: add, edit, delete,
 * set the remark (CANCELLED / HOLD / RELEASED …) and link a booking to a work
 * order via the WO Ref field. Saves use an optimistic lock so two desks editing
 * at once don't silently clobber each other. The rate card stays read-only here.
 */

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, DollarSign, Search, RefreshCw, Plus, Pencil, Trash2, X, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "bookings" | "rates";
type Booking = Record<string, string>;

const BOOKING_COLS: { key: string; label: string }[] = [
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

const REMARK_PRESETS = ["", "TAKE BOOKING", "AVAILABLE", "PLANNED", "RELEASED", "HOLD", "CANCELLED"];

function remarkClass(remark: string): string {
  const r = remark.toUpperCase();
  if (r.includes("CANCEL")) return "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30";
  if (r.includes("HOLD"))   return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30";
  if (r.includes("RELEAS")) return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30";
  if (r.includes("PLAN"))   return "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30";
  if (r.includes("AVAIL") || r.includes("TAKE")) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";
  return "bg-gray-50 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10";
}

const inputCls =
  "w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 dark:text-white/90 placeholder:text-gray-300 focus:outline-none focus:border-amber-500 transition-colors";

export function BajajBookingsClient() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ row: Booking; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Rate-card editing
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [ratesEdit, setRatesEdit] = useState(false);
  const [gridDraft, setGridDraft] = useState<string[][]>([]);
  const [savingRates, setSavingRates] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        fetch("/api/bajaj/reference?type=bookings").then((x) => x.json()),
        fetch("/api/bajaj/reference?type=rates").then((x) => x.json()),
      ]);
      setBookings(Array.isArray(b.rows) ? b.rows : []);
      setUpdatedAt(b.updated_at ?? null);
      setGrid(Array.isArray(r.grid) ? r.grid : []);
      setRatesUpdatedAt(r.updated_at ?? null);
    } finally {
      setLoading(false);
    }
  }

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

  useEffect(() => { load(); }, []);

  /** Persist the full bookings array, guarded by the optimistic lock. */
  async function persist(rows: Booking[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/reference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bookings", rows, baseUpdatedAt: updatedAt }),
      });
      if (res.status === 409) {
        setError("This list was changed by someone else. Reloading the latest version…");
        await load();
        return false;
      }
      if (!res.ok) throw new Error("Save failed");
      const payload = await res.json();
      setBookings(Array.isArray(payload.rows) ? payload.rows : rows);
      setUpdatedAt(payload.updated_at ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    setEditing({ row: Object.fromEntries(BOOKING_COLS.map((c) => [c.key, ""])), index: -1 });
  }
  function openEdit(b: Booking) {
    setEditing({ row: { ...b }, index: bookings.indexOf(b) });
  }

  async function saveEditing() {
    if (!editing) return;
    const next = [...bookings];
    if (editing.index < 0) next.push(editing.row);
    else next[editing.index] = editing.row;
    const ok = await persist(next);
    if (ok) setEditing(null);
  }

  async function deleteBooking(b: Booking) {
    const idx = bookings.indexOf(b);
    if (idx < 0) return;
    if (!window.confirm(`Delete booking ${b.bkg_no || "(blank)"}?`)) return;
    const next = bookings.filter((_, i) => i !== idx);
    await persist(next);
  }

  async function quickRemark(b: Booking, remark: string) {
    const idx = bookings.indexOf(b);
    if (idx < 0) return;
    const next = bookings.map((row, i) => (i === idx ? { ...row, remark } : row));
    // persist() sets state from the server on success and reloads on conflict;
    // on a plain failure the UI keeps the last saved value (no stale optimistic row).
    await persist(next);
  }

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
          : "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:border-gray-300")}
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
            <p className="text-[13px] text-gray-500 dark:text-white/50 mt-0.5">Booking desk (editable) and the June buy-rate card.</p>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="size-5 animate-spin" /></div>
        ) : tab === "bookings" ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-gray-500 dark:text-white/50"><span className="font-medium text-gray-800 dark:text-white/90">{filteredBookings.length}</span> bookings</span>
                {saving && <span className="flex items-center gap-1 text-[12px] text-amber-600"><Loader2 className="size-3 animate-spin" /> Saving…</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings…"
                    className="h-8 w-56 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] pl-8 pr-3 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none" />
                </div>
                <button onClick={openAdd} disabled={saving}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                  <Plus className="size-3.5" /> Add booking
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161616]">
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      {BOOKING_COLS.map((c) => <th key={c.key} className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">{c.label}</th>)}
                      <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-white/50">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr><td colSpan={BOOKING_COLS.length + 1} className="px-4 py-8 text-center text-gray-400">No bookings.</td></tr>
                    ) : filteredBookings.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03] group">
                        {BOOKING_COLS.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2 text-gray-700 dark:text-white/70 whitespace-nowrap", c.key === "bkg_no" && "font-mono font-medium")}>
                            {c.key === "remark" ? (
                              <select
                                value={REMARK_PRESETS.includes((b.remark ?? "").toUpperCase()) ? (b.remark ?? "").toUpperCase() : (b.remark ?? "")}
                                onChange={(e) => quickRemark(b, e.target.value)}
                                disabled={saving}
                                className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium focus:outline-none cursor-pointer", remarkClass(b.remark ?? ""))}
                              >
                                {(REMARK_PRESETS.includes((b.remark ?? "").toUpperCase()) ? REMARK_PRESETS : [b.remark ?? "", ...REMARK_PRESETS]).map((p, pi) => (
                                  <option key={pi} value={p}>{p || "—"}</option>
                                ))}
                              </select>
                            ) : (
                              b[c.key] || <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(b)} title="Edit booking"
                              className="size-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => deleteBooking(b)} title="Delete booking"
                              className="size-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
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
                  <button onClick={cancelRatesEdit} className="h-8 px-3 rounded-lg text-[12px] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
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
                      <tr><td className="px-4 py-8 text-center text-gray-400">No rate card data.</td></tr>
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
                            <button onClick={() => deleteRatesRow(ri)} title="Delete row" className="size-6 inline-flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="size-3.5" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 text-[11px] text-gray-400">
                June buy-rate card (Sheet10). {ratesEdit ? "Editing — add rows/columns, then Save." : "Click Edit rate card to update for a new month."}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / edit booking modal */}
      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{editing.index < 0 ? "Add booking" : "Edit booking"}</p>
              <button onClick={() => setEditing(null)} className="size-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {BOOKING_COLS.map((c) => (
                <div key={c.key} className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    {c.label}{c.key === "wo_ref" && " (links to work order)"}
                  </label>
                  {c.key === "remark" ? (
                    <input
                      list="remark-presets"
                      value={editing.row[c.key] ?? ""}
                      onChange={(e) => setEditing({ ...editing, row: { ...editing.row, [c.key]: e.target.value } })}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      value={editing.row[c.key] ?? ""}
                      onChange={(e) => setEditing({ ...editing, row: { ...editing.row, [c.key]: e.target.value } })}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
              <datalist id="remark-presets">
                {REMARK_PRESETS.filter(Boolean).map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/10">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={saveEditing} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-[13px] font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {editing.index < 0 ? "Add booking" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
