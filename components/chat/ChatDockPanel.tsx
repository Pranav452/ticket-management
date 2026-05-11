"use client"

import { useEffect, useRef } from "react"
import { Maximize2, Minus, Users, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useChatDock } from "@/lib/store/chatDock"
import { useMessages, useRooms, useMarkAsRead } from "@/lib/hooks/useChat"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { MessageItem } from "@/components/chat/MessageItem"
import { MessageInput } from "@/components/chat/MessageInput"
import { cn } from "@/lib/utils"
import type { ChatMember, ChatMessage } from "@/lib/types/chat"

interface Props { roomId: string; minimized: boolean }

export function ChatDockPanel({ roomId, minimized }: Props) {
  const router                        = useRouter()
  const { closeChat, toggleMinimize } = useChatDock()
  const { data: rooms = [] }          = useRooms()
  const currentUser                   = useCurrentUser()
  const currentUserId                 = currentUser?.id ?? null
  const markAsRead                    = useMarkAsRead(roomId)
  const bottomRef                     = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useMessages(roomId)

  const room    = rooms.find((r) => r.id === roomId)
  const members: ChatMember[] = room?.members ?? []
  const isGroup = room?.type === "group"
  const unread  = room?.unread_count ?? 0

  let displayName = room?.name ?? "Chat"
  let initials    = "?"
  if (room?.type === "direct" && currentUserId) {
    const other = members.find((m) => m.user_id !== currentUserId)
    if (other?.full_name) {
      displayName = other.full_name
      initials    = other.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    }
  } else if (room?.type === "group") {
    initials = (room.name ?? "G").slice(0, 2).toUpperCase()
  }

  const allMessages: ChatMessage[] = []
  if (data?.pages) {
    const pages = [...data.pages].reverse()
    for (const page of pages) allMessages.push(...[...page.messages].reverse())
  }

  useEffect(() => {
    if (!minimized) markAsRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, minimized, allMessages.length])

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [allMessages.length, minimized])

  useEffect(() => {
    if (!minimized && !isLoading) bottomRef.current?.scrollIntoView()
  }, [minimized, isLoading])

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col bg-white border border-gray-200 rounded-t-xl shadow-2xl",
        "w-[320px] transition-[height] duration-200 ease-in-out overflow-hidden",
        minimized ? "h-10" : "h-[450px] max-h-[calc(100vh-80px)]"
      )}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleMinimize(roomId)}
        onKeyDown={(e) => e.key === "Enter" && toggleMinimize(roomId)}
        className={cn(
          "flex items-center gap-2 px-3 h-10 flex-shrink-0 w-full cursor-pointer select-none",
          "hover:bg-gray-50 transition-colors rounded-t-xl",
          minimized && "rounded-b-xl"
        )}
      >
        <div className={cn(
          "h-6 w-6 flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-amber-100 text-amber-700",
          isGroup ? "rounded-md" : "rounded-full"
        )}>
          {isGroup ? <Users className="h-3 w-3" /> : initials}
        </div>

        <span className="text-xs font-semibold truncate flex-1 text-gray-900">{displayName}</span>

        {unread > 0 && minimized && (
          <span className="h-5 min-w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
            {unread > 99 ? "99+" : unread}
          </span>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Open full page"
            onClick={() => router.push(`/bajaj/chat?room=${roomId}`)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            title={minimized ? "Expand" : "Minimize"}
            onClick={() => toggleMinimize(roomId)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => closeChat(roomId)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 min-h-0">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-8">Loading…</div>
            ) : allMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-8">No messages yet. Say hello! 👋</div>
            ) : (
              allMessages.map((msg, idx) => {
                const prev       = allMessages[idx - 1]
                const showSender = isGroup && msg.sender_id !== prev?.sender_id
                return (
                  <MessageItem key={msg.id} message={msg} currentUserId={currentUserId ?? ""} showSenderName={showSender} />
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 px-3 py-2 bg-white">
            <MessageInput roomId={roomId} members={members} currentUserId={currentUserId ?? ""} />
          </div>
        </>
      )}
    </div>
  )
}
