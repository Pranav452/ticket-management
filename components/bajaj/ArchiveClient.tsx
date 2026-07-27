"use client";

/**
 * Archived work orders, grouped month → module → country (collapsible).
 * Cards land here via "Archive missing" in the Data Sync panel (rows absent
 * from their month's workbook). All approved users can view; admins can
 * restore a card back to its board — the sheet sync also auto-restores any
 * card whose row reappears in the workbook.
 */

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, Loader2, Search, X } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

interface ArchivedRow {
  id: string;
  module_slug: string;
  status_id: string | null;
  wo: string;
  month: string | null;
  archived_at: string;
  archived_by: string | null;
  data: Record<string, unknown>;
}

const MODULE_META: Record<string, { name: string; flag: string }> = {
  vipar:      { name: "VIPAR",      flag: "🌐" },
  srilanka:   { name: "Sri Lanka",  flag: "🌴" },
  nigeria:    { name: "Nigeria",    flag: "🟢" },
  bangladesh: { name: "Bangladesh", flag: "🔴" },
  triumph:    { name: "Triumph",    flag: "⚡" },
};

function monthTitle(m: string): string {
  const [y, mo] = m.split("-").map((n) => parseInt(n, 10));
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function GroupHeader({
  label, count, open, depth, onToggle, extra,
}: { label: React.ReactNode; count: number; open: boolean; depth: 0 | 1 | 2; onToggle: () => void; extra?: string }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-2 text-left transition-colors",
        depth === 0 && "px-4 py-3",
        depth === 1 && "px-4 py-2 pl-7",
        depth === 2 && "px-4 py-1.5 pl-11",
        "hover:bg-gray-50 dark:hover:bg-white/[0.03]",
      )}
    >
      <ChevronDown className={cn("size-3.5 text-gray-400 dark:text-white/40 transition-transform flex-shrink-0", !open && "-rotate-90")} />
      <span className={cn(
        depth === 0 ? "text-[13px] font-semibold text-gray-900 dark:text-white" :
        depth === 1 ? "text-[12px] font-medium text-gray-700 dark:text-white/80" :
                      "text-[12px] text-gray-500 dark:text-white/60",
      )}>
        {label}
      </span>
      {extra && <span className="text-[11px] text-gray-400 dark:text-white/40">{extra}</span>}
      <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-white/40 rounded-full bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 min-w-[22px] text-center">
        {count}
      </span>
    </button>
  );
}

