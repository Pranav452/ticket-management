"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, BarChart2, Shield } from "lucide-react";
import { WorkOrderBoard } from "@/components/bajaj/WorkOrderBoard";
import { WorkOrderDetailPanel } from "@/components/bajaj/WorkOrderDetailPanel";
import { useBajajStatuses, useBajajBoardConfig, useWorkOrders, useUpdateWorkOrder } from "@/lib/queries/bajaj";
import type { WorkOrderFilters } from "@/lib/types/bajaj";

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

  const { data: statuses = [], isLoading: statusLoading } = useBajajStatuses(slug);
  const { data: boardConfig } = useBajajBoardConfig(slug);
  const { data: workOrders = [], isLoading: woLoading } = useWorkOrders(slug, filters);
  const updateWorkOrder = useUpdateWorkOrder();

  const hasConfig = !!boardConfig?.unique_key_field;
  const cardFaceFields = boardConfig?.card_face_fields ?? [];

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
          <Link
            href={`/bajaj/import?module=${slug}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            <Upload className="size-4" />
            Import Excel
          </Link>
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
