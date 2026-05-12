import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface DockItem {
  roomId: string
  minimized: boolean
}

interface ChatDockStore {
  items: DockItem[]
  openChat:       (roomId: string) => void
  closeChat:      (roomId: string) => void
  toggleMinimize: (roomId: string) => void
}

export const useChatDock = create<ChatDockStore>()(
  persist(
    (set) => ({
      items: [],

      openChat: (roomId) =>
        set((s) => {
          const exists = s.items.some((i) => i.roomId === roomId)
          if (exists) {
            return {
              items: [
                ...s.items.filter((i) => i.roomId !== roomId),
                { roomId, minimized: false },
              ],
            }
          }
          return { items: [...s.items, { roomId, minimized: false }] }
        }),

      closeChat: (roomId) =>
        set((s) => ({ items: s.items.filter((i) => i.roomId !== roomId) })),

      toggleMinimize: (roomId) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.roomId === roomId ? { ...i, minimized: !i.minimized } : i
          ),
        })),
    }),
    { name: "bajaj-chat-dock-v1" }
  )
)