export function ArchiveClient({ rows }: { rows: ArchivedRow[] }) {
  const router = useRouter();
  const bajajUser = useAuthStore((s) => s.bajajUser);
  const isAdmin = bajajUser?.role === "admin" || bajajUser?.role === "superadmin";

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.wo.toLowerCase().includes(q) ||
      r.module_slug.toLowerCase().includes(q) ||
      (r.month ?? "").includes(q) ||
      JSON.stringify(r.data).toLowerCase().includes(q),
    );
  }, [rows, search]);

  /* month → module → country → rows */
  const grouped = useMemo(() => {
    const byMonth = new Map<string, Map<string, Map<string, ArchivedRow[]>>>();
    for (const r of filtered) {
      const month = r.month ?? "unknown";
      const country = str(r.data["country"]) || "—";
      const modules = byMonth.get(month) ?? new Map<string, Map<string, ArchivedRow[]>>();
      const countries = modules.get(r.module_slug) ?? new Map<string, ArchivedRow[]>();
      countries.set(country, [...(countries.get(country) ?? []), r]);
      modules.set(r.module_slug, countries);
      byMonth.set(month, modules);
    }
    // newest month first
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  async function restore(id: string) {
    if (!window.confirm("Restore this work order to its board?")) return;
    setRestoringId(id);
    setError(null);
    try {
      const res = await fetch("/api/bajaj/archive/restore", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Restore failed (HTTP ${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--main-bg)" }}>
      <div className="p-5 max-w-4xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white/90">
              <Archive className="size-4.5 text-amber-500" /> Archive
            </h1>
            <p className="text-[13px] text-gray-500 dark:text-white/50 mt-0.5">
              Work orders parked off the boards — missing from their month&apos;s workbook.
              They auto-restore if the sheet row reappears{isAdmin ? ", or restore them manually below" : ""}.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 dark:text-white/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search WO, country, vessel…"
              className="h-8 w-60 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] pl-8 pr-8 text-[12px] text-gray-800 dark:text-white/90 focus:border-amber-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <p className="text-[12px] text-gray-400 dark:text-white/40 tabular-nums">
          {filtered.length} archived work order{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== rows.length && <> (of {rows.length})</>}
        </p>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/15 p-12 flex flex-col items-center justify-center gap-3 text-center">
            <Archive className="size-8 text-gray-300 dark:text-white/30" />
            <p className="text-[13px] text-gray-500 dark:text-white/50">
              {rows.length === 0
                ? "Nothing archived — every board card matches its month's workbook."
                : "No archived work orders match your search."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
            {grouped.map(([month, modules]) => {
              const monthKey = `m:${month}`;
              const monthOpen = !collapsed.has(monthKey);
              const monthCount = [...modules.values()].reduce(
                (acc, countries) => acc + [...countries.values()].reduce((a, list) => a + list.length, 0), 0,
              );
              return (
                <div key={month}>
                  <GroupHeader
                    label={month === "unknown" ? "No month recorded" : monthTitle(month)}
                    extra={month === "unknown" ? undefined : month}
                    count={monthCount}
                    open={monthOpen}
                    depth={0}
                    onToggle={() => toggle(monthKey)}
                  />
                  {monthOpen && [...modules.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([slug, countries]) => {
                    const modKey = `${monthKey}|${slug}`;
                    const modOpen = !collapsed.has(modKey);
                    const meta = MODULE_META[slug] ?? { name: slug, flag: "📋" };
                    const modCount = [...countries.values()].reduce((a, list) => a + list.length, 0);
                    return (
                      <div key={modKey}>
                        <GroupHeader
                          label={<>{meta.flag} {meta.name}</>}
                          count={modCount}
                          open={modOpen}
                          depth={1}
                          onToggle={() => toggle(modKey)}
                        />
                        {modOpen && [...countries.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([country, list]) => {
                          const ctryKey = `${modKey}|${country}`;
                          const ctryOpen = !collapsed.has(ctryKey);
                          return (
                            <div key={ctryKey}>
                              <GroupHeader
                                label={country}
                                count={list.length}
                                open={ctryOpen}
                                depth={2}
                                onToggle={() => toggle(ctryKey)}
                              />
                              {ctryOpen && list.map((r) => {
                                const vessel = str(r.data["vslname"]);
                                const port = str(r.data["port"]);
                                return (
                                  <div key={r.id} className="flex items-center gap-3 pl-[60px] pr-4 py-2 border-t border-gray-50 dark:border-white/[0.04] hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                                    <Link
                                      href={`/bajaj/work-orders/${r.id}`}
                                      className="text-[12px] font-mono font-medium text-gray-800 dark:text-white/80 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                    >
                                      {r.wo || r.id.slice(0, 8)}
                                    </Link>
                                    <span className="text-[11px] text-gray-400 dark:text-white/40 truncate flex-1">
                                      {[vessel, port].filter(Boolean).join(" · ") || "—"}
                                    </span>
                                    <span className="hidden sm:block text-[11px] text-gray-400 dark:text-white/40 whitespace-nowrap tabular-nums">
                                      archived {formatWhen(r.archived_at)}
                                      {r.archived_by && <> by {r.archived_by}</>}
                                    </span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => restore(r.id)}
                                        disabled={restoringId !== null}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-white/60 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 dark:hover:border-emerald-500/40 transition-colors disabled:opacity-50 flex-shrink-0"
                                      >
                                        {restoringId === r.id
                                          ? <Loader2 className="size-3 animate-spin" />
                                          : <ArchiveRestore className="size-3" />}
                                        Restore
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
