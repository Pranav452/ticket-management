"use client"

import { useSearchParams } from "next/navigation"
import { ChatView } from "@/components/chat/ChatView"

export function ChatViewWrapper() {
  const params = useSearchParams()
  const roomId = params.get("room")
  return <ChatView initialRoomId={roomId} />
}
