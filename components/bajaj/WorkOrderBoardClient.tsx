"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Eye, Search, X, SlidersHorizontal, RefreshCw, Star, LayoutGrid, Table2 } from "lucide-react";

import { WorkOrderBoard } from "@/components/bajaj/WorkOrderBoard";
import { WorkOrderSpreadsheet } from "@/components/bajaj/WorkOrderSpreadsheet";
import { useBajajStatuses, useBajajBoardConfig, useWorkOrders, useUpdateWorkOrder } from "@/lib/queries/bajaj";
import type { WorkOrderFilters } from "@/lib/types/bajaj";
import { ReminderBell } from "@/components/bajaj/ReminderBell";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "spreadsheet";

const MODULE_META: Record<string, { name: string; flag: string; port: string }> = {
  vipar:      { name: "VIPAR",      flag: "🌐", port: "Multiple Ports" },
  srilanka:   { name: "Sri Lanka",  flag: "🌴", port: "Colombo / CMNBO" },
  nigeria:    { name: "Nigeria",    flag: "🟢", port: "Apapa Lagos" },
  bangladesh: { name: "Bangladesh", flag: "🔴", port: "Chattogram / BDCGP" },
  triumph:    { name: "Triumph",    flag: "⚡", port: "United Kingdom" },
};

interface WorkOrderBoardClientProps { slug: string; isAdmin: boolean; }

