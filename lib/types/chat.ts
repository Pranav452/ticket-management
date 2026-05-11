export interface ChatRoom {
  id: string
  type: "direct" | "group"
  name: string | null
  created_by: string
  created_at: string
  last_message?: ChatMessage | null
  unread_count?: number
  members?: ChatMember[]
}

export interface ChatMember {
  room_id: string
  user_id: string
  joined_at: string
  full_name?: string
  email?: string
}

export interface ChatMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  mentions: string[]
  enquiry_refs: string[]
  created_at: string
  sender_name?: string
}

export interface ChatUser {
  id: string
  full_name: string
  email: string
  role: string
  department?: string
}
