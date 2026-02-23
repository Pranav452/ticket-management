"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { useTicket, useUpdateTicket } from "@/lib/queries/tickets";
import { useProfile } from "@/lib/queries/profiles";
import { ChatPanel } from "@/components/chat/chat-panel";
import { format } from "date-fns";
import {
  X,
  User,
  Calendar,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/lib/types";

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: "bg-emerald-900/40 text-emerald-400 border-emerald-800",
  medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  high: "bg-orange-900/40 text-orange-400 border-orange-800",
  urgent: "bg-red-900/40 text-red-400 border-red-800",
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  backlog: "bg-neutral-800 text-neutral-400 border-neutral-700",
  todo: "bg-yellow-900/30 text-yellow-300 border-yellow-800",
  doing: "bg-blue-900/30 text-blue-300 border-blue-800",
  done: "bg-emerald-900/30 text-emerald-300 border-emerald-800",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  doing: "In Progress",
  done: "Done",
};

function FileAttachment({ file }: { file: { id: string; file_url: string; file_name: string; file_type: string; file_size: number } }) {
  const isImage = file.file_type.startsWith("image/");
  const isVideo = file.file_type.startsWith("video/");

  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-800/50 overflow-hidden">
      {isImage && (
        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.file_url}
            alt={file.file_name}
            className="w-full max-h-40 object-cover"
          />
        </a>
      )}
      {isVideo && (
        <video
          src={file.file_url}
          controls
          className="w-full max-h-40"
          preload="metadata"
        />
      )}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {isImage ? (
            <ImageIcon className="size-3.5 text-blue-400 flex-shrink-0" />
          ) : isVideo ? (
            <Film className="size-3.5 text-purple-400 flex-shrink-0" />
          ) : file.file_type === "application/pdf" ? (
            <FileText className="size-3.5 text-red-400 flex-shrink-0" />
          ) : (
            <File className="size-3.5 text-neutral-400 flex-shrink-0" />
          )}
          <span className="text-xs text-neutral-300 truncate">
            {file.file_name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-200 p-1"
            aria-label="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <a
            href={file.file_url}
            download={file.file_name}
            className="text-neutral-500 hover:text-neutral-200 p-1"
            aria-label="Download file"
          >
            <Download className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function TicketDetailPanel() {
  const { selectedTicketId, isPanelOpen, closePanel } = useTicketStore();
  const { data: ticket, isLoading } = useTicket(selectedTicketId);
  const { data: currentProfile } = useProfile();
  const updateTicket = useUpdateTicket();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isPanelOpen) closePanel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen, closePanel]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && isPanelOpen) {
        closePanel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPanelOpen, closePanel]);

  const isDev = currentProfile?.role === "dev";

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={closePanel}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-neutral-900 border-l border-neutral-700 z-40 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-700 flex-shrink-0">
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <div className="h-5 w-48 rounded bg-neutral-800 animate-pulse" />
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 mb-1 font-mono">
                      #{ticket?.id.slice(0, 8)}
                    </p>
                    <h2 className="text-base font-semibold text-neutral-50 leading-snug">
                      {ticket?.title}
                    </h2>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="text-neutral-400 hover:text-neutral-50 flex-shrink-0 mt-0.5"
                aria-label="Close panel"
              >
                <X className="size-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="size-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ticket ? (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Meta */}
                <div className="px-5 py-4 space-y-4 border-b border-neutral-700/50">
                  {/* Badges row */}
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                        PRIORITY_STYLES[ticket.priority]
                      )}
                    >
                      {ticket.priority}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        STATUS_STYLES[ticket.status]
                      )}
                    >
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>

                  {/* Status change (dev only) */}
                  {isDev && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">Move to:</span>
                      <div className="flex gap-1 flex-wrap">
                        {(["backlog", "todo", "doing", "done"] as TicketStatus[]).map(
                          (s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={ticket.status === s || updateTicket.isPending}
                              onClick={() =>
                                updateTicket.mutate({ id: ticket.id, status: s })
                              }
                              className={cn(
                                "rounded px-2 py-0.5 text-xs transition-colors",
                                ticket.status === s
                                  ? "bg-neutral-700 text-neutral-500 cursor-default"
                                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 border border-neutral-700"
                              )}
                            >
                              {STATUS_LABELS[s]}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Created / Assigned info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                        <User className="size-3" /> Raised by
                      </p>
                      <p className="text-sm text-neutral-200">
                        {ticket.creator?.full_name ?? ticket.creator?.email ?? "Unknown"}
                      </p>
                    </div>
                    {ticket.assignee && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                          <User className="size-3" /> Assigned to
                        </p>
                        <p className="text-sm text-neutral-200">
                          {ticket.assignee.full_name ?? ticket.assignee.email}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                        <Calendar className="size-3" /> Created
                      </p>
                      <p className="text-sm text-neutral-200">
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Subject</p>
                      <p className="text-sm text-neutral-200">{ticket.subject}</p>
                    </div>
                  </div>

                  {/* CC / BCC */}
                  {(ticket.cc?.length > 0 || ticket.bcc?.length > 0) && (
                    <div className="space-y-1.5">
                      {ticket.cc?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-neutral-500 w-6">CC</span>
                          {ticket.cc.map((e) => (
                            <span
                              key={e}
                              className="rounded-full bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                      {ticket.bcc?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-neutral-500 w-6">BCC</span>
                          {ticket.bcc.map((e) => (
                            <span
                              key={e}
                              className="rounded-full bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                {ticket.description && (
                  <div className="px-5 py-4 border-b border-neutral-700/50">
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                      Description
                    </h3>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                {ticket.files && ticket.files.length > 0 && (
                  <div className="px-5 py-4 border-b border-neutral-700/50">
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Paperclip className="size-3" />
                      Attachments ({ticket.files.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {ticket.files.map((file) => (
                        <FileAttachment key={file.id} file={file} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat */}
                <div className="flex-1 flex flex-col min-h-0">
                  <ChatPanel ticketId={ticket.id} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
                Ticket not found
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
