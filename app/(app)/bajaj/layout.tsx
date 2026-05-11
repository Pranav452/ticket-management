import { ChatDock } from "@/components/chat/ChatDock"

export default function BajajLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatDock />
    </>
  )
}
