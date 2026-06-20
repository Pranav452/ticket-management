"use client"

import { useEffect, useRef, useCallback } from "react"
import * as ScrollArea from "@radix-ui/react-scroll-area"
import { Loader2, Users, User, MoreHorizontal } from "lucide-react"
import { useMessages, useRooms, useMarkAsRead } from "@/lib/hooks/useChat"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { MessageItem } from "@/components/chat/MessageItem"
import { MessageInput } from "@/components/chat/MessageInput"
import type { ChatMember, ChatMessage } from "@/lib/types/chat"

interface Props { roomId: string }

export function ChatRoom({ roomId }: Props) {
  const { data: rooms = [] }   = useRooms()
  const currentUser            = useCurrentUser()
  const currentUserId          = currentUser?.id ?? null
  const markAsRead             = useMarkAsRead(roomId)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const viewportRef    = useRef<HTMLDivElement>(null)
  const isAtBottomRef  = useRef(true)

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useMessages(roomId)

  const room    = rooms.find((r) => r.id === roomId)
  const members: ChatMember[] = room?.members ?? []
  const isGroup = room?.type === "group"

  const allMessages: ChatMessage[] = []
  if (data?.pages) {
    const pages = [...data.pages].reverse()
    for (const page of pages) allMessages.push(...[...page.messages].reverse())
  }

  useEffect(() => {
    markAsRead.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, allMessages.length])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onScroll() {
      isAtBottomRef.current = el!.scrollHeight - el!.scrollTop - el!.clientHeight < 60
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const latestId = allMessages[allMessages.length - 1]?.id
  useEffect(() => {
    if (isAtBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [latestId])

  useEffect(() => {
    if (!isLoading) bottomRef.current?.scrollIntoView()
  }, [isLoading])

  const handleSentinel = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        const viewport = viewportRef.current
        const prevH = viewport?.scrollHeight ?? 0
        fetchNextPage().then(() => {
          requestAnimationFrame(() => {
            if (viewport) viewport.scrollTop += viewport.scrollHeight - prevH
          })
        })
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  )

  useEffect(() => {
    const el = topSentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(handleSentinel, { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [handleSentinel])

  let roomDisplayName = room?.name ?? "Chat"
  let roomSubtitle = ""
  if (room?.type === "direct" && currentUserId) {
    const other = members.find((m) => m.user_id !== currentUserId)
    if (other?.full_name) { roomDisplayName = other.full_name; roomSubtitle = other.email ?? "" }
  } else if (room?.type === "group") {
    roomSubtitle = `${members.length} member${members.length !== 1 ? "s" : ""}`
  }

  const initials = roomDisplayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  const avatarColors = ["bg-amber-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500"]
  const avatarColor = isGroup ? "bg-amber-500" : avatarColors[roomDisplayName.charCodeAt(0) % avatarColors.length]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/6 flex-shrink-0 bg-white dark:bg-[#111]">
        <div className={`h-9 w-9 rounded-${isGroup ? "xl" : "full"} ${avatarColor} flex items-center justify-center flex-shrink-0 text-white font-bold text-sm`}>
          {isGroup ? <Users className="h-4 w-4" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 dark:text-white/90 leading-tight">{roomDisplayName}</p>
          {roomSubtitle && <p className="text-[11px] text-gray-400 dark:text-white/40 leading-tight">{roomSubtitle}</p>}
        </div>
        <button className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/8 text-gray-400 dark:text-white/40 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea.Root className="flex-1 overflow-hidden bg-[#FAFAFA] dark:bg-[#0d0d0d]">
        <ScrollArea.Viewport ref={viewportRef} className="h-full w-full">
          <div className="flex flex-col gap-2 px-5 py-5 min-h-full">
            <div ref={topSentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-300 dark:text-white/30" />
              </div>
            )}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300 dark:text-white/30" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center">
                  <span className="text-2xl">👋</span>
                </div>
                <p className="text-[13px] text-gray-400 dark:text-white/40">No messages yet — say something!</p>
              </div>
            ) : (
              allMessages.map((msg, idx) => {
                const prev       = allMessages[idx - 1]
                const showSender = isGroup && msg.sender_id !== prev?.sender_id
                return (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    currentUserId={currentUserId ?? ""}
                    showSenderName={showSender}
                  />
                )
              })
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="flex select-none touch-none p-0.5 w-2">
          <ScrollArea.Thumb className="flex-1 bg-gray-200 dark:bg-white/20 rounded-full" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/6 bg-white dark:bg-[#111] px-5 py-4">
        <MessageInput roomId={roomId} members={members} currentUserId={currentUserId ?? ""} />
      </div>
    </div>
  )
}
