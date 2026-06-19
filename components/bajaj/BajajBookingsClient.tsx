"use client";

/**
 * Booking list + rate-card reference views (the June file's Sheet8 + Sheet10),
 * stored as JSON in app_config and rendered read-only with client-side search.
 */

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, DollarSign, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "bookings" | "rates";

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

export function BajajBookingsClient() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<Record<string, string>[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [b, r] = await Promise.all([
          fetch("/api/bajaj/reference?type=bookings").then((x) => x.json()),
          fetch("/api/bajaj/reference?type=rates").then((x) => x.json()),
        ]);
        if (!alive) return;
        setBookings(b.rows ?? []);
        setGrid(r.grid ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
            <p className="text-[13px] text-gray-500 dark:text-white/50 mt-0.5">Booking list and the June buy-rate card — reference views from the dispatch sheet.</p>
          </div>
          <div className="flex items-center gap-2">
            {tabBtn("bookings", `Bookings (${bookings.length})`, BookOpen)}
            {tabBtn("rates", "Rate Card", DollarSign)}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="size-5 animate-spin" /></div>
        ) : tab === "bookings" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-gray-500 dark:text-white/50"><span className="font-medium text-gray-800 dark:text-white/90">{filteredBookings.length}</span> bookings</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings…"
                  className="h-8 w-64 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] pl-8 pr-3 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none" />
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
                      <tr><td colSpan={BOOKING_COLS.length} className="px-4 py-8 text-center text-gray-400">No bookings.</td></tr>
                    ) : filteredBookings.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                        {BOOKING_COLS.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2 text-gray-700 dark:text-white/70 whitespace-nowrap", c.key === "bkg_no" && "font-mono font-medium")}>
                            {b[c.key] || <span className="text-gray-300">—</span>}
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
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-[12px] border-collapse">
                <tbody>
                  {grid.length === 0 ? (
                    <tr><td className="px-4 py-8 text-center text-gray-400">No rate card data.</td></tr>
                  ) : grid.map((row, ri) => (
                    <tr key={ri} className={cn(ri === 0 && "bg-amber-50/50 dark:bg-amber-500/10 font-semibold")}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5 border border-gray-100 dark:border-white/[0.06] text-gray-700 dark:text-white/70 whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 text-[11px] text-gray-400">Rate card shown as-is from the dispatch sheet (Sheet10).</div>
          </div>
        )}
      </div>
    </div>
  );
}
