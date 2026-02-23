"use client";

import { useState, useRef, useEffect } from "react";
import { useMessages, useSendMessage } from "@/lib/queries/messages";
import { useProfile } from "@/lib/queries/profiles";
import { format, isToday, isYesterday } from "date-fns";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function formatMessageTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d, HH:mm");
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "rounded-full bg-violet-600 flex items-center justify-center font-semibold text-white flex-shrink-0",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm"
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function ChatPanel({ ticketId }: { ticketId: string }) {
  const { data: messages = [], isLoading } = useMessages(ticketId);
  const sendMessage = useSendMessage();
  const { data: currentProfile } = useProfile();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sendMessage.isPending) return;
    setText("");
    try {
      await sendMessage.mutateAsync({ ticketId, content });
    } catch {
      setText(content); // restore on error
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Section header */}
      <div className="px-5 py-3 border-b border-neutral-700/50 flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="size-3.5 text-neutral-500" />
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Conversation
        </h3>
        {messages.length > 0 && (
          <span className="ml-auto text-xs text-neutral-600">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[180px]">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-neutral-600" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="size-8 text-neutral-700 mb-2" />
            <p className="text-xs text-neutral-600">
              No messages yet. Start the conversation!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentProfile?.id;
          const senderName =
            msg.sender?.full_name ?? msg.sender?.email ?? "Unknown";

          return (
            <div
              key={msg.id}
              className={cn("flex gap-2.5", isOwn && "flex-row-reverse")}
            >
              <Avatar name={senderName} />
              <div
                className={cn(
                  "flex flex-col gap-1 max-w-[75%]",
                  isOwn && "items-end"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isOwn ? "text-violet-300" : "text-neutral-400"
                    )}
                  >
                    {isOwn ? "You" : senderName}
                  </span>
                  {msg.sender?.role === "dev" && (
                    <span className="rounded-full bg-violet-900/40 border border-violet-800 px-1.5 py-0.5 text-[10px] text-violet-400">
                      dev
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isOwn
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-neutral-800 text-neutral-100 rounded-tl-sm border border-neutral-700"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <span className="text-[10px] text-neutral-600">
                  {formatMessageTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-neutral-700/50 flex-shrink-0">
        <div className="flex gap-2 items-end bg-neutral-800 rounded-xl border border-neutral-700 px-3 py-2 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-neutral-50 placeholder-neutral-500 resize-none focus:outline-none max-h-32 overflow-y-auto py-0.5"
            style={{ minHeight: "24px" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="text-violet-400 hover:text-violet-300 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
            aria-label="Send message"
          >
            {sendMessage.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 mt-1.5 px-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
