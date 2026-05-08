"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Upload, Eye, Search, X, SlidersHorizontal,
  ChevronDown, RefreshCw,
} from "lucide-react";
import { WorkOrderBoard } from "@/components/bajaj/WorkOrderBoard";
import { WorkOrderDetailPanel } from "@/components/bajaj/WorkOrderDetailPanel";
import {
  useBajajStatuses,
  useBajajBoardConfig,
  useWorkOrders,
  useUpdateWorkOrder,
} from "@/lib/queries/bajaj";
import type { WorkOrderFilters } from "@/lib/types/bajaj";
import { ReminderBell } from "@/components/bajaj/ReminderBell";
import { cn } from "@/lib/utils";

const MODULE_META: Record<string, { name: string; flag: string; port: string }> = {
  vipar:      { name: "VIPAR",      flag: "🌏", port: "Multiple Ports" },
  srilanka:   { name: "Sri Lanka",  flag: "🇱🇰", port: "Colombo / CMNBO" },
  nigeria:    { name: "Nigeria",    flag: "🇳🇬", port: "Apapa Lagos" },
  bangladesh: { name: "Bangladesh", flag: "🇧🇩", port: "Chattogram / BDCGP" },
  triumph:    { name: "Triumph",    flag: "🇬🇧", port: "United Kingdom" },
};

interface WorkOrderBoardClientProps {
  slug: string;
  isAdmin: boolean;
}

