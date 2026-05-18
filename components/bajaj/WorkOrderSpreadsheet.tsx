"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink } from "lucide-react";
import type { BajajWorkOrder, BajajStatus } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

const COLUMNS_DEF = [
  { key: "wo",           label: "WO No",        defaultWidth: 140, sticky: true, readOnly: true },
  { key: "_status",      label: "Status",        defaultWidth: 140, readOnly: true },
  { key: "veh",          label: "Brand",         defaultWidth: 110 },
  { key: "type",         label: "Variant",       defaultWidth: 140 },
  { key: "qty",          label: "Qty",           defaultWidth: 70,  type: "number" },
  { key: "cont",         label: "40 HC",         defaultWidth: 70,  type: "number" },
  { key: "std20",        label: "20 STD",        defaultWidth: 70,  type: "number" },
  { key: "port",         label: "Port",          defaultWidth: 130 },
  { key: "country",      label: "Country",       defaultWidth: 100 },
  { key: "s_line",       label: "S/Line",        defaultWidth: 130 },
  { key: "vessel_name",  label: "Vessel",        defaultWidth: 160 },
  { key: "booking_no",   label: "Booking No",    defaultWidth: 130 },
  { key: "container_no", label: "Container No",  defaultWidth: 140 },
  { key: "blno",         label: "BL No",         defaultWidth: 130 },
  { key: "bldt",         label: "BL Date",       defaultWidth: 110, type: "date" },
  { key: "agent",        label: "Agent",         defaultWidth: 130 },
  { key: "current_etd",  label: "ETD",           defaultWidth: 110, type: "date" },
  { key: "sailingdt",    label: "Sailing",       defaultWidth: 110, type: "date" },
  { key: "eta_at_destination", label: "ETA",     defaultWidth: 110, type: "date" },
  { key: "si_submitted", label: "SI",            defaultWidth: 52,  type: "boolean" },
  { key: "vgm_submitted",label: "VGM",           defaultWidth: 52,  type: "boolean" },
  { key: "haz",          label: "HAZ",           defaultWidth: 52,  type: "boolean" },
  { key: "remark",       label: "Remark",        defaultWidth: 220 },
] as const;

type ColKey = typeof COLUMNS_DEF[number]["key"];

interface ColDef {
  key: string;
  label: string;
  defaultWidth: number;
  type?: "text" | "number" | "boolean" | "date";
  readOnly?: boolean;
  sticky?: boolean;
}

const COLUMNS: ColDef[] = COLUMNS_DEF as unknown as ColDef[];

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

function EditCell({
  col, value, isFocused, onFocus, onChange, onNavigate,
}: {
  col: ColDef;
  value: unknown;
  isFocused: boolean;
  onFocus: () => void;
  onChange?: (val: string | boolean | number) => void;
  onNavigate?: (dir: "up" | "down" | "tab") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (col.type === "boolean") {
    const on = value === true || value === 1 || value === "true";
    return (
      <button
        onClick={() => { onFocus(); onChange?.(!on); }}
        className="w-full h-full flex items-center justify-center text-[12px] font-semibold transition-colors"
      >
        <span className={on ? "text-amber-500" : "text-gray-300 dark:text-white/20"}>{on ? "✓" : "—"}</span>
      </button>
    );
  }

  if (col.readOnly) {
    return (
      <div className="w-full h-full flex items-center px-2.5 text-[12px] text-gray-600 dark:text-white/60 truncate">
        {value != null && value !== "" ? String(value) : <span className="text-gray-300 dark:text-white/20">—</span>}
      </div>
    );
  }

  const display = value != null && value !== "" ? String(value) : "";

  function commit(newDraft: string) {
    setEditing(false);
    const original = String(value ?? "");
    if (newDraft !== original) {
      if (col.type === "number") onChange?.(newDraft === "" ? "" : Number(newDraft));
      else onChange?.(newDraft);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        className="w-full h-full px-2.5 text-[12px] text-gray-800 dark:text-white/90 bg-[#fffbf0] dark:bg-[#1a1a1a] border-0 outline-none ring-2 ring-inset ring-amber-400 dark:border-white/10"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setEditing(false); setDraft(display); }
          if (e.key === "Enter")  { (e.target as HTMLInputElement).blur(); onNavigate?.("down"); }
          if (e.key === "Tab")    { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate?.(e.shiftKey ? "up" : "tab"); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate?.("up"); }
          if (e.key === "ArrowDown") { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate?.("down"); }
        }}
      />
    );
  }

  return (
    <div
      className="w-full h-full flex items-center px-2.5 text-[12px] text-gray-700 dark:text-white/80 truncate cursor-text select-none"
      onClick={() => { onFocus(); setDraft(display); setEditing(true); }}
    >
      {display || <span className="text-gray-300 dark:text-white/20">—</span>}
    </div>
  );
}

