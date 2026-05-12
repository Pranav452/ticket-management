"use client";

import React, { useRef, useState } from "react";
import { Search, X, Clock } from "lucide-react";
import { WorkOrderCard } from "@/components/bajaj/WorkOrderCard";
import type { BajajStatus, BajajWorkOrder } from "@/lib/types/bajaj";
import type { ColPerm } from "@/lib/queries/bajaj";
import { cn } from "@/lib/utils";

interface WorkOrderBoardProps {
  slug: string;
  statuses: BajajStatus[];
  workOrders: BajajWorkOrder[];
  cardFaceFields: string[];
  isLight?: boolean;
  isLoading: boolean;
  selectedId: string | null;
  isAdmin: boolean;
  userPerms: Map<string | null, ColPerm>;
  onSelectCard: (id: string) => void;
  onDrop: (workOrderId: string, newStatusId: string, newOrder: number) => void;
}

function DropIndicator({ beforeId, statusId }: { beforeId: string | null; statusId: string }) {
  return (
    <div
      data-before={beforeId ?? "-1"}
      data-status={statusId}
      className="my-0.5 h-0.5 w-full rounded-full bg-amber-400 opacity-0 transition-opacity"
    />
  );
}

// Status icon — circle with color or clock
function StatusIcon({ colorHex, name }: { colorHex: string; name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("progress") || lower.includes("review")) {
    return <Clock className="size-3.5 flex-shrink-0" style={{ color: `#${colorHex}` }} />;
  }
  return (
    <span
      className="size-3 rounded-full border-2 flex-shrink-0"
      style={{ borderColor: `#${colorHex}`, background: "transparent" }}
    />
  );
}

