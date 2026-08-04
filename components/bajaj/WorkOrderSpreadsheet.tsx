"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink } from "lucide-react";
import type { BajajWorkOrder, BajajStatus } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

/* Column keys are the CANONICAL data keys the Google Sheet sync writes
 * (lib/bajaj/import-map.mjs HEADER_MAP). The grid is a pure read-only view —
 * the sheet is the single source of truth, so all data entry happens there. */
const COLUMNS_DEF = [
  { key: "wo",            label: "WO No",         defaultWidth: 140, sticky: true },
  { key: "_status",       label: "Status",        defaultWidth: 140 },
  { key: "veh",           label: "Brand",         defaultWidth: 110 },
  { key: "veh_category",  label: "Variant",       defaultWidth: 140 },
  { key: "qty",           label: "Qty",           defaultWidth: 70,  type: "number" },
  { key: "cont",          label: "Cont",          defaultWidth: 70,  type: "number" },
  { key: "hc40",          label: "40 HC",         defaultWidth: 70,  type: "number" },
  { key: "std20",         label: "20 STD",        defaultWidth: 70,  type: "number" },
  { key: "cont_type",     label: "Cont Type",     defaultWidth: 90 },
  { key: "port",          label: "Port",          defaultWidth: 130 },
  { key: "country",       label: "Country",       defaultWidth: 100 },
  { key: "s_line",        label: "S/Line",        defaultWidth: 130 },
  { key: "vslname",       label: "Vessel",        defaultWidth: 160 },
  { key: "booking_no",    label: "Booking No",    defaultWidth: 130 },
  { key: "container_no",  label: "Container No",  defaultWidth: 140 },
  { key: "blno",          label: "BL No",         defaultWidth: 130 },
  { key: "bldt",          label: "BL Date",       defaultWidth: 110, type: "date" },
  { key: "agent",         label: "Agent",         defaultWidth: 130 },
  { key: "current_etd",   label: "ETD",           defaultWidth: 110, type: "date" },
  { key: "sailingdt",     label: "Sailing",       defaultWidth: 110, type: "date" },
  { key: "eta_at_destination", label: "ETA",      defaultWidth: 110, type: "date" },
  { key: "si_submitted",  label: "SI",            defaultWidth: 52,  type: "boolean" },
  { key: "vgm_submitted", label: "VGM",           defaultWidth: 52,  type: "boolean" },
  { key: "haz",           label: "HAZ",           defaultWidth: 52,  type: "boolean" },
  // Extended columns — full parity with the dispatch sheet.
  { key: "transporter",   label: "Transporter",   defaultWidth: 130 },
  { key: "consignee",     label: "Consignee",     defaultWidth: 120 },
  { key: "plant",         label: "Plant",         defaultWidth: 80 },
  { key: "po_no",         label: "PO No",         defaultWidth: 120 },
  { key: "lc_no",         label: "LC No",         defaultWidth: 130 },
  { key: "lc_date",       label: "LC Date",       defaultWidth: 110, type: "date" },
  { key: "ff_job",        label: "FF Job",        defaultWidth: 120 },
  { key: "sbno",          label: "SB No",         defaultWidth: 120 },
  { key: "sb_date",       label: "SB Date",       defaultWidth: 110, type: "date" },
  { key: "stuffing_dt",   label: "Stuffing",      defaultWidth: 110, type: "date" },
  { key: "do_given_dt",   label: "DO Given",      defaultWidth: 110, type: "date" },
  { key: "pol_gate",      label: "POL Gate",      defaultWidth: 110 },
  { key: "gate_open",     label: "Gate Open",     defaultWidth: 110, type: "date" },
  { key: "gate_cut_off",  label: "Gate Cut-off",  defaultWidth: 110, type: "date" },
  { key: "si_cutoff",     label: "SI Cut-off",    defaultWidth: 110, type: "date" },
  { key: "do_etd",        label: "DO ETD",        defaultWidth: 110, type: "date" },
  { key: "final_vsl_sob", label: "Final VSL SOB", defaultWidth: 120, type: "date" },
  { key: "pickup_dt",     label: "Pick Up",       defaultWidth: 110, type: "date" },
  { key: "cntr_dispatch", label: "Cntr Dispatch", defaultWidth: 120, type: "date" },
  { key: "cntr_report",   label: "Cntr Report",   defaultWidth: 120, type: "date" },
  { key: "cntr_gated",    label: "Cntr Gated",    defaultWidth: 120, type: "date" },
  { key: "sline_payment", label: "S/Line Pay",    defaultWidth: 150 },
  { key: "e_doc_status",  label: "E-Doc",         defaultWidth: 120 },
  { key: "clearance_point", label: "Clearance",   defaultWidth: 120 },
  { key: "remark",        label: "Remark",        defaultWidth: 220 },
] as const;

