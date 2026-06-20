"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare } from "lucide-react"
import { useChatDock } from "@/lib/store/chatDock"
import { useRooms } from "@/lib/hooks/useChat"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { ChatDockPanel } from "@/components/chat/ChatDockPanel"
import { useChatGlobalRealtime } from "@/components/chat/useChatGlobalRealtime"
import { cn } from "@/lib/utils"

function useMaxPanels() {
  const [max, setMax] = useState(0)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      if      (w < 768)  setMax(0)
      else if (w < 1024) setMax(1)
      else if (w < 1280) setMax(2)
      else if (w < 1600) setMax(3)
      else               setMax(4)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return max
}

function OverflowChip({ roomIds }: { roomIds: string[] }) {
  const [open, setOpen]      = useState(false)
  const ref                  = useRef<HTMLDivElement>(null)
  const { openChat }         = useChatDock()
  const { data: rooms = [] } = useRooms()
  const currentUser          = useCurrentUser()
  const currentUserId        = currentUser?.id ?? null

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div ref={ref} className="pointer-events-auto relative self-end mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl border border-gray-200 dark:border-white/10 shadow-lg bg-white dark:bg-[#0d0d0d] text-xs font-semibold text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b-0"
      >
        <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
        +{roomIds.length} more
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-48 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {roomIds.map((rid) => {
            const room = rooms.find((r) => r.id === rid)
            if (!room) return null
            let label = room.name ?? "Chat"
            if (room.type === "direct" && currentUserId) {
              const other = (room.members ?? []).find((m) => m.user_id !== currentUserId)
              if (other?.full_name) label = other.full_name
            }
            return (
              <button
                key={rid}
                type="button"
                onClick={() => { openChat(rid); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors truncate"
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ChatDock() {
  const { items } = useChatDock()
  const maxPanels = useMaxPanels()

  // Global realtime for dock — active room = any non-minimized panel
  const activeRoomIds = items.filter((i) => !i.minimized).map((i) => i.roomId)
  useChatGlobalRealtime(activeRoomIds)

  if (maxPanels === 0 || items.length === 0) return null

  const visibleItems = items.slice(-maxPanels)
  const overflowIds  = items.slice(0, items.length - maxPanels).map((i) => i.roomId)

  return (
    <div className="fixed bottom-0 right-4 flex items-end gap-2 z-50 pointer-events-none">
      {overflowIds.length > 0 && <OverflowChip roomIds={overflowIds} />}
      {visibleItems.map((item) => (
        <ChatDockPanel key={item.roomId} roomId={item.roomId} minimized={item.minimized} />
      ))}
    </div>
  )
}
