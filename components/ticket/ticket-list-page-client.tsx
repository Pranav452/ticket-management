"use client";

import { useTickets } from "@/lib/queries/tickets";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { TicketDetailPanel } from "@/components/ticket/ticket-detail-panel";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Ticket as TicketIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/lib/types";

const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: "bg-emerald-400",
  medium: "bg-yellow-400",
  high: "bg-orange-400",
  urgent: "bg-red-400",
};

const STATUS_PILL: Record<TicketStatus, string> = {
  backlog: "bg-neutral-800 text-neutral-400",
  todo: "bg-yellow-900/30 text-yellow-300",
  doing: "bg-blue-900/30 text-blue-300",
  done: "bg-emerald-900/30 text-emerald-300",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  doing: "In Progress",
  done: "Done",
};

export function TicketListPageClient() {
  const router = useRouter();
  const { data: tickets, isLoading, error } = useTickets();
  const { setSelectedTicket } = useTicketStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden relative">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-neutral-50">My Tickets</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {tickets?.length ?? 0} ticket{tickets?.length !== 1 ? "s" : ""} raised
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/tickets/new")}
          className="flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
        >
          <Plus className="size-4" />
          New Ticket
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-neutral-500">
            <Loader2 className="size-6 animate-spin mr-2" />
            Loading tickets…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 py-10 justify-center">
            <AlertCircle className="size-5" />
            <span className="text-sm">Failed to load tickets</span>
          </div>
        )}

        {!isLoading && !error && tickets?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TicketIcon className="size-12 text-neutral-700 mb-4" />
            <p className="text-neutral-400 font-medium">No tickets yet</p>
            <p className="text-sm text-neutral-600 mt-1">
              Raise your first ticket to get started
            </p>
            <button
              type="button"
              onClick={() => router.push("/tickets/new")}
              className="mt-4 flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
            >
              <Plus className="size-4" />
              Raise a Ticket
            </button>
          </div>
        )}

        {!isLoading && !error && tickets && tickets.length > 0 && (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicket(ticket.id)}
                className="w-full text-left rounded-lg border border-neutral-700 bg-neutral-800/40 hover:bg-neutral-800 hover:border-neutral-600 transition-colors p-4 group"
              >
                <div className="flex items-start gap-3">
                  {/* Priority dot */}
                  <span
                    className={cn(
                      "mt-1.5 size-2 rounded-full flex-shrink-0",
                      PRIORITY_DOT[ticket.priority]
                    )}
                    aria-label={`Priority: ${ticket.priority}`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-100 truncate group-hover:text-white">
                        {ticket.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
                          STATUS_PILL[ticket.status]
                        )}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 truncate">
                      {ticket.subject}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-600">
                      <span>
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </span>
                      {ticket.files && ticket.files.length > 0 && (
                        <span>{ticket.files.length} attachment{ticket.files.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket detail slide-in panel */}
      <TicketDetailPanel />
    </div>
  );
}