interface ColDef {
  key: string;
  label: string;
  defaultWidth: number;
  type?: "text" | "number" | "boolean" | "date";
  sticky?: boolean;
}

const COLUMNS: ColDef[] = COLUMNS_DEF as unknown as ColDef[];

/** Sheet-synced flags are strings ("YES"/"NO", or a date for SI/VGM) — any
 * non-empty value counts as checked except explicit negatives. */
function isCheckedValue(v: unknown): boolean {
  if (v == null || v === false || v === 0) return false;
  const s = String(v).trim();
  if (s === "") return false;
  const up = s.toUpperCase();
  return up !== "NO" && up !== "FALSE" && up !== "0";
}

type SortDir = "asc" | "desc" | null;

function sortRows(rows: BajajWorkOrder[], key: string, dir: SortDir): BajajWorkOrder[] {
  if (!dir) return rows;
  return [...rows].sort((a, b) => {
    const av = key === "_status"
      ? (a.status_id ?? "")
      : ((a.data ?? {}) as Record<string, unknown>)[key] ?? "";
    const bv = key === "_status"
      ? (b.status_id ?? "")
      : ((b.data ?? {}) as Record<string, unknown>)[key] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return dir === "asc" ? cmp : -cmp;
  });
}

function ResizeHandle({ onResize }: { onResize: (dx: number) => void }) {
  const startX = useRef<number>(0);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;

    function onMove(me: MouseEvent) {
      onResize(me.clientX - startX.current);
      startX.current = me.clientX;
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group/resize z-10"
    >
      <div className="w-px h-4 bg-gray-300 dark:bg-white/20 group-hover/resize:bg-amber-400 group-hover/resize:w-[2px] transition-all rounded-full" />
    </div>
  );
}