export function WorkOrderBoardClient({ slug, isAdmin }: WorkOrderBoardClientProps) {
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [filters,       setFilters]       = useState<WorkOrderFilters>({});
  const [searchInput,   setSearchInput]   = useState("");
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);
  const [customFields,  setCustomFields]  = useState<string[]>([]);

  const { data: statuses = [], isLoading: statusLoading } = useBajajStatuses(slug);
  const { data: boardConfig }                              = useBajajBoardConfig(slug);
  const {
    data:       workOrders = [],
    isLoading:  woLoading,
    refetch,
  } = useWorkOrders(slug, filters);
  const updateWorkOrder = useUpdateWorkOrder();

  const meta = MODULE_META[slug] ?? { name: slug, flag: "🌐", port: "" };

  const cardFaceFields = customFields.length
    ? customFields
    : (boardConfig?.card_face_fields ?? ["WO", "port", "vslname", "BLNO", "containerno"]);

  const availableFields = Array.from(
    new Set(workOrders.flatMap((wo) => Object.keys(wo.data ?? {})))
  );

  // Restore card-fields from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`bajaj-card-fields-${slug}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p) && p.length) setCustomFields(p);
      }
    } catch { /* ignore */ }
  }, [slug]);

  function toggleField(field: string) {
    setCustomFields((prev) => {
      const next = prev.includes(field)
        ? prev.filter((f) => f !== field)
        : prev.length < 5 ? [...prev, field] : prev;
      if (typeof window !== "undefined")
        window.localStorage.setItem(`bajaj-card-fields-${slug}`, JSON.stringify(next));
      return next;
    });
  }

  // Apply text search client-side (server search already hit the DB)
  const filteredOrders = searchInput.trim()
    ? workOrders.filter((wo) =>
        JSON.stringify(wo.data).toLowerCase().includes(searchInput.toLowerCase())
      )
    : workOrders;

  function handleDrop(workOrderId: string, newStatusId: string, newOrder: number) {
    updateWorkOrder.mutate({ id: workOrderId, updates: { status_id: newStatusId, column_order: newOrder } });
  }

  const hasActiveFilter = !!(searchInput || filters.dateFrom || filters.dateTo || filters.statusId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-950">

      {/* ─── Top header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-neutral-800 flex-shrink-0 bg-[#0a0a0a]">

        {/* Module identity */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl leading-none select-none">{meta.flag}</span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-neutral-100 leading-none">
              {meta.name}
            </h1>
            <p className="text-[11px] text-neutral-600 leading-none mt-0.5">{meta.port}</p>
          </div>

          {/* Status chips */}
          <div className="hidden md:flex items-center gap-1.5 ml-3">
            {statuses.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => setFilters((f) => ({
                  ...f,
                  statusId: f.statusId === s.id ? undefined : s.id,
                }))}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all",
                  filters.statusId === s.id
                    ? "text-white border-transparent"
                    : "text-neutral-400 border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:text-neutral-200"
                )}
                style={filters.statusId === s.id ? { backgroundColor: s.color_hex, borderColor: s.color_hex } : {}}
              >
                <span
                  className="size-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: filters.statusId === s.id ? "rgba(255,255,255,0.7)" : s.color_hex }}
                />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ReminderBell />

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] border transition-colors",
              showFilters || hasActiveFilter
                ? "bg-amber-600/15 border-amber-700/40 text-amber-300"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {hasActiveFilter && (
              <span className="size-1.5 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            onClick={() => setShowViewPanel((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] border transition-colors",
              showViewPanel
                ? "bg-neutral-800 border-neutral-700 text-neutral-100"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            )}
          >
            <Eye className="size-3.5" />
            <span className="hidden sm:inline">Fields</span>
          </button>

          <button
            onClick={() => refetch()}
            className="flex items-center justify-center size-[30px] rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", woLoading && "animate-spin")} />
          </button>

          <Link
            href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow shadow-amber-900/30"
          >
            <Upload className="size-3.5" />
            <span>Import</span>
          </Link>
        </div>
      </div>

      {/* ─── Filter / search bar ─────────────────────────────────────────── */}
      {showFilters && (
        <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-neutral-800 bg-neutral-900/60 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              placeholder="WO, BL, vessel, port…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 pl-8 pr-3 py-2 text-[13px] text-neutral-200 placeholder-neutral-600 focus:border-amber-600 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
            <span>From</span>
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[13px] text-neutral-300 focus:border-amber-600 focus:outline-none transition-colors"
            />
            <span>to</span>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[13px] text-neutral-300 focus:border-amber-600 focus:outline-none transition-colors"
            />
          </div>

          {hasActiveFilter && (
            <button
              onClick={() => { setSearchInput(""); setFilters({}); }}
              className="flex items-center gap-1 text-[12px] text-neutral-500 hover:text-amber-400 transition-colors"
            >
              <X className="size-3" /> Clear
            </button>
          )}

          <span className="ml-auto text-[12px] text-neutral-600 tabular-nums">
            {filteredOrders.length} WO{filteredOrders.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ─── Card field picker ───────────────────────────────────────────── */}
      {showViewPanel && (
        <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-900/40 flex-shrink-0">
          <div className="flex items-start gap-4 max-w-2xl">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-neutral-300 uppercase tracking-wider">
                  Card fields <span className="text-neutral-600 normal-case font-normal">(pick up to 5)</span>
                </p>
                <button
                  onClick={() => {
                    setCustomFields([]);
                    if (typeof window !== "undefined")
                      window.localStorage.removeItem(`bajaj-card-fields-${slug}`);
                  }}
                  className="text-[11px] text-neutral-600 hover:text-amber-400 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableFields.length === 0 ? (
                  <span className="text-[12px] text-neutral-600">Load data first to see available fields.</span>
                ) : (
                  availableFields.map((field) => {
                    const selected = cardFaceFields.includes(field);
                    return (
                      <button
                        key={field}
                        onClick={() => toggleField(field)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                          selected
                            ? "bg-amber-600/20 text-amber-300 border-amber-700/50"
                            : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
                        )}
                      >
                        {field}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <button
              onClick={() => setShowViewPanel(false)}
              className="text-neutral-600 hover:text-neutral-300 transition-colors mt-0.5"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Board ───────────────────────────────────────────────────────── */}
      {!statusLoading && statuses.length === 0 && workOrders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center flex-col gap-5 text-neutral-600">
          <Upload className="size-10 text-neutral-800" />
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-400">No work orders yet for {meta.name}</p>
            <p className="text-[13px] text-neutral-600 mt-1">
              Import a dispatch plan or paste rows from the Bajaj email
            </p>
          </div>
          <Link
            href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            <Upload className="size-4" />
            Import Dispatch Plan
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <WorkOrderBoard
            slug={slug}
            statuses={statuses}
            workOrders={filteredOrders}
            cardFaceFields={cardFaceFields}
            isLight={false}
            isLoading={statusLoading || woLoading}
            selectedId={selectedId}
            onSelectCard={setSelectedId}
            onDrop={handleDrop}
          />
          {selectedId && (
            <WorkOrderDetailPanel
              workOrderId={selectedId}
              onClose={() => setSelectedId(null)}
              isAdmin={isAdmin}
              isLight={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