function Column({
  status, workOrders, cardFaceFields, selectedId, canDropHere, getCardCanDrag, onSelectCard, onDrop,
}: {
  status: BajajStatus;
  workOrders: BajajWorkOrder[];
  cardFaceFields: string[];
  selectedId: string | null;
  canDropHere: boolean;
  getCardCanDrag: (wo: BajajWorkOrder) => boolean;
  onSelectCard: (id: string) => void;
  onDrop: (workOrderId: string, newStatusId: string, newOrder: number) => void;
}) {
  const [active,        setActive]        = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }
  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function getIndicators() {
    return Array.from(document.querySelectorAll<HTMLElement>(`[data-status="${status.id}"]`));
  }
  function getNearestIndicator(e: React.DragEvent, indicators: HTMLElement[]) {
    const DISTANCE_OFFSET = 50;
    return indicators.reduce(
      (closest, child) => {
        const box    = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + DISTANCE_OFFSET);
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: indicators[indicators.length - 1] }
    );
  }
  function highlightIndicator(e: React.DragEvent) {
    const indicators = getIndicators();
    clearHighlights(indicators);
    const el = getNearestIndicator(e, indicators);
    el.element.style.opacity = "1";
  }
  function clearHighlights(els?: HTMLElement[]) {
    (els ?? getIndicators()).forEach((i) => (i.style.opacity = "0"));
  }
  function handleDragStart(e: React.DragEvent, wo: BajajWorkOrder) {
    e.dataTransfer.setData("workOrderId", wo.id);
    e.dataTransfer.setData("fromStatusId", wo.status_id ?? "");
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); highlightIndicator(e); setActive(true); }
  function handleDragLeave() { clearHighlights(); setActive(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); clearHighlights(); setActive(false);
    if (!canDropHere) return;
    const workOrderId = e.dataTransfer.getData("workOrderId");
    if (!workOrderId) return;
    const indicators = getIndicators();
    const { element } = getNearestIndicator(e, indicators);
    const before = element.dataset.before ?? "-1";
    if (before === workOrderId) return;
    let newOrder: number;
    if (before === "-1") {
      const last = workOrders[workOrders.length - 1];
      newOrder = last ? last.column_order + 1 : 1;
    } else {
      const beforeWo = workOrders.find((wo) => wo.id === before);
      const idx = workOrders.findIndex((wo) => wo.id === before);
      const prevWo = idx > 0 ? workOrders[idx - 1] : null;
      newOrder = prevWo && beforeWo ? (prevWo.column_order + beforeWo.column_order) / 2 : beforeWo ? beforeWo.column_order - 0.5 : 1;
    }
    onDrop(workOrderId, status.id, newOrder);
  }

  const sorted = [...workOrders].sort((a, b) => a.column_order - b.column_order);
  const columnOrders = searchQuery.trim()
    ? sorted.filter((wo) => JSON.stringify(wo.data).toLowerCase().includes(searchQuery.toLowerCase()))
    : sorted;

  return (
    <div className="flex flex-col w-[280px] flex-shrink-0 border-r border-gray-100 dark:border-white/[0.06] last:border-r-0 min-h-full" style={{ background: "var(--card-bg)" }}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-white/[0.06] group min-h-[40px]">
        {searchOpen ? (
          /* Expanded search input */
          <div className="flex items-center gap-1.5 flex-1">
            <Search className="size-3 text-gray-400 dark:text-white/30 flex-shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
              placeholder={`Search ${status.name}…`}
              className="flex-1 bg-transparent text-[12px] text-gray-700 dark:text-white/80 placeholder-gray-400 dark:placeholder-white/25 focus:outline-none min-w-0"
            />
            <button
              onClick={closeSearch}
              className="size-4 flex items-center justify-center rounded text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 flex-shrink-0 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          /* Normal header */
          <>
            <StatusIcon colorHex={status.color_hex} name={status.name} />
            <span className="text-[13px] font-semibold text-gray-700 dark:text-white/80 flex-1 truncate">{status.name}</span>
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/30 tabular-nums">{workOrders.length}</span>
            <button
              onClick={openSearch}
              className="size-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-white/30 transition-all"
              title="Search this column"
            >
              <Search className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex-1 p-2 transition-colors min-h-[120px] overflow-y-auto",
          active ? "bg-amber-50 dark:bg-amber-500/10" : "bg-transparent"
        )}
      >
        {columnOrders.map((wo) => (
          <React.Fragment key={wo.id}>
            <DropIndicator beforeId={wo.id} statusId={status.id} />
            <WorkOrderCard
              workOrder={wo} cardFaceFields={cardFaceFields} isLight={true}
              isSelected={selectedId === wo.id}
              canDrag={getCardCanDrag(wo)}
              onSelect={() => onSelectCard(wo.id)}
              onDragStart={(e) => handleDragStart(e, wo)}
              statusColor={status.color_hex}
            />
          </React.Fragment>
        ))}
        <DropIndicator beforeId={null} statusId={status.id} />

        {columnOrders.length === 0 && (
          <div className={cn(
            "flex items-center justify-center h-16 rounded-lg border border-dashed text-[11px] transition-colors",
            active ? "border-amber-300 text-amber-500 dark:border-amber-500/50" : "border-gray-200 dark:border-white/[0.08] text-gray-300 dark:text-white/20"
          )}>
            {active ? "Drop here" : searchQuery.trim() ? "No matches" : "No work orders"}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkOrderBoard({ statuses, workOrders, cardFaceFields, isLoading, selectedId, isAdmin, userPerms, onSelectCard, onDrop }: WorkOrderBoardProps) {
  function resolvedPerm(statusName: string): ColPerm | null {
    return userPerms.get(statusName) ?? userPerms.get(null) ?? null;
  }
  function canDropHere(statusName: string) {
    if (isAdmin) return true;
    return resolvedPerm(statusName)?.can_move ?? false;
  }
  function getCardCanDrag(wo: BajajWorkOrder) {
    if (isAdmin) return true;
    const name = wo.status?.name ?? null;
    const perm = name ? resolvedPerm(name) : null;
    return perm?.can_move ?? false;
  }
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2.5">
        <div className="size-1.5 rounded-full bg-gray-300 dark:bg-white/20 animate-pulse" />
        <div className="size-1.5 rounded-full bg-gray-300 dark:bg-white/20 animate-pulse [animation-delay:150ms]" />
        <div className="size-1.5 rounded-full bg-gray-300 dark:bg-white/20 animate-pulse [animation-delay:300ms]" />
      </div>
    );
  }

  return (
    <div className="bajaj-board-bg flex flex-1 overflow-x-auto overflow-y-hidden items-stretch" style={{ background: "var(--main-bg)" }}>
      {statuses.map((status, idx) => (
        <Column
          key={status.id}
          status={status}
          workOrders={workOrders.filter((wo) =>
            wo.status_id === status.id ||
            (idx === 0 && (wo.status_id === null || wo.status_id === undefined))
          )}
          cardFaceFields={cardFaceFields}
          selectedId={selectedId}
          canDropHere={canDropHere(status.name)}
          getCardCanDrag={getCardCanDrag}
          onSelectCard={onSelectCard}
          onDrop={onDrop}
        />
      ))}
      {statuses.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          No status columns defined. Import an Excel file to configure the board.
        </div>
      )}
    </div>
  );
}
