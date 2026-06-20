"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X, Users, Loader2 } from "lucide-react"
import { useState } from "react"
import { useUsers, useCreateRoom } from "@/lib/hooks/useChat"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { cn } from "@/lib/utils"
import type { ChatRoom } from "@/lib/types/chat"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (room: ChatRoom) => void
}

export function GroupChatModal({ open, onOpenChange, onCreated }: Props) {
  const [groupName,   setGroupName]   = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const currentUser = useCurrentUser()
  const { data: allUsers = [], isLoading } = useUsers()
  const createRoom = useCreateRoom()

  const users = allUsers.filter((u) => u.id !== currentUser?.id)

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!groupName.trim() || selectedIds.size === 0) return
    try {
      const room = await createRoom.mutateAsync({
        type: "group", name: groupName.trim(), member_ids: [...selectedIds],
      })
      setGroupName(""); setSelectedIds(new Set())
      onCreated(room)
    } catch { /* handled by createRoom.error */ }
  }

  function handleOpenChange(v: boolean) {
    if (!v) { setGroupName(""); setSelectedIds(new Set()) }
    onOpenChange(v)
  }

  const canCreate = groupName.trim().length > 0 && selectedIds.size > 0

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" />
              <Dialog.Title className="font-semibold text-sm text-gray-900 dark:text-white">New Group Chat</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 rounded-md p-1 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Group Name</label>
              <input
                type="text"
                placeholder="e.g. Logistics Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-sm text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide">Add Members</label>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-white/40" />
                  </div>
                ) : (
                  users.map((user) => {
                    const checked  = selectedIds.has(user.id)
                    const initials = user.full_name
                      ? user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                      : user.email[0].toUpperCase()

                    return (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          "border-b border-gray-100 dark:border-white/[0.06] last:border-0",
                          checked ? "bg-amber-50 dark:bg-amber-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                          checked ? "bg-amber-500 border-amber-500" : "border-gray-300 dark:border-white/20"
                        )}>
                          {checked && (
                            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                          checked ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70"
                        )}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white/90 truncate">{user.full_name || user.email}</p>
                          {user.department && <p className="text-xs text-gray-400 dark:text-white/40">{user.department}</p>}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06]">
            {createRoom.error && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded px-2 py-1.5">{createRoom.error.message}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-white/40">
                {selectedIds.size > 0
                  ? `${selectedIds.size} member${selectedIds.size > 1 ? "s" : ""} selected`
                  : "Select at least 1 member"}
              </span>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="h-8 px-3 text-sm rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  disabled={!canCreate || createRoom.isPending}
                  onClick={handleCreate}
                  className="h-8 px-4 text-sm rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  {createRoom.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
