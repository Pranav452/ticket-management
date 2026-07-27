"use client";

/**
 * Global month filter for the Bajaj app.
 *
 * Every work order belongs to a workbook month (data.sheet_month = "YYYY-MM");
 * boards, analytics, export, bookings, and home all filter by the selected
 * month. "all" shows every month combined (cards then carry a month badge).
 *
 * The month list comes from GET /api/bajaj/months (any approved user). The
 * default selection is the current calendar month when it exists among the
 * sources, otherwise the latest ACTIVE month, otherwise the latest month.
 */

import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export interface MonthOption {
  month: string; // "YYYY-MM"
  label: string; // "July 2026"
  status: "active" | "archived";
}

interface MonthState {
  /** "YYYY-MM" or "all". */
  selectedMonth: string;
  /** True once the default month has been resolved from the source list. */
  initialized: boolean;
  setMonth: (month: string) => void;
  /** Resolve the default selection from the fetched month list (runs once). */
  initFromList: (months: MonthOption[]) => void;
}

export const useMonthStore = create<MonthState>((set, get) => ({
  selectedMonth: "all",
  initialized: false,
  setMonth: (month) => set({ selectedMonth: month, initialized: true }),
  initFromList: (months) => {
    if (get().initialized) return;
    if (months.length === 0) {
      set({ initialized: true }); // nothing configured — stay on "all"
      return;
    }
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const exact = months.find((m) => m.month === current);
    const latestActive = [...months]
      .filter((m) => m.status === "active")
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    const latest = [...months].sort((a, b) => b.month.localeCompare(a.month))[0];
    const pick = exact ?? latestActive ?? latest;
    set({ selectedMonth: pick.month, initialized: true });
  },
}));

/** Month list (newest first) + one-time default-selection initialization. */
export function useMonthList() {
  const query = useQuery<MonthOption[]>({
    queryKey: ["bajaj", "months"],
    queryFn: async () => {
      const res = await fetch("/api/bajaj/months");
      if (!res.ok) throw new Error("Failed to load months");
      const json = (await res.json()) as { months?: MonthOption[] };
      return Array.isArray(json.months) ? json.months : [];
    },
    staleTime: 5 * 60_000,
  });

  const initFromList = useMonthStore((s) => s.initFromList);
  useEffect(() => {
    if (query.data) initFromList(query.data);
  }, [query.data, initFromList]);

  return query;
}

/** The active month filter value for queries — undefined means "no filter". */
export function useSelectedMonthParam(): string | undefined {
  const selected = useMonthStore((s) => s.selectedMonth);
  return selected === "all" || !selected ? undefined : selected;
}
