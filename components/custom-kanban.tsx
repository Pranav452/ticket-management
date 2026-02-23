"use client";

import React, { useState } from "react";
import { FiTrash } from "react-icons/fi";
import { motion } from "framer-motion";
import { FaFire } from "react-icons/fa";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTickets, useUpdateTicket, useCreateTicket } from "@/lib/queries/tickets";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { useRouter } from "next/navigation";
import type { Ticket, TicketStatus, TicketPriority } from "@/lib/types";

// ─── Priority styles ─────────────────────────────────────
const PRIORITY_LEFT_BORDER: Record<TicketPriority, string> = {
  low: "border-l-emerald-500",
  medium: "border-l-yellow-500",
  high: "border-l-orange-500",
  urgent: "border-l-red-500",
};

const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: "bg-emerald-400",
  medium: "bg-yellow-400",
  high: "bg-orange-400",
  urgent: "bg-red-400",
};

// ─── Column config ────────────────────────────────────────
const COLUMNS: { id: TicketStatus; title: string; headingColor: string }[] = [
  { id: "backlog", title: "Backlog", headingColor: "text-neutral-500" },
  { id: "todo", title: "TODO", headingColor: "text-yellow-200" },
  { id: "doing", title: "In Progress", headingColor: "text-blue-200" },
  { id: "done", title: "Complete", headingColor: "text-emerald-200" },
];

// ─── Drop indicator ───────────────────────────────────────
const DropIndicator = ({
  beforeId,
  column,
}: {
  beforeId: string | null;
  column: string;
}) => (
  <div
    data-before={beforeId ?? "-1"}
    data-column={column}
    className="my-0.5 h-0.5 w-full bg-violet-400 opacity-0"
  />
);

// ─── Ticket Card ──────────────────────────────────────────
const TicketCard = ({
  ticket,
  handleDragStart,
}: {
  ticket: Ticket;
  handleDragStart: (e: React.DragEvent, ticket: Ticket) => void;
}) => {
  const { setSelectedTicket } = useTicketStore();

  return (
    <>
      <DropIndicator beforeId={ticket.id} column={ticket.status} />
      <motion.div
        layout
        layoutId={ticket.id}
        className={cn(
          "rounded border-l-4 border border-neutral-700 bg-neutral-800 p-3 cursor-pointer hover:bg-neutral-750 hover:border-neutral-600 transition-colors group",
          PRIORITY_LEFT_BORDER[ticket.priority]
        )}
        onClick={() => setSelectedTicket(ticket.id)}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, ticket);
          }}
          className="cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm text-neutral-100 leading-snug group-hover:text-white">
              {ticket.title}
            </p>
            <span
              className={cn(
                "mt-0.5 size-2 rounded-full flex-shrink-0",
                PRIORITY_DOT[ticket.priority]
              )}
              aria-label={`Priority: ${ticket.priority}`}
            />
          </div>
          <p className="text-xs text-neutral-500 truncate">{ticket.subject}</p>
          {ticket.creator && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="size-4 rounded-full bg-violet-600 flex items-center justify-center text-[8px] font-bold text-white">
                {(ticket.creator.full_name ?? ticket.creator.email)[0]?.toUpperCase()}
              </div>
              <span className="text-[10px] text-neutral-600 truncate">
                {ticket.creator.full_name ?? ticket.creator.email}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

// ─── Kanban Column ────────────────────────────────────────
const Column = ({
  column,
  title,
  headingColor,
  tickets,
  allTickets,
}: {
  column: TicketStatus;
  title: string;
  headingColor: string;
  tickets: Ticket[];
  allTickets: Ticket[];
}) => {
  const [active, setActive] = useState(false);
  const updateTicket = useUpdateTicket();

  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    e.dataTransfer.setData("ticketId", ticket.id);
  };

  const getIndicators = (): Element[] =>
    Array.from(document.querySelectorAll(`[data-column="${column}"]`));

  const clearHighlights = (els?: Element[] | null) => {
    const indicators = els ?? getIndicators();
    indicators.forEach((i) => ((i as HTMLElement).style.opacity = "0"));
  };

  const getNearestIndicator = (
    e: React.DragEvent,
    indicators: Element[]
  ): { offset: number; element: Element } => {
    const DISTANCE_OFFSET = 50;
    return indicators.reduce(
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
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const ticketId = e.dataTransfer.getData("ticketId");
    setActive(false);
    clearHighlights();

    const indicators = getIndicators();
    const { element } = getNearestIndicator(e, indicators);
    const before = (element as HTMLElement).dataset.before ?? "-1";

    if (before !== ticketId) {
      const ticket = allTickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      // Calculate new column_order
      let newOrder = 0;
      if (before === "-1") {
        // Dropped at end
        const colTickets = allTickets.filter((t) => t.status === column);
        newOrder = colTickets.length > 0
          ? Math.max(...colTickets.map((t) => t.column_order)) + 1
          : 0;
      } else {
        const beforeTicket = allTickets.find((t) => t.id === before);
        const idx = tickets.findIndex((t) => t.id === before);
        const prevTicket = idx > 0 ? tickets[idx - 1] : null;
        newOrder = beforeTicket && prevTicket
          ? (beforeTicket.column_order + prevTicket.column_order) / 2
          : beforeTicket
          ? beforeTicket.column_order - 0.5
          : 0;
      }

      updateTicket.mutate({
        id: ticketId,
        status: column,
        column_order: newOrder,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const indicators = getIndicators();
    clearHighlights(indicators);
    const el = getNearestIndicator(e, indicators);
    (el.element as HTMLElement).style.opacity = "1";
    setActive(true);
  };

  const handleDragLeave = () => {
    clearHighlights();
    setActive(false);
  };

  return (
    <div className="w-56 shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className={`font-medium ${headingColor}`}>{title}</h3>
        <span className="rounded text-sm text-neutral-400">{tickets.length}</span>
      </div>
      <div
        onDrop={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "h-full w-full transition-colors",
          active ? "bg-neutral-800/50" : "bg-neutral-800/0"
        )}
      >
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            handleDragStart={handleDragStart}
          />
        ))}
        <DropIndicator beforeId={null} column={column} />
      </div>
    </div>
  );
};

