"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { WorkOrderCard } from "@/components/bajaj/WorkOrderCard";
import type { BajajStatus, BajajWorkOrder } from "@/lib/types/bajaj";

interface WorkOrderBoardProps {
  slug: string;
  statuses: BajajStatus[];
  workOrders: BajajWorkOrder[];
  cardFaceFields: string[];
  isLoading: boolean;
  selectedId: string | null;
  onSelectCard: (id: string) => void;
  onDrop: (workOrderId: string, newStatusId: string, newOrder: number) => void;
}

// ─── Drop Indicator ───────────────────────────────────────────────────────────
function DropIndicator({ beforeId, statusId }: { beforeId: string | null; statusId: string }) {
  return (
    <div
      data-before={beforeId ?? "-1"}
      data-status={statusId}
      className="my-0.5 h-0.5 w-full bg-amber-400 opacity-0"
    />
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function Column({
  status,
  workOrders,
  cardFaceFields,
  selectedId,
  onSelectCard,
  onDrop,
}: {
  status: BajajStatus;
  workOrders: BajajWorkOrder[];
  cardFaceFields: string[];
  selectedId: string | null;
  onSelectCard: (id: string) => void;
  onDrop: (workOrderId: string, newStatusId: string, newOrder: number) => void;
}) {
  const [active, setActive] = useState(false);

  function getIndicators() {
    return Array.from(
      document.querySelectorAll<HTMLElement>(`[data-status="${status.id}"]`)
    );
  }

  function getNearestIndicator(e: React.DragEvent, indicators: HTMLElement[]) {
    const DISTANCE_OFFSET = 50;
    const el = indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + DISTANCE_OFFSET);
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: indicators[indicators.length - 1] }
    );
    return el;
  }

  function highlightIndicator(e: React.DragEvent) {
    const indicators = getIndicators();
    clearHighlights(indicators);
    const el = getNearestIndicator(e, indicators);
    el.element.style.opacity = "1";
  }

  function clearHighlights(els?: HTMLElement[]) {
    const indicators = els ?? getIndicators();
    indicators.forEach((i) => (i.style.opacity = "0"));
  }

  function handleDragStart(e: React.DragEvent, wo: BajajWorkOrder) {
    e.dataTransfer.setData("workOrderId", wo.id);
    e.dataTransfer.setData("fromStatusId", wo.status_id ?? "");
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    highlightIndicator(e);
    setActive(true);
  }

  function handleDragLeave() {
    clearHighlights();
    setActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    clearHighlights();
    setActive(false);

    const workOrderId = e.dataTransfer.getData("workOrderId");
    if (!workOrderId) return;

    const indicators = getIndicators();
    const { element } = getNearestIndicator(e, indicators);
    const before = element.dataset.before ?? "-1";

    if (before === workOrderId) return;

    // Compute new column_order
    let newOrder: number;
    if (before === "-1") {
      // Drop at end
      const last = workOrders[workOrders.length - 1];
      newOrder = last ? last.column_order + 1 : 1;
    } else {
      const beforeWo = workOrders.find((wo) => wo.id === before);
      const idx = workOrders.findIndex((wo) => wo.id === before);
      const prevWo = idx > 0 ? workOrders[idx - 1] : null;
      newOrder = prevWo && beforeWo
        ? (prevWo.column_order + beforeWo.column_order) / 2
        : beforeWo
        ? beforeWo.column_order - 0.5
        : 1;
    }

    onDrop(workOrderId, status.id, newOrder);
  }

  const columnOrders = workOrders.sort((a, b) => a.column_order - b.column_order);

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 mb-2">
        <span
          className="size-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: `#${status.color_hex}` }}
        />
        <span className="text-sm font-medium text-neutral-300 truncate">
          {status.name}
        </span>
        <span className="ml-auto text-xs text-neutral-600 bg-neutral-800 rounded px-1.5 py-0.5">
          {workOrders.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 rounded-xl p-2 transition-colors min-h-[120px] ${
          active ? "bg-neutral-800/60" : "bg-neutral-900/30"
        }`}
      >
        {columnOrders.map((wo) => (
          <React.Fragment key={wo.id}>
            <DropIndicator beforeId={wo.id} statusId={status.id} />
            <WorkOrderCard
              workOrder={wo}
              cardFaceFields={cardFaceFields}
              isSelected={selectedId === wo.id}
              onSelect={() => onSelectCard(wo.id)}
              onDragStart={(e) => handleDragStart(e, wo)}
              statusColor={status.color_hex}
            />
          </React.Fragment>
        ))}
        <DropIndicator beforeId={null} statusId={status.id} />
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────
export function WorkOrderBoard({
  statuses,
  workOrders,
  cardFaceFields,
  isLoading,
  selectedId,
  onSelectCard,
  onDrop,
}: WorkOrderBoardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-600 text-sm">
        Loading board…
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto p-6 pb-8">
      {statuses.map((status) => (
        <Column
          key={status.id}
          status={status}
          workOrders={workOrders.filter((wo) => wo.status_id === status.id)}
          cardFaceFields={cardFaceFields}
          selectedId={selectedId}
          onSelectCard={onSelectCard}
          onDrop={onDrop}
        />
      ))}

      {statuses.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-neutral-600 text-sm">
          No status columns defined. Import an Excel file to configure the board.
        </div>
      )}
    </div>
  );
}
