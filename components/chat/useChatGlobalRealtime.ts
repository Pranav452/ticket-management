"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { chatKeys } from "@/lib/hooks/useChat"
import type { ChatMessage, ChatRoom, ChatUser } from "@/lib/types/chat"

export function useChatGlobalRealtime(activeRoomIds: string[]) {
  const qc               = useQueryClient()
  const supabaseRef      = useRef(createClient())
  const activeRoomIdsRef = useRef(activeRoomIds)
  useEffect(() => { activeRoomIdsRef.current = activeRoomIds }, [activeRoomIds])

  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel("bajaj-chat-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const newMsg         = payload.new as ChatMessage
          const currentRoomIds = activeRoomIdsRef.current

          const users      = qc.getQueryData<ChatUser[]>(chatKeys.users())
          const senderName = users?.find((u) => u.id === newMsg.sender_id)?.full_name ?? undefined
          const msgWithName: ChatMessage = { ...newMsg, sender_name: senderName }

          // 1. Inject into open room message list
          const isInActiveRoom = currentRoomIds.includes(newMsg.room_id)
          if (isInActiveRoom) {
            qc.setQueryData(chatKeys.messages(newMsg.room_id), (old: unknown) => {
              const data = old as
                | { pages: { messages: ChatMessage[]; nextCursor: string | null }[]; pageParams: unknown[] }
                | undefined
              if (!data?.pages?.length) return data

              const firstPage = data.pages[0]
              const allMsgs   = firstPage.messages

              const optIdx = allMsgs.findIndex(
                (m) => m.id.startsWith("optimistic-") && m.content === newMsg.content
              )

              let newMessages: ChatMessage[]
              if (optIdx !== -1) {
                newMessages = allMsgs.map((m, i) => (i === optIdx ? msgWithName : m))
              } else {
                if (allMsgs.some((m) => m.id === newMsg.id)) return data
                newMessages = [msgWithName, ...allMsgs]
              }

              return {
                ...data,
                pages: [{ ...firstPage, messages: newMessages }, ...data.pages.slice(1)],
              }
            })
          }

          // 2. Update sidebar preview + unread count
          qc.setQueryData(chatKeys.rooms(), (old: unknown) => {
            const rooms = old as ChatRoom[] | undefined
            if (!rooms) {
              qc.invalidateQueries({ queryKey: chatKeys.rooms() })
              return rooms
            }

            const roomExists = rooms.some((r) => r.id === newMsg.room_id)
            if (!roomExists) {
              qc.invalidateQueries({ queryKey: chatKeys.rooms() })
              return rooms
            }

            const isActiveRoom = currentRoomIds.includes(newMsg.room_id)

            const updated = rooms.map((room) => {
              if (room.id !== newMsg.room_id) return room
              return {
                ...room,
                last_message: msgWithName,
                unread_count: isActiveRoom ? 0 : (room.unread_count ?? 0) + 1,
              }
            })

            return [...updated].sort((a, b) => {
              const tA = (a.last_message as { created_at: string } | null)?.created_at ?? a.created_at
              const tB = (b.last_message as { created_at: string } | null)?.created_at ?? b.created_at
              return new Date(tB).getTime() - new Date(tA).getTime()
            })
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
