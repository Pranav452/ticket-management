"use client";

import React from "react";
import { GripVertical } from "lucide-react";
import type { BajajWorkOrder } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

interface WorkOrderCardProps {
  workOrder:      BajajWorkOrder;
  cardFaceFields: string[];
  isLight?:       boolean;
  isSelected:     boolean;
  canDrag:        boolean;
  onSelect:       () => void;
  onDragStart:    (e: React.DragEvent) => void;
  statusColor:    string;
}

/* Format a raw value nicely for display */
function fmt(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v).trim();
}

/* Pill colour per field type — gives each chip a subtle visual identity */
function chipStyle(field: string): string {
  if (field === "haz")         return "bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border-red-100 dark:border-red-500/20 font-semibold";
  if (field === "country")     return "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20";
  if (field === "assy_config") return "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-500/20";
  if (field === "vslname")     return "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-500/20";
  if (["qty","cont","hc40","std20"].includes(field))
                               return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
  return "bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10";
}

/* Human-readable label for a field key */
function fieldLabel(field: string): string {
  const MAP: Record<string, string> = {
    wo: "WO", haz: "⚠ HAZ", qty: "QTY", cont: "CONT", hc40: "40HC", std20: "STD20",
    vslname: "Vessel", containerno: "Cntr", blno: "BL", sbno: "SB",
    sailingdt: "ETD", wodt: "WO Dt", bldt: "BL Dt",
    port: "Port", agent: "CHA", plant: "Plant", country: "Country",
    brand: "Brand", variant: "Variant", assy_config: "Assy",
    booking_no: "Booking", po_no: "PO", remark: "Remark",
    do_etd: "DO/ETD", ff_job: "FF Job",
    s_line: "S.Line", sb_date: "SB Dt", pol_gate: "POL Gate",
    consignee: "Consignee", cont_type: "Cont Type", gate_open: "Gate Open",
    pickup_dt: "Pickup", si_cutoff: "SI Cutoff", cntr_gated: "Cntr Gated",
    cntr_report: "Cntr Rpt", current_etd: "Cur ETD", stuffing_dt: "Stuffing",
    transporter: "Transporter", container_no: "Cntr No", gate_cut_off: "Gate Cut",
    veh_category: "Veh Cat", cntr_dispatch: "Dispatch", sline_payment: "SL Pay",
    veh: "Veh",
  };
  return MAP[field] ?? field;
}

export function WorkOrderCard({
  workOrder, cardFaceFields, isSelected, canDrag,
  onSelect, onDragStart, statusColor,
}: WorkOrderCardProps) {
  const d = workOrder.data as Record<string, unknown>;

  /* Always-visible header fields */
  const woId    = fmt(d["wo"]      ?? d["WO"]      ?? workOrder.id.slice(0, 8));
  const brand   = fmt(d["brand"]   ?? d["Brand"]   ?? "");
  const variant = fmt(d["variant"] ?? d["Variant"] ?? "");
  const title   = [brand, variant].filter(Boolean).join(" · ") || `WO ${woId}`;

  const hexColor = `#${statusColor.replace(/^#/, "")}`;

  /* Build chips from the user-selected fields (skip wo/brand/variant — already in header) */
  const SKIP = new Set(["wo", "WO", "brand", "Brand", "variant", "Variant"]);
  const chips = cardFaceFields
    .filter(f => !SKIP.has(f))
    .map(f => {
      /* Try canonical key + uppercase variant */
      const raw = d[f] ?? d[f.toUpperCase()] ?? d[f.toLowerCase()];
      const value = fmt(raw);
      if (!value || value === "null" || value === "0") return null;
      /* Special: haz boolean shows badge regardless of value */
      if (f === "haz" && (raw === true || raw === 1 || raw === "true" || raw === "1")) {
        return { field: f, label: "⚠ HAZ", value: "" };
      }
      if (f === "haz") return null;
      return { field: f, label: fieldLabel(f), value };
    })
    .filter(Boolean) as { field: string; label: string; value: string }[];

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onClick={onSelect}
      className={cn(
        "mb-2 rounded-lg select-none transition-all overflow-hidden group bg-white dark:bg-[#1c1c1c]",
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isSelected
          ? "ring-2 ring-amber-400 shadow-md border border-amber-300 dark:border-amber-500/40"
          : "shadow-sm hover:shadow-md border border-gray-100 dark:border-white/[0.07]"
      )}
    >
      <div className="px-3 pt-2.5 pb-2.5">
        {/* Header row: WO id + drag handle */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: hexColor }} />
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/30 font-mono">{woId}</span>
          </div>
          {canDrag && (
            <GripVertical className="size-3.5 text-gray-300 dark:text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </div>

        {/* Title: brand · variant */}
        <p className="text-[13px] font-medium text-gray-800 dark:text-white/90 leading-snug mb-2.5 line-clamp-2">
          {title}
        </p>

        {/* Dynamic field chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map(({ field, label, value }) => (
              <span
                key={field}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded border leading-tight whitespace-nowrap",
                  chipStyle(field)
                )}
              >
                {value ? `${label}: ${value}` : label}
              </span>
            ))}
          </div>
        )}

        {/* Fallback row when no chips (default config) */}
        {chips.length === 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {fmt(d["port"]) && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", chipStyle("port"))}>
                {fmt(d["port"])}
              </span>
            )}
            {fmt(d["qty"]) && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", chipStyle("qty"))}>
                QTY: {fmt(d["qty"])}
              </span>
            )}
            {fmt(d["sailingdt"]) && (
              <span className="ml-auto text-[10px] text-gray-400 dark:text-white/30">
                {fmt(d["sailingdt"])}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
