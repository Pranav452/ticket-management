"use client"

import { parseMessageContent } from "@/lib/utils/chatParser"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types/chat"

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

interface Props {
  message: ChatMessage
  currentUserId: string
  showSenderName?: boolean
}

export function MessageItem({ message, currentUserId, showSenderName }: Props) {
  const isOwn    = message.sender_id === currentUserId
  const segments = parseMessageContent(message.content)

  return (
    <div className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
      {showSenderName && !isOwn && message.sender_name && (
        <span className="text-[11px] text-gray-400 dark:text-white/40 px-1">{message.sender_name}</span>
      )}

      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words",
          isOwn
            ? "bg-amber-500 text-white rounded-br-sm"
            : "bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white/90 rounded-bl-sm"
        )}
      >
        {segments.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.value}</span>

          if (seg.type === "mention") {
            return (
              <span
                key={i}
                className={cn(
                  "font-semibold rounded px-0.5",
                  isOwn
                    ? "text-white/90 underline decoration-dotted"
                    : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                )}
              >
                @{seg.name}
              </span>
            )
          }

          if (seg.type === "ref") {
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium mx-0.5",
                  isOwn
                    ? "bg-white/20 text-white"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                )}
              >
                ↗ {seg.refNo}
              </span>
            )
          }

          return null
        })}
      </div>

      <span className="text-[10px] text-gray-400 dark:text-white/30 px-1">{formatTime(message.created_at)}</span>
    </div>
  )
}
