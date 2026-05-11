"use client";

import React from "react";
import { RefreshCw, Calendar, AlignJustify, User } from "lucide-react";
import type { BajajWorkOrder } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

interface WorkOrderCardProps {
  workOrder: BajajWorkOrder;
  cardFaceFields: string[];
  isLight?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  statusColor: string;
}

export function WorkOrderCard({ workOrder, isSelected, onSelect, onDragStart, statusColor }: WorkOrderCardProps) {
  const d = workOrder.data as Record<string, unknown>;

  const woId    = String(d["wo"]     ?? d["WO"]      ?? workOrder.id.slice(0, 8));
  const brand   = String(d["brand"]  ?? d["Brand"]   ?? "");
  const variant = String(d["variant"]?? d["Variant"] ?? "");
  const title   = [brand, variant].filter(Boolean).join(" · ") || `WO ${woId}`;
  const port    = String(d["port"]   ?? d["Port"]    ?? "");
  const qty     = String(d["qty"]    ?? d["QTY"]     ?? "");
  const saildt  = String(d["sailingdt"] ?? d["SAILINGDT"] ?? d["lsd"] ?? "");
  const haz     = d["haz"] === true || d["haz"] === 1 || d["haz"] === "true";
  const module  = String(d["country"] ?? d["module"]  ?? "");
  const cycles  = String(d["40hc"]   ?? d["40HC"]    ?? "7");

  // Guard: strip leading '#' if already present so we never produce '##RRGGBB'
  const hexColor = `#${statusColor.replace(/^#/, "")}`;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className={cn(
        "mb-2 rounded-lg cursor-pointer select-none transition-all overflow-hidden group bg-white dark:bg-[#1c1c1c]",
        isSelected
          ? "ring-2 ring-amber-400 shadow-md border border-amber-300 dark:border-amber-500/40"
          : "shadow-sm hover:shadow-md border border-gray-100 dark:border-white/[0.07]"
      )}
    >
      <div className="px-3 pt-2.5 pb-2.5">
        {/* Row 1: ticket ID + assignee */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: hexColor }} />
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/30 font-mono">{woId}</span>
          </div>

          {workOrder.assignee ? (
            workOrder.assignee.avatar_url ? (
              <img src={workOrder.assignee.avatar_url} alt="" className="size-5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="size-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {((workOrder.assignee.full_name || workOrder.assignee.email || "?")[0] ?? "?").toUpperCase()}
              </div>
            )
          ) : (
            <div className="size-5 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <User className="size-2.5 text-gray-400" aria-hidden />
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-[13px] font-medium text-gray-800 dark:text-white/90 leading-snug mb-2.5 line-clamp-2">{title}</p>

        {/* Bottom meta row — Linear style */}
        <div className="flex items-center gap-2 flex-wrap">
          {haz && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-500/20">⚠ HAZ</span>
          )}
          {port && (
            <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50">
              {port}
            </span>
          )}
          {qty && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30">
              <RefreshCw className="size-3 text-gray-300 dark:text-white/20" />
              {qty}
            </span>
          )}
          {saildt && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30 ml-auto">
              <Calendar className="size-3 text-gray-300 dark:text-white/20" />
              {saildt}
            </span>
          )}
          {!saildt && (
            <span className="ml-auto">
              <AlignJustify className="size-3 text-gray-200 dark:text-white/10" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
