"use client";

/**
 * Bajaj work-order export page. Layout mirrors the Sales app's export page
 * (filter panel → column pills → preview table → row select → download),
 * themed to the Bajaj amber palette. Excel via exceljs (dynamic import), CSV inline.
 */

import React, { useMemo, useState, useCallback } from "react";
import { Download, Filter, X, Eye, EyeOff, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row { id: string; module_slug: string; status: string | null; data: Record<string, unknown>; }

const MODULES = [
  { slug: "all",        name: "All boards" },
  { slug: "vipar",      name: "VIPAR" },
  { slug: "srilanka",   name: "Sri Lanka" },
  { slug: "nigeria",    name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph",    name: "Triumph" },
];

/* Ordered canonical columns + labels. `module`/`status` are synthetic. */
const COLUMNS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: "module",            label: "Board",          defaultOn: true },
  { key: "status",            label: "Stage",          defaultOn: true },
  { key: "wo",                label: "WO",             defaultOn: true },
  { key: "country",           label: "Country",        defaultOn: true },
  { key: "port",              label: "Port",           defaultOn: true },
  { key: "veh",               label: "Vehicle",        defaultOn: true },
  { key: "category",          label: "Category",       defaultOn: true },
  { key: "qty",               label: "Qty",            defaultOn: true },
  { key: "cont",              label: "Cont",           defaultOn: true },
  { key: "cont_type",         label: "Cont Type",      defaultOn: true },
  { key: "veh_category",      label: "Assembly",       defaultOn: false },
  { key: "haz",               label: "HAZ",            defaultOn: true },
  { key: "consignee",         label: "Consignee",      defaultOn: false },
  { key: "s_line",            label: "Shipping Line",  defaultOn: true },
  { key: "agent",             label: "Agent/CHA",      defaultOn: true },
  { key: "transporter",       label: "Transporter",    defaultOn: false },
  { key: "vslname",           label: "Vessel",         defaultOn: true },
  { key: "booking_no",        label: "Booking No",     defaultOn: true },
  { key: "container_no",      label: "Container No",   defaultOn: true },
  { key: "plant",             label: "Plant",          defaultOn: false },
  { key: "po_no",             label: "PO No",          defaultOn: false },
  { key: "lc_no",             label: "LC No",          defaultOn: false },
  { key: "lc_date",           label: "LC Date",        defaultOn: false },
  { key: "pol_gate",          label: "POL Gate",       defaultOn: false },
  { key: "stuffing_dt",       label: "Stuffing Date",  defaultOn: false },
  { key: "gate_open",         label: "Gate Open",      defaultOn: false },
  { key: "gate_cut_off",      label: "Gate Cut Off",   defaultOn: false },
  { key: "si_cutoff",         label: "SI Cutoff",      defaultOn: false },
  { key: "si_submitted",      label: "SI Submitted",   defaultOn: false },
  { key: "vgm_submitted",     label: "VGM Submitted",  defaultOn: false },
  { key: "do_given_dt",       label: "D/O Given",      defaultOn: false },
  { key: "do_etd",            label: "DO ETD",         defaultOn: false },
  { key: "current_etd",       label: "Current ETD",    defaultOn: true },
  { key: "eta_at_destination",label: "ETA Dest",       defaultOn: false },
  { key: "final_vsl_sob",     label: "Final VSL SOB",  defaultOn: false },
  { key: "sbno",              label: "SB No",          defaultOn: true },
  { key: "sb_date",           label: "SB Date",        defaultOn: false },
  { key: "blno",              label: "BL No",          defaultOn: true },
  { key: "bldt",              label: "BL Date",        defaultOn: false },
  { key: "bl_handover_time",  label: "BL Handover",    defaultOn: false },
  { key: "ff_job",            label: "FF Job",         defaultOn: false },
  { key: "sline_payment",     label: "S/Line Payment", defaultOn: false },
  { key: "clearance_point",   label: "Clearance Pt",   defaultOn: false },
  { key: "open_order",        label: "Open Order",     defaultOn: false },
  { key: "buffer_yard",       label: "Buffer Yard",    defaultOn: false },
  { key: "e_doc_status",      label: "E-Doc Status",   defaultOn: false },
  { key: "courier_dt",        label: "Courier Date",   defaultOn: false },
  { key: "pickup_dt",         label: "Pickup Date",    defaultOn: false },
  { key: "cntr_dispatch",     label: "Cntr Dispatch",  defaultOn: false },
  { key: "cntr_report",       label: "Cntr Report",    defaultOn: false },
  { key: "cntr_gated",        label: "Cntr Gated",     defaultOn: false },
  { key: "for_hbl",           label: "For HBL",        defaultOn: false },
  { key: "remark",            label: "Remark",         defaultOn: false },
  { key: "source_sheet",      label: "Source",         defaultOn: false },
];