// ─── Burn Barrel ──────────────────────────────────────────
const BurnBarrel = () => {
  const [active, setActive] = useState(false);
  const updateTicket = useUpdateTicket();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(true);
  };

  const handleDragLeave = () => setActive(false);

  const handleDragEnd = (e: React.DragEvent) => {
    const ticketId = e.dataTransfer.getData("ticketId");
    // Move to done instead of deleting permanently (safer)
    updateTicket.mutate({ id: ticketId, status: "done" });
    setActive(false);
  };

  return (
    <div
      onDrop={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "mt-10 grid size-56 shrink-0 place-content-center rounded border text-3xl transition-colors",
        active
          ? "border-red-800 bg-red-800/20 text-red-500"
          : "border-neutral-500 bg-neutral-500/20 text-neutral-500"
      )}
    >
      {active ? (
        <FaFire className="animate-bounce" aria-hidden />
      ) : (
        <FiTrash aria-hidden />
      )}
    </div>
  );
};

// ─── Board ────────────────────────────────────────────────
const Board = () => {
  const router = useRouter();
  const { data: tickets = [], isLoading, error } = useTickets();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        <div className="size-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-400 text-sm">
        Failed to load tickets
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-12 pt-8 pb-2 flex-shrink-0">
        <h1 className="text-lg font-semibold text-neutral-200">
          Ticket Board
        </h1>
        <button
          type="button"
          onClick={() => router.push("/tickets/new")}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
        >
          <Plus className="size-4" />
          New Ticket
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 min-h-0 w-full gap-3 overflow-auto px-12 pb-8 pt-4">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            column={col.id}
            title={col.title}
            headingColor={col.headingColor}
            tickets={tickets.filter((t) => t.status === col.id)}
            allTickets={tickets}
          />
        ))}
        <BurnBarrel />
      </div>
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────
export const CustomKanban = ({ className }: { className?: string } = {}) => (
  <div
    className={cn(
      "h-full w-full bg-neutral-900 text-neutral-50 flex flex-col min-h-0",
      className
    )}
  >
    <Board />
  </div>
);
