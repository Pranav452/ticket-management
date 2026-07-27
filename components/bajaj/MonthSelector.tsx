"use client";

/**
 * Global month dropdown — used in the board toolbar, dashboard, export,
 * bookings, and home pages. Reads/writes the shared month store
 * (lib/stores/month.ts). Archived months carry a small badge.
 */

import React, { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { useMonthList, useMonthStore } from "@/lib/stores/month";
import { cn } from "@/lib/utils";

export function MonthSelector({ className }: { className?: string }) {
  const { data: months = [], isLoading } = useMonthList();
  const selected = useMonthStore((s) => s.selectedMonth);
  const setMonth = useMonthStore((s) => s.setMonth);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = months.find((m) => m.month === selected);
  const buttonLabel = selected === "all" ? "All months" : current?.label ?? selected;

  // Nothing configured yet — hide the control entirely (single-source legacy mode).
  if (!isLoading && months.length === 0) return null;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
          open
            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400"
            : "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20",
        )}
        title="Filter by workbook month"
      >
        <Calendar className="size-3.5" />
        <span className="whitespace-nowrap">{buttonLabel}</span>
        {current?.status === "archived" && (
          <span className="text-[9px] px-1 py-px rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 uppercase tracking-wide">
            archived
          </span>
        )}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161616] shadow-xl overflow-hidden py-1">
          <button
            type="button"
            onClick={() => { setMonth("all"); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
              selected === "all"
                ? "text-amber-700 dark:text-amber-400 font-medium"
                : "text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5",
            )}
          >
            <span className="flex-1">All months</span>
            {selected === "all" && <Check className="size-3.5" />}
          </button>
          <div className="mx-2 my-1 border-t border-gray-100 dark:border-white/[0.06]" />
          {months.map((m) => {
            const active = selected === m.month;
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => { setMonth(m.month); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
                  active
                    ? "text-amber-700 dark:text-amber-400 font-medium"
                    : "text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5",
                )}
              >
                <span className="flex-1 whitespace-nowrap">{m.label}</span>
                {m.status === "archived" && (
                  <span className="text-[9px] px-1 py-px rounded bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40 uppercase tracking-wide">
                    archived
                  </span>
                )}
                {active && <Check className="size-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