interface WorkOrderSpreadsheetProps {
  workOrders: BajajWorkOrder[];
  statuses: BajajStatus[];
  isLoading: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}

const ROW_NUM_WIDTH = 40;

export function WorkOrderSpreadsheet({ workOrders, statuses, isLoading, onUpdate }: WorkOrderSpreadsheetProps) {
  const [sortKey,  setSortKey]  = useState<string>("wo");
  const [sortDir,  setSortDir]  = useState<SortDir>("asc");
  const [focusCell,setFocusCell]= useState<[number, number] | null>(null);
  const [hovRow,   setHovRow]   = useState<number | null>(null);
  const [widths,   setWidths]   = useState<number[]>(() => COLUMNS.map((c) => c.defaultWidth));

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

  const handleCellChange = useCallback((woId: string, key: string, val: unknown) => {
    if (key === "_status") return;
    onUpdate(woId, { [key]: val });
  }, [onUpdate]);

  function handleNavigate(rowIdx: number, colIdx: number, dir: "up" | "down" | "tab") {
    let nr = rowIdx;
    if (dir === "down" || dir === "tab") nr = Math.min(sorted.length - 1, rowIdx + 1);
    else if (dir === "up") nr = Math.max(0, rowIdx - 1);
    setFocusCell([nr, colIdx]);
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
  const headerBorder = "border-gray-200 dark:border-white/[0.06]";

  return (
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

            const rowClass = cn(
              "h-8 border-b border-gray-100 dark:border-white/[0.04] transition-colors",
              isHov
                ? "bg-amber-50 dark:bg-amber-900/20"
                : isParts
                  ? isEven ? "bg-blue-50 dark:bg-blue-950/30" : "bg-blue-100/60 dark:bg-blue-900/20"
                  : isEven ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "bg-emerald-100/50 dark:bg-emerald-900/10",
            );

            const stickyBgClass = isHov
              ? "bg-amber-50 dark:bg-amber-900/20"
              : isParts
                ? isEven ? "bg-blue-50 dark:bg-blue-950/30" : "bg-blue-100/60 dark:bg-blue-900/20"
                : isEven ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "bg-emerald-100/50 dark:bg-emerald-900/10";

            return (
              <tr
                key={wo.id}
                className={rowClass}
                onMouseEnter={() => setHovRow(rowIdx)}
                onMouseLeave={() => setHovRow(null)}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-gray-100 dark:border-white/[0.04] text-center text-gray-300 dark:text-white/20 select-none transition-colors",
                    stickyBgClass,
                  )}
                  style={{ fontSize: 10, userSelect: "none", fontVariantNumeric: "tabular-nums" }}
                >
                  {rowIdx + 1}
                </td>

                {COLUMNS.map((col, colIdx) => {
                  const rawVal   = col.key === "_status" ? (status?.name ?? null) : d[col.key];
                  const isFocused= focusCell?.[0] === rowIdx && focusCell?.[1] === colIdx;

                  return (
                    <td
                      key={col.key}
                      onClick={() => setFocusCell([rowIdx, colIdx])}
                      className={cn(
                        "border-r border-gray-100 dark:border-white/[0.04] overflow-hidden transition-colors",
                        col.sticky ? cn("sticky z-10", stickyBgClass) : "",
                      )}
                      style={{
                        left: col.sticky ? stickyWoLeft : undefined,
                        padding: 0,
                        maxWidth: widths[colIdx],
                        outline: isFocused ? "2px solid #f59e0b" : undefined,
                        outlineOffset: isFocused ? "-2px" : undefined,
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
                        <EditCell
                          col={col}
                          value={rawVal}
                          isFocused={isFocused}
                          onFocus={() => setFocusCell([rowIdx, colIdx])}
                          onChange={(val) => handleCellChange(wo.id, col.key, val)}
                          onNavigate={(dir) => handleNavigate(rowIdx, colIdx, dir)}
                        />
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
  );
}
