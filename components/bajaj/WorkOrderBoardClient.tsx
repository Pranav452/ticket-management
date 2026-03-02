"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, BarChart2, Shield, Eye } from "lucide-react";
import { WorkOrderBoard } from "@/components/bajaj/WorkOrderBoard";
import { WorkOrderDetailPanel } from "@/components/bajaj/WorkOrderDetailPanel";
import { useBajajStatuses, useBajajBoardConfig, useWorkOrders, useUpdateWorkOrder } from "@/lib/queries/bajaj";
import type { WorkOrderFilters } from "@/lib/types/bajaj";
import { ReminderBell } from "@/components/bajaj/ReminderBell";

const MODULES = [
  { slug: "vipar", name: "Vipar" },
  { slug: "srilanka", name: "Sri Lanka" },
  { slug: "nigeria", name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph", name: "Triumph" },
];

interface WorkOrderBoardClientProps {
  slug: string;
  isAdmin: boolean;
}

export function WorkOrderBoardClient({ slug, isAdmin }: WorkOrderBoardClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkOrderFilters>({});
  const [filterSearch, setFilterSearch] = useState("");
  const [showViewPanel, setShowViewPanel] = useState(false);

  const { data: statuses = [], isLoading: statusLoading } = useBajajStatuses(slug);
  const { data: boardConfig } = useBajajBoardConfig(slug);
  const { data: workOrders = [], isLoading: woLoading } = useWorkOrders(slug, filters);
  const updateWorkOrder = useUpdateWorkOrder();

  const hasConfig = !!boardConfig?.unique_key_field;
  const [customFields, setCustomFields] = useState<string[]>([]);

  const cardFaceFields = customFields.length
    ? customFields
    : boardConfig?.card_face_fields ?? [];

  const availableFields = Array.from(
    new Set(
      workOrders.flatMap((wo) => Object.keys(wo.data ?? {})),
    ),
  );

  // Load per-user view configuration from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `bajaj-card-fields-${slug}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomFields(parsed);
        }
      } catch {
        // ignore
      }
    }
  }, [slug]);

  function toggleField(field: string) {
    setCustomFields((prev) => {
      const exists = prev.includes(field);
      let next: string[];
      if (exists) {
        next = prev.filter((f) => f !== field);
      } else if (prev.length < 5) {
        next = [...prev, field];
      } else {
        next = prev;
      }
      if (typeof window !== "undefined") {
        const key = `bajaj-card-fields-${slug}`;
        window.localStorage.setItem(key, JSON.stringify(next));
      }
      return next;
    });
  }

  // Client-side search filter
  const filteredOrders = filterSearch.trim()
    ? workOrders.filter((wo) =>
        JSON.stringify(wo.data).toLowerCase().includes(filterSearch.toLowerCase())
      )
    : workOrders;

  function handleDrop(workOrderId: string, newStatusId: string, newOrder: number) {
    updateWorkOrder.mutate({ id: workOrderId, updates: { status_id: newStatusId, column_order: newOrder } });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-neutral-800 flex-shrink-0">
        {/* Module tabs */}
        <div className="flex items-center gap-1">
          {MODULES.map((m) => (
            <Link
              key={m.slug}
              href={`/bajaj/boards/${m.slug}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                m.slug === slug
                  ? "bg-amber-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {m.name}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/bajaj/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <BarChart2 className="size-4" />
            Analytics
          </Link>
          <button
            type="button"
            onClick={() => setShowViewPanel((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-neutral-300 hover:text-neutral-50 bg-neutral-900 border border-neutral-700 transition-colors"
          >
            <Eye className="size-4" />
            View
          </button>
          <Link
            href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            <Upload className="size-4" />
            Import Excel
          </Link>
          <ReminderBell />
          {isAdmin && (
            <Link
              href="/bajaj/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <Shield className="size-4" />
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-800 flex-shrink-0 bg-neutral-900/50">
        <input
          type="text"
          placeholder="Search work orders…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="flex-1 max-w-xs rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
        />
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
          className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 focus:outline-none focus:border-amber-600"
        />
        <span className="text-neutral-600 text-sm">to</span>
        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
          className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 focus:outline-none focus:border-amber-600"
        />
        {(filterSearch || filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => { setFilterSearch(""); setFilters({}); }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-neutral-600">
          {filteredOrders.length} work order{filteredOrders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* View configuration panel */}
      {showViewPanel && (
        <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-950/90 flex-shrink-0">
          <div className="max-w-xl text-xs text-neutral-400">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-neutral-200">Card Fields for this Browser</p>
              <button
                type="button"
                onClick={() => {
                  setCustomFields([]);
                  setShowViewPanel(false);
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem(`bajaj-card-fields-${slug}`);
                  }
                }}
                className="text-[11px] text-neutral-500 hover:text-neutral-200"
              >
                Reset to default
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mb-2">
              Choose up to 5 fields to show on each card. This only affects your own view.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableFields.map((field) => {
                const selected = cardFaceFields.includes(field);
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleField(field)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                      selected
                        ? "bg-neutral-800 text-neutral-50 border-neutral-600"
                        : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-200"
                    }`}
                  >
                    {field}
                  </button>
                );
              })}
              {availableFields.length === 0 && (
                <span className="text-[11px] text-neutral-600">
                  Fields will appear here once data is loaded.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Board ────────────────────────────────────────────────── */}
      {!hasConfig && !statusLoading && statuses.length === 0 ? (
        <div className="flex flex-1 items-center justify-center flex-col gap-4 text-neutral-600">
          <Upload className="size-10" />
          <p className="text-sm">No work orders yet.</p>
          <Link
            href={`/bajaj/import?module=${slug}`}
            className="text-sm text-amber-500 hover:text-amber-400 underline"
          >
            Import your Excel file to get started
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <WorkOrderBoard
            slug={slug}
            statuses={statuses}
            workOrders={filteredOrders}
            cardFaceFields={cardFaceFields}
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
            />
          )}
        </div>
      )}
    </div>
  );
}