export function WorkOrderBoardClient({ slug, isAdmin: _isAdmin }: WorkOrderBoardClientProps) {
  const router = useRouter();
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [filters,       setFilters]       = useState<WorkOrderFilters>({});
  const [searchInput,   setSearchInput]   = useState("");
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);
  const [customFields,  setCustomFields]  = useState<string[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>("board");

  const { data: dbStatuses = [], isLoading: statusLoading } = useBajajStatuses(slug);

  // Fixed 10-stage lifecycle — always shown regardless of DB rows
  const LIFECYCLE: { name: string; color_hex: string }[] = [
    { name: "Planning",            color_hex: "3b82f6" },
    { name: "Booking Request",     color_hex: "06b6d4" },
    { name: "Booking",             color_hex: "8b5cf6" },
    { name: "Container Allocation",color_hex: "f59e0b" },
    { name: "SI Filing",           color_hex: "f97316" },
    { name: "Custom Clearance",    color_hex: "ef4444" },
    { name: "Gate Open",           color_hex: "ec4899" },
    { name: "Billing",             color_hex: "6366f1" },
    { name: "BL Release",          color_hex: "10b981" },
    { name: "Completed",           color_hex: "22c55e" },
  ];

  // Merge: if DB has a matching status (by name substring), use its id; else use placeholder
  const statuses = LIFECYCLE.map((stage, i) => {
    const match = dbStatuses.find((s) =>
      s.name.toLowerCase().includes(stage.name.split(" ")[0].toLowerCase()) ||
      stage.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0])
    );
    return match ?? {
      id: `__placeholder_${i}`,
      module_id: null,
      name: stage.name,
      color_hex: stage.color_hex,
      display_order: i,
    };
  });
  const { data: boardConfig }                              = useBajajBoardConfig(slug);
  const { data: workOrders = [], isLoading: woLoading, refetch } = useWorkOrders(slug, filters);
  const updateWorkOrder = useUpdateWorkOrder();

  const meta           = MODULE_META[slug] ?? { name: slug, flag: "🌐", port: "" };
  const cardFaceFields = customFields.length ? customFields : (boardConfig?.card_face_fields ?? ["wo", "brand", "variant", "port", "qty"]);
  const availableFields = Array.from(new Set(workOrders.flatMap((wo) => Object.keys(wo.data ?? {}))));

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`bajaj-card-fields-${slug}`);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) setCustomFields(p); }
    } catch { /* ignore */ }
  }, [slug]);

  function toggleField(field: string) {
    setCustomFields((prev) => {
      const next = prev.includes(field) ? prev.filter((f) => f !== field) : prev.length < 5 ? [...prev, field] : prev;
      if (typeof window !== "undefined") window.localStorage.setItem(`bajaj-card-fields-${slug}`, JSON.stringify(next));
      return next;
    });
  }

  const filteredOrders = workOrders.filter((wo) => {
    if (filters.statusId && wo.status_id !== filters.statusId) return false;
    if (searchInput.trim() && !JSON.stringify(wo.data).toLowerCase().includes(searchInput.toLowerCase())) return false;
    return true;
  });

  function handleDrop(workOrderId: string, newStatusId: string, newOrder: number) {
    updateWorkOrder.mutate({ id: workOrderId, updates: { status_id: newStatusId, column_order: newOrder } });
  }

  const hasActiveFilter = !!(searchInput || filters.dateFrom || filters.dateTo || filters.statusId);

  return (
    <div className="bajaj-board-bg flex h-full flex-col overflow-hidden" style={{ background: "var(--card-bg)" }}>

      {/* ── Top bar — breadcrumb + actions (Linear-style) ─────────── */}
      <div className="bajaj-topbar flex items-center justify-between gap-3 px-5 py-2.5 border-b flex-shrink-0" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>

        {/* Breadcrumb + View toggle */}
        <div className="flex items-center gap-1.5 text-[13px] min-w-0">
          <span className="text-gray-400 font-medium">{meta.flag} {meta.name}</span>
          <span className="text-gray-300 select-none">/</span>
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all",
                viewMode === "board"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LayoutGrid className="size-3.5" />
              Board
            </button>
            <button
              onClick={() => setViewMode("spreadsheet")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all",
                viewMode === "spreadsheet"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Table2 className="size-3.5" />
              Spreadsheet
            </button>
          </div>
          <button className="ml-0.5 text-gray-300 hover:text-amber-400 transition-colors">
            <Star className="size-3.5" />
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status filter chips — desktop */}
          <div className="hidden md:flex items-center gap-1 mr-2 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilters((f) => ({ ...f, statusId: f.statusId === s.id ? undefined : s.id }))}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
                style={filters.statusId === s.id
                  ? { backgroundColor: `#${s.color_hex}22`, borderColor: `#${s.color_hex}66`, color: `#${s.color_hex}` }
                  : { backgroundColor: "transparent", borderColor: "#E5E7EB", color: "#9CA3AF" }}
              >
                <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `#${s.color_hex}` }} />
                {s.name}
              </button>
            ))}
          </div>

          <ReminderBell />

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
              showFilters || hasActiveFilter
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filter</span>
            {hasActiveFilter && <span className="size-1.5 rounded-full bg-amber-500" />}
          </button>

          <button
            onClick={() => setShowViewPanel((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
              showViewPanel ? "bg-gray-100 border-gray-300 text-gray-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
            )}
          >
            <Eye className="size-3.5" />
            <span>View</span>
          </button>

          <button
            onClick={() => refetch()}
            className="size-[30px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", woLoading && "animate-spin")} />
          </button>

          <Link
            href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Upload className="size-3.5" />
            <span>Import</span>
          </Link>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      {showFilters && (
        <div className="flex items-center gap-2.5 px-5 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text" placeholder="Search WO, vessel, port…"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:border-amber-500 focus:outline-none transition-colors w-56"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
            <span>From</span>
            <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-amber-500 focus:outline-none" />
            <span>to</span>
            <input type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-amber-500 focus:outline-none" />
          </div>
          {hasActiveFilter && (
            <button onClick={() => { setSearchInput(""); setFilters({}); }} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-amber-600 transition-colors">
              <X className="size-3" /> Clear
            </button>
          )}
          <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{filteredOrders.length} WO{filteredOrders.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* ── Field picker ─────────────────────────────────────────────── */}
      {showViewPanel && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-start gap-4 max-w-2xl">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Card fields <span className="text-gray-400 normal-case font-normal">(up to 5)</span></p>
                <button onClick={() => { setCustomFields([]); if (typeof window !== "undefined") window.localStorage.removeItem(`bajaj-card-fields-${slug}`); }}
                  className="text-[11px] text-gray-400 hover:text-amber-600 transition-colors">Reset</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableFields.length === 0
                  ? <span className="text-[12px] text-gray-400">Load data first to see available fields.</span>
                  : availableFields.map((field) => {
                    const selected = cardFaceFields.includes(field);
                    return (
                      <button key={field} onClick={() => toggleField(field)}
                        className={cn("px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors",
                          selected ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:border-gray-300")}>
                        {field}
                      </button>
                    );
                  })}
              </div>
            </div>
            <button onClick={() => setShowViewPanel(false)} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"><X className="size-4" /></button>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      {!statusLoading && statuses.length === 0 && workOrders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center flex-col gap-5 text-gray-400">
          <Upload className="size-10 text-gray-300" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">No work orders yet for {meta.name}</p>
            <p className="text-[13px] text-gray-400 mt-1">Import a dispatch plan or paste rows from the Bajaj email</p>
          </div>
          <Link href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors">
            <Upload className="size-4" /> Import Dispatch Plan
          </Link>
        </div>
      ) : viewMode === "board" ? (
        <div className="flex flex-1 overflow-hidden">
          <WorkOrderBoard
            slug={slug} statuses={statuses} workOrders={filteredOrders}
            cardFaceFields={cardFaceFields} isLight={true}
            isLoading={statusLoading || woLoading} selectedId={selectedId}
            onSelectCard={(id) => { setSelectedId(id); router.push(`/bajaj/work-orders/${id}`); }}
            onDrop={handleDrop}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden bg-white">
          <WorkOrderSpreadsheet
            workOrders={filteredOrders}
            statuses={statuses}
            isLoading={statusLoading || woLoading}
            onUpdate={(id, data) => updateWorkOrder.mutate({ id, updates: { data } })}
          />
        </div>
      )}
    </div>
  );
}
