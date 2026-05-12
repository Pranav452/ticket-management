"use client"

import { useState } from "react"
import { Users, Plus, ExternalLink, Search } from "lucide-react"
import { useUsers, useRooms, useCreateRoom } from "@/lib/hooks/useChat"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { GroupChatModal } from "@/components/chat/GroupChatModal"
import { useChatDock } from "@/lib/store/chatDock"
import { cn } from "@/lib/utils"
import type { ChatRoom, ChatUser } from "@/lib/types/chat"

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return "now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr  < 24) return `${hr}h`
  return `${Math.floor(hr / 24)}d`
}

function Avatar({ name, size = "md", active = false }: { name: string; size?: "sm" | "md"; active?: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  const colors = [
    "bg-amber-500 text-white",
    "bg-blue-500 text-white",
    "bg-emerald-500 text-white",
    "bg-violet-500 text-white",
    "bg-rose-500 text-white",
    "bg-cyan-500 text-white",
  ]
  const color = active ? "bg-amber-500 text-white" : colors[name.charCodeAt(0) % colors.length]
  const sz = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs"

  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold flex-shrink-0", sz, color)}>
      {initials}
    </div>
  )
}

interface Props {
  selectedRoomId: string | null
  onSelectRoom:   (roomId: string) => void
}

export function ChatSidebar({ selectedRoomId, onSelectRoom }: Props) {
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { openChat } = useChatDock()

  const currentUser                              = useCurrentUser()
  const { data: allUsers = [], isLoading: ul  } = useUsers()
  const { data: rooms = [],    isLoading: rl  } = useRooms()
  const createRoom = useCreateRoom()

  const usersWithDm = new Set(
    rooms.filter((r) => r.type === "direct").flatMap((r) => (r.members ?? []).map((m) => m.user_id))
  )
  const usersForNew = allUsers.filter(
    (u) => u.id !== currentUser?.id && !usersWithDm.has(u.id) &&
    (search === "" || (u.full_name ?? u.email).toLowerCase().includes(search.toLowerCase()))
  )

  const sortedRooms = [...rooms]
    .filter((r) => {
      // Exclude self-chat: DM where there's no "other" member (user messaged themselves)
      if (r.type === "direct" && currentUser?.id) {
        const other = (r.members ?? []).find((m) => m.user_id !== currentUser.id)
        if (!other) return false
      }
      if (!search) return true
      const name = r.type === "direct"
        ? (r.members ?? []).find((m) => m.user_id !== currentUser?.id)?.full_name ?? r.name ?? ""
        : r.name ?? ""
      return name.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      const tA = (a.last_message as { created_at: string } | null)?.created_at ?? a.created_at
      const tB = (b.last_message as { created_at: string } | null)?.created_at ?? b.created_at
      return new Date(tB).getTime() - new Date(tA).getTime()
    })

  async function handleUserClick(user: ChatUser) {
    const existing = rooms.find((r) => r.type === "direct" && r.members?.some((m) => m.user_id === user.id))
    if (existing) { onSelectRoom(existing.id); return }
    try {
      const room = await createRoom.mutateAsync({ type: "direct", member_ids: [user.id] })
      onSelectRoom(room.id)
    } catch (err) { console.error("[ChatSidebar] create DM:", err) }
  }

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0)

  return (
    <>
      <div className="w-72 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-[#FAFAFA] dark:bg-[#111] border-r border-[#EBEBEB] dark:border-white/6">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-gray-900 dark:text-white/90">Messages</span>
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setGroupModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              title="New group chat"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] pl-8 pr-3 text-[12px] text-gray-700 dark:text-white/80 placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-500/20 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Active conversations */}
          {(rl || sortedRooms.length > 0) && (
            <div className="px-2 mb-2">
              {sortedRooms.length > 0 && (
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">Conversations</p>
              )}
              {rl ? <LoadingRows count={3} /> : sortedRooms.map((room) => (
                <ConversationRow
                  key={room.id}
                  room={room}
                  currentUserId={currentUser?.id ?? null}
                  isActive={selectedRoomId === room.id}
                  onClick={() => onSelectRoom(room.id)}
                  onPopOut={() => openChat(room.id)}
                />
              ))}
            </div>
          )}

          {/* New conversations */}
          {(ul || usersForNew.length > 0) && (
            <div className="px-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">
                {sortedRooms.length > 0 ? "Start New" : "People"}
              </p>
              {ul ? <LoadingRows count={4} /> : usersForNew.map((user) => (
                <NewUserRow key={user.id} user={user} onClick={() => handleUserClick(user)} />
              ))}
            </div>
          )}

          {!rl && !ul && sortedRooms.length === 0 && usersForNew.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-white/50">No users found</p>
            </div>
          )}
        </div>
      </div>

      <GroupChatModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        onCreated={(room) => { setGroupModalOpen(false); onSelectRoom(room.id) }}
      />
    </>
  )
}

