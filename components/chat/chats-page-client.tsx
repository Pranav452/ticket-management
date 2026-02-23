"use client";

import { useState } from "react";
import { useTickets } from "@/lib/queries/tickets";
import { useMessages } from "@/lib/queries/messages";
import { useProfile } from "@/lib/queries/profiles";
import { ChatPanel } from "@/components/chat/chat-panel";
import { format, isToday } from "date-fns";
import { MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

function TicketChatRow({
  ticket,
  isSelected,
  onClick,
}: {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800/60 transition-colors flex items-start gap-3",
        isSelected && "bg-neutral-800"
      )}
    >
      {/* Avatar placeholder */}
      <div className="size-9 rounded-full bg-violet-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {ticket.title[0]?.toUpperCase() ?? "T"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-neutral-100 truncate">
            {ticket.title}
          </p>
          <span className="text-xs text-neutral-600 flex-shrink-0">
            {isToday(new Date(ticket.updated_at))
              ? format(new Date(ticket.updated_at), "HH:mm")
              : format(new Date(ticket.updated_at), "MMM d")}
          </span>
        </div>
        <p className="text-xs text-neutral-500 truncate mt-0.5">
          {ticket.subject}
        </p>
      </div>
    </button>
  );
}

export function ChatsPageClient() {
  const { data: tickets = [], isLoading } = useTickets();
  const { data: currentProfile } = useProfile();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading chats…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
        <MessageSquare className="size-12 text-neutral-700 mb-4" />
        <p className="text-neutral-400 font-medium">No chats yet</p>
        <p className="text-sm text-neutral-600 mt-1">
          {currentProfile?.role === "dev"
            ? "Chat threads will appear here as tickets are raised"
            : "Raise a ticket to start chatting with the dev team"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Ticket list */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-700 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-700">
          <h1 className="text-sm font-semibold text-neutral-100">Chats</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {tickets.length} conversation{tickets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tickets.map((ticket) => (
            <TicketChatRow
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketId === ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
            />
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-700 flex-shrink-0">
              <p className="text-xs text-neutral-500 font-mono mb-0.5">
                #{selectedTicket.id.slice(0, 8)}
              </p>
              <h2 className="text-sm font-semibold text-neutral-100">
                {selectedTicket.title}
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel ticketId={selectedTicket.id} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
            <MessageSquare className="size-10 text-neutral-700 mb-3" />
            <p className="text-sm text-neutral-500">
              Select a ticket to view the conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