function cellValue(col: string, row: Row): string {
  if (col === "module") return row.module_slug ?? "";
  if (col === "status") return row.status ?? "";
  const v = row.data?.[col];
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function distinct(rows: Row[], picker: (r: Row) => string): string[] {
  const s = new Set<string>();
  for (const r of rows) { const v = picker(r).trim(); if (v) s.add(v); }
  return Array.from(s).sort();
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none transition-colors"
      >
        <option value="">All {label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function BajajExportClient() {
  const [moduleSlug, setModuleSlug] = useState("all");
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // filters
  const [country, setCountry] = useState("");
  const [agent, setAgent]     = useState("");
  const [vessel, setVessel]   = useState("");
  const [status, setStatus]   = useState("");
  const [haz, setHaz]         = useState("");
  const [search, setSearch]   = useState("");

  // columns + selection
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeColumns = COLUMNS.filter((c) => visibleCols.has(c.key));

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setFetched(false);
    try {
      const res = await fetch(`/api/bajaj/export?module=${moduleSlug}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to fetch");
      const json = await res.json();
      const data: Row[] = json.rows ?? [];
      setRows(data);
      setSelectedIds(new Set(data.map((r) => r.id)));
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [moduleSlug]);

  const opts = useMemo(() => ({
    countries: distinct(rows, (r) => String(r.data.country ?? "")),
    agents:    distinct(rows, (r) => String(r.data.agent ?? "")),
    vessels:   distinct(rows, (r) => String(r.data.vslname ?? "")),
    statuses:  distinct(rows, (r) => r.status ?? ""),
  }), [rows]);

  const filteredRows = useMemo(() => rows.filter((r) => {
    if (country && String(r.data.country ?? "") !== country) return false;
    if (agent && String(r.data.agent ?? "") !== agent) return false;
    if (vessel && String(r.data.vslname ?? "") !== vessel) return false;
    if (status && (r.status ?? "") !== status) return false;
    if (haz) {
      const h = String(r.data.haz ?? "").toUpperCase();
      const yes = h === "YES" || h === "TRUE" || h === "1";
      if (haz === "yes" && !yes) return false;
      if (haz === "no" && yes) return false;
    }
    if (search.trim() && !JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, country, agent, vessel, status, haz, search]);

  const exportRows = filteredRows.filter((r) => selectedIds.has(r.id));
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  const someSelected = filteredRows.some((r) => selectedIds.has(r.id));
  const hasFilters = !!(country || agent || vessel || status || haz || search);

  function toggleRow(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds((prev) => {
      if (filteredRows.every((r) => prev.has(r.id))) { const n = new Set(prev); filteredRows.forEach((r) => n.delete(r.id)); return n; }
      const n = new Set(prev); filteredRows.forEach((r) => n.add(r.id)); return n;
    });
  }
  function toggleCol(key: string) {
    setVisibleCols((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function clearFilters() { setCountry(""); setAgent(""); setVessel(""); setStatus(""); setHaz(""); setSearch(""); }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function dateStr() { return new Date().toISOString().slice(0, 10); }

  async function exportExcel() {
    if (exportRows.length === 0) return;
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Work Orders");
      ws.columns = activeColumns.map((c) => ({
        header: c.label, key: c.key,
        width: Math.min(40, Math.max(c.label.length + 2, ...exportRows.map((r) => cellValue(c.key, r).length + 2))),
      }));
      ws.getRow(1).font = { bold: true };
      exportRows.forEach((r) => ws.addRow(Object.fromEntries(activeColumns.map((c) => [c.key, cellValue(c.key, r)]))));
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Bajaj_${moduleSlug}_${dateStr()}.xlsx`);
    } finally { setBusy(false); }
  }

  function exportCsv() {
    if (exportRows.length === 0) return;
    const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const lines = [activeColumns.map((c) => esc(c.label)).join(",")];
    for (const r of exportRows) lines.push(activeColumns.map((c) => esc(cellValue(c.key, r))).join(","));
    download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `Bajaj_${moduleSlug}_${dateStr()}.csv`);
  }

  const card = "rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]";

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--main-bg)" }}>
      <div className="p-5 max-w-screen-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white/90">Export Work Orders</h1>
            <p className="text-[13px] text-gray-500 dark:text-white/50 mt-0.5">Filter, preview, and download board data as Excel or CSV.</p>
          </div>
          {fetched && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-[12px] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showPreview ? "Hide" : "Preview"}
              </button>
              <button onClick={exportCsv} disabled={exportRows.length === 0 || busy} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-[12px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">
                <FileText className="size-3.5" /> CSV
              </button>
              <button onClick={exportExcel} disabled={exportRows.length === 0 || busy} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />} Export {exportRows.length > 0 ? `(${exportRows.length})` : ""}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className={cn(card, "p-4 space-y-4")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Filter className="size-4 text-gray-400" /><span className="text-[13px] font-medium text-gray-700 dark:text-white/80">Filters</span></div>
            {hasFilters && <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-amber-600 transition-colors"><X className="size-3" /> Clear all</button>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">Board</label>
              <select value={moduleSlug} onChange={(e) => setModuleSlug(e.target.value)} className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none">
                {MODULES.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              </select>
            </div>
            <FilterSelect label="Country" value={country} options={opts.countries} onChange={setCountry} />
            <FilterSelect label="Agent" value={agent} options={opts.agents} onChange={setAgent} />
            <FilterSelect label="Vessel" value={vessel} options={opts.vessels} onChange={setVessel} />
            <FilterSelect label="Stage" value={status} options={opts.statuses} onChange={setStatus} />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500 dark:text-white/50">HAZ</label>
              <select value={haz} onChange={(e) => setHaz(e.target.value)} className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none">
                <option value="">All</option><option value="yes">HAZ only</option><option value="no">Non-HAZ</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
              {loading ? <><RefreshCw className="size-3.5 animate-spin" /> Loading…</> : <><Filter className="size-3.5" /> Apply &amp; Fetch</>}
            </button>
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] text-red-600">{error}</div>}
        </div>

        {/* Columns */}
        {fetched && (
          <div className={cn(card, "p-4 space-y-3")}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-700 dark:text-white/80">Columns to export</span>
              <div className="flex gap-2 text-[11px]">
                <button onClick={() => setVisibleCols(new Set(COLUMNS.map((c) => c.key)))} className="text-amber-600 hover:underline">All</button>
                <span className="text-gray-300">/</span>
                <button onClick={() => setVisibleCols(new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)))} className="text-amber-600 hover:underline">Default</button>
                <span className="text-gray-300">/</span>
                <button onClick={() => setVisibleCols(new Set())} className="text-gray-400 hover:underline">None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((col) => {
                const on = visibleCols.has(col.key);
                return (
                  <button key={col.key} onClick={() => toggleCol(col.key)} className={cn("h-7 px-2.5 rounded-full text-[11px] border transition-colors",
                    on ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-[#1a1a1a] text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10 hover:border-amber-300 hover:text-gray-700")}>
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results bar */}
        {fetched && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-gray-500 dark:text-white/50">
              <span className="font-medium text-gray-800 dark:text-white/90">{rows.length}</span> records
              {filteredRows.length !== rows.length && <> · <span className="font-medium text-gray-800 dark:text-white/90">{filteredRows.length}</span> shown</>}
              {someSelected && <> · <span className="font-medium text-amber-600">{exportRows.length}</span> selected</>}
            </span>
            <input type="search" placeholder="Search results…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none" />
          </div>
        )}

        {/* Preview table */}
        {fetched && showPreview && (
          <div className={cn(card, "overflow-hidden")}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/10">
              <span className="text-[13px] font-medium text-gray-700 dark:text-white/80">Preview <span className="ml-1.5 text-[11px] text-gray-400 font-normal">showing {Math.min(filteredRows.length, 200)} of {filteredRows.length}</span></span>
            </div>
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#161616]">
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="px-3 py-2.5 text-left w-8"><input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={toggleAll} className="size-3.5 accent-amber-500" /></th>
                    {activeColumns.map((c) => <th key={c.key} className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={activeColumns.length + 1} className="px-4 py-8 text-center text-gray-400">No records match the current filters.</td></tr>
                  ) : filteredRows.slice(0, 200).map((r) => {
                    const sel = selectedIds.has(r.id);
                    return (
                      <tr key={r.id} className={cn("border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors", sel && "bg-amber-50/40 dark:bg-amber-500/[0.06]")}>
                        <td className="px-3 py-2"><input type="checkbox" checked={sel} onChange={() => toggleRow(r.id)} className="size-3.5 accent-amber-500" /></td>
                        {activeColumns.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2 text-gray-700 dark:text-white/70", c.key === "wo" && "font-mono font-medium", c.key === "remark" ? "max-w-[200px] whitespace-normal break-words" : "whitespace-nowrap")}>
                            {cellValue(c.key, r) || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRows.length > 200 && <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 text-[11px] text-gray-400">Preview limited to 200 rows — all {exportRows.length} selected rows are included in the export.</div>}
          </div>
        )}

        {/* Empty state */}
        {!fetched && !loading && (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/15 p-12 flex flex-col items-center justify-center gap-3 text-center">
            <Download className="size-8 text-gray-300" />
            <p className="text-[13px] text-gray-500 dark:text-white/50">Pick a board and filters, then click <strong>Apply &amp; Fetch</strong> to load work orders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