function ConversationRow({
  room, currentUserId, isActive, onClick, onPopOut,
}: {
  room: ChatRoom; currentUserId: string | null; isActive: boolean
  onClick: () => void; onPopOut: () => void
}) {
  const unread = room.unread_count ?? 0

  let displayName = room.name ?? "Group"
  let avatarName  = room.name ?? "G"
  let isGroup     = room.type === "group"

  if (room.type === "direct" && currentUserId) {
    const other = (room.members ?? []).find((m) => m.user_id !== currentUserId)
    if (other?.full_name) {
      displayName = other.full_name
      avatarName  = other.full_name
      isGroup     = false
    }
  }

  const lastMsg  = room.last_message as { content: string; created_at: string } | null
  const lastTime = lastMsg?.created_at ? relativeTime(lastMsg.created_at) : ""
  const preview  = lastMsg?.content
    ? lastMsg.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 45)
    : isGroup ? `${room.members?.length ?? 0} members` : ""

  return (
    <div className="relative group/row">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-all",
          isActive ? "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-100 dark:ring-amber-500/20" : "hover:bg-white dark:hover:bg-white/5 hover:shadow-sm"
        )}
      >
        {/* Avatar */}
        {isGroup ? (
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs",
            isActive ? "bg-amber-500 text-white" : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/60"
          )}>
            <Users className="h-4 w-4" />
          </div>
        ) : (
          <Avatar name={avatarName} active={isActive} />
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className={cn(
              "text-[13px] truncate",
              unread > 0 ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-white/80"
            )}>
              {displayName}
            </p>
            {lastTime && (
              <span className={cn(
                "text-[10px] flex-shrink-0",
                unread > 0 ? "text-amber-500 font-semibold" : "text-gray-400"
              )}>
                {lastTime}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <p className={cn(
              "text-[11px] truncate",
              unread > 0 ? "text-gray-700 dark:text-white/70" : "text-gray-400 dark:text-white/40"
            )}>
              {preview}
            </p>
            {unread > 0 && !isActive && (
              <span className="flex-shrink-0 h-4.5 min-w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>

      <button
        type="button"
        title="Pop out"
        onClick={(e) => { e.stopPropagation(); onPopOut() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md opacity-0 group-hover/row:opacity-100 transition-opacity bg-white dark:bg-[#1a1a1a] hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/40 hover:text-amber-600"
      >
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  )
}

function NewUserRow({ user, onClick }: { user: ChatUser; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all hover:bg-white dark:hover:bg-white/5 hover:shadow-sm"
    >
      <Avatar name={user.full_name || user.email} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-white/90 truncate">{user.full_name || user.email}</p>
        <p className="text-[11px] text-gray-400 dark:text-white/40 truncate capitalize">{user.department || user.role}</p>
      </div>
    </button>
  )
}

function LoadingRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 bg-gray-100 dark:bg-white/10 animate-pulse rounded-full" />
            <div className="h-2.5 w-36 bg-gray-100 dark:bg-white/10 animate-pulse rounded-full" />
          </div>
        </div>
      ))}
    </>
  )
}
