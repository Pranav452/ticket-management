"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatRoom } from "@/components/chat/ChatRoom"
import { useChatGlobalRealtime } from "@/components/chat/useChatGlobalRealtime"

interface Props {
  initialRoomId?: string | null
}

export function ChatView({ initialRoomId = null }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId)
  useChatGlobalRealtime(selectedRoomId ? [selectedRoomId] : [])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white">
      <ChatSidebar selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedRoomId
          ? <ChatRoom key={selectedRoomId} roomId={selectedRoomId} />
          : <EmptyState />
        }
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
      <div className="h-20 w-20 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
        <MessageSquare className="h-9 w-9 text-amber-400" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-gray-800">Select a conversation</p>
        <p className="text-[13px] text-gray-400 mt-1">Choose a chat from the left or start a new one</p>
      </div>
    </div>
  )
}