/** Read-only cell — the sheet owns all data, so the grid never edits. */
function DisplayCell({ col, value }: { col: ColDef; value: unknown }) {
  if (col.type === "boolean") {
    const on = isCheckedValue(value);
    return (
      <div className="w-full h-full flex items-center justify-center text-[12px] font-semibold">
        <span className={on ? "text-amber-500" : "text-gray-300 dark:text-white/20"}>{on ? "✓" : "—"}</span>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center px-2.5 text-[12px] text-gray-700 dark:text-white/80 truncate">
      {value != null && value !== "" ? String(value) : <span className="text-gray-300 dark:text-white/20">—</span>}
    </div>
  );
}

interface WorkOrderSpreadsheetProps {
  workOrders: BajajWorkOrder[];
  statuses: BajajStatus[];
  isLoading: boolean;
}

const ROW_NUM_WIDTH = 40;

export function WorkOrderSpreadsheet({ workOrders, statuses, isLoading }: WorkOrderSpreadsheetProps) {
  const [sortKey, setSortKey] = useState<string>("wo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hovRow,  setHovRow]  = useState<number | null>(null);
  const [widths,  setWidths]  = useState<number[]>(() => COLUMNS.map((c) => c.defaultWidth));

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
  const sorted    = sortRows(workOrders, sortKey, sortDir);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : d === "desc" ? null : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function resizeCol(colIdx: number, dx: number) {
    setWidths((prev) => {
      const next = [...prev];
      next[colIdx] = Math.max(40, next[colIdx] + dx);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2.5">
        {[0, 150, 300].map((d) => (
          <div key={d} className="size-1.5 rounded-full bg-gray-300 dark:bg-white/20 animate-pulse" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    );
  }

  if (!sorted.length) {
    return <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-white/40">No work orders to display.</div>;
  }

  const stickyWoLeft = ROW_NUM_WIDTH;

  const headerBg    = "bg-gray-100 dark:bg-[#111]";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Read-only notice — the Google Sheet is the single source of truth */}
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#111] flex-shrink-0">
        <span className="text-[11px] text-gray-400 dark:text-white/40">
          Synced from the Google Sheet — edit data there. This grid is read-only.
        </span>
      </div>
      <div className="flex-1 overflow-auto" style={{ fontFamily: "inherit" }}>
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: ROW_NUM_WIDTH + widths.reduce((a, b) => a + b, 0),
        }}
      >
        <colgroup>
          <col style={{ width: ROW_NUM_WIDTH }} />
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>

        <thead>
          <tr className={cn("h-[34px]", headerBg, `border-b border-gray-200 dark:border-white/[0.06]`)}>
            <th
              className={cn("sticky left-0 top-0 z-40", headerBg, "border-r border-gray-200 dark:border-white/[0.06]")}
              style={{ width: ROW_NUM_WIDTH }}
            />

            {COLUMNS.map((col, colIdx) => {
              const isSorted = sortKey === col.key;
              const Icon = isSorted && sortDir === "asc" ? ArrowUp : isSorted && sortDir === "desc" ? ArrowDown : ArrowUpDown;
              return (
                <th
                  key={col.key}
                  className={cn(
                    "relative border-r border-b border-gray-200 dark:border-white/[0.06]",
                    headerBg,
                    col.sticky ? "sticky z-30" : "sticky z-20",
                  )}
                  style={{
                    top: 0,
                    left: col.sticky ? stickyWoLeft : undefined,
                    width: widths[colIdx],
                    padding: "0 10px",
                    textAlign: col.type === "boolean" ? "center" : "left",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  <button
                    className="flex items-center gap-1 w-full group/sort text-gray-500 dark:text-white/50"
                    style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="truncate">{col.label}</span>
                    <Icon style={{
                      width: 11, height: 11, flexShrink: 0,
                      color: isSorted && sortDir ? "#f59e0b" : undefined,
                      opacity: isSorted && sortDir ? 1 : 0.4,
                    }} />
                  </button>
                  <ResizeHandle onResize={(dx) => resizeCol(colIdx, dx)} />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.map((wo, rowIdx) => {
            const d      = (wo.data ?? {}) as Record<string, unknown>;
            const status = statusMap[wo.status_id ?? ""];
            const isHov  = hovRow === rowIdx;
            const isEven = rowIdx % 2 === 0;
            const isParts = String(d.veh ?? "").toUpperCase().includes("PART");

            const bgClass = isHov
              ? "bg-amber-50 dark:bg-amber-900/20"
              : isParts
                ? isEven ? "bg-blue-50 dark:bg-blue-950/30" : "bg-blue-100/60 dark:bg-blue-900/20"
                : isEven ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "bg-emerald-100/50 dark:bg-emerald-900/10";

            const rowClass = cn("h-8 border-b border-gray-100 dark:border-white/[0.04] transition-colors", bgClass);
            const stickyBgClass = bgClass;

            return (
              <tr
                key={wo.id}
                className={rowClass}
                onMouseEnter={() => setHovRow(rowIdx)}
                onMouseLeave={() => setHovRow(null)}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-gray-100 dark:border-white/[0.04] text-center select-none transition-colors",
                    stickyBgClass,
                    "text-gray-300 dark:text-white/20",
                  )}
                  style={{ fontSize: 10, userSelect: "none", fontVariantNumeric: "tabular-nums" }}
                >
                  {rowIdx + 1}
                </td>

                {COLUMNS.map((col, colIdx) => {
                  const rawVal = col.key === "_status" ? (status?.name ?? null) : d[col.key];

                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "border-r border-gray-100 dark:border-white/[0.04] overflow-hidden transition-colors",
                        col.sticky ? cn("sticky z-10", stickyBgClass) : "",
                      )}
                      style={{
                        left: col.sticky ? stickyWoLeft : undefined,
                        padding: 0,
                        maxWidth: widths[colIdx],
                      }}
                    >
                      {col.key === "wo" ? (
                        <Link
                          href={`/bajaj/work-orders/${wo.id}`}
                          className="flex items-center gap-1.5 w-full h-full px-2.5 group/link text-blue-700 dark:text-blue-400 hover:underline"
                          style={{ fontSize: 12, fontWeight: 500, textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate">{d.wo ? String(d.wo) : wo.id}</span>
                          <ExternalLink style={{
                            width: 10, height: 10, flexShrink: 0,
                            opacity: isHov ? 1 : 0, transition: "opacity 150ms",
                          }} className="text-blue-300 dark:text-blue-500" />
                        </Link>
                      ) : col.key === "_status" ? (
                        <div className="flex items-center gap-1.5 px-2.5 h-full truncate">
                          {status
                            ? <>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: `#${status.color_hex}` }} />
                                <span className="text-gray-700 dark:text-white/80 truncate" style={{ fontSize: 12 }}>{status.name}</span>
                              </>
                            : <span className="text-gray-300 dark:text-white/20" style={{ fontSize: 12 }}>—</span>
                          }
                        </div>
                      ) : (
                        <DisplayCell col={col} value={rawVal} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
