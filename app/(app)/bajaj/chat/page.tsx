import { Suspense } from "react"
import { ChatViewWrapper } from "@/components/chat/ChatViewWrapper"

// Full-height chat page — AppLayout provides `flex min-h-0 flex-1 flex-col overflow-hidden`
export default function ChatPage() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <Suspense>
        <ChatViewWrapper />
      </Suspense>
    </div>
  )
}
