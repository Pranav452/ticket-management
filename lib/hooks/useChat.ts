"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query"
import type { ChatRoom, ChatMessage, ChatUser } from "@/lib/types/chat"

export const chatKeys = {
  rooms:    () => ["chat", "rooms"] as const,
  messages: (roomId: string) => ["chat", "messages", roomId] as const,
  users:    () => ["chat", "users"] as const,
}

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const b = await res.json(); if (b?.error) msg = b.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res
}

// ─── useRooms ─────────────────────────────────────────────────────────────────
export function useRooms() {
  return useQuery({
    queryKey: chatKeys.rooms(),
    queryFn: async (): Promise<ChatRoom[]> => {
      const res = await apiFetch("/api/chat/rooms")
      return res.json()
    },
    refetchInterval: 15_000,
  })
}

// ─── useMessages ─────────────────────────────────────────────────────────────
export function useMessages(roomId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(roomId ?? ""),
    enabled: !!roomId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> => {
      const url = new URL(`/api/chat/rooms/${roomId}/messages`, window.location.origin)
      if (pageParam) url.searchParams.set("cursor", pageParam)
      url.searchParams.set("limit", "50")
      const res = await apiFetch(url.toString())
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

// ─── useUsers ─────────────────────────────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: chatKeys.users(),
    queryFn: async (): Promise<ChatUser[]> => {
      const res = await apiFetch("/api/chat/users")
      return res.json()
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ─── useSendMessage ───────────────────────────────────────────────────────────
export function useSendMessage(roomId: string, currentUserId: string | null) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      content: string
      mentions: string[]
      enquiry_refs: string[]
    }): Promise<ChatMessage> => {
      const res = await apiFetch(`/api/chat/rooms/${roomId}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      return res.json()
    },

    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: chatKeys.messages(roomId) })

      const optimistic: ChatMessage = {
        id:           `optimistic-${Date.now()}`,
        room_id:      roomId,
        sender_id:    currentUserId ?? "__me__",
        content:      payload.content,
        mentions:     payload.mentions,
        enquiry_refs: payload.enquiry_refs,
        created_at:   new Date().toISOString(),
        sender_name:  undefined,
      }

      qc.setQueryData(chatKeys.messages(roomId), (old: unknown) => {
        const data = old as {
          pages: { messages: ChatMessage[]; nextCursor: string | null }[]
          pageParams: unknown[]
        } | undefined
        if (!data) return data
        const firstPage = data.pages[0] ?? { messages: [], nextCursor: null }
        return {
          ...data,
          pages: [
            { ...firstPage, messages: [optimistic, ...firstPage.messages] },
            ...data.pages.slice(1),
          ],
        }
      })
    },

    onError: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(roomId) })
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: chatKeys.rooms() })
    },
  })
}

// ─── useCreateRoom ────────────────────────────────────────────────────────────
export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      type: "direct" | "group"
      name?: string
      member_ids: string[]
    }): Promise<ChatRoom> => {
      const res = await apiFetch("/api/chat/rooms", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: chatKeys.rooms() }) },
  })
}

// ─── useMarkAsRead ────────────────────────────────────────────────────────────
export function useMarkAsRead(roomId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!roomId) return
      await fetch(`/api/chat/rooms/${roomId}/read`, { method: "PATCH" })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.rooms() })
    },
  })
}
