import { NextResponse } from "next/server"
import { getChatAuthContext } from "@/lib/chat-auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function getSenderNames(senderIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(senderIds)].filter(Boolean)
  if (unique.length === 0) return new Map()
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from("bajaj_users")
      .select("supabase_uid, full_name")
      .in("supabase_uid", unique)

    const map = new Map<string, string>()
    for (const row of data ?? []) {
      if (row.supabase_uid) map.set(row.supabase_uid, row.full_name ?? "")
    }
    return map
  } catch {
    return new Map()
  }
}

// ─── GET /api/chat/rooms/[id]/messages ───────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: roomId } = await params
  const url    = new URL(request.url)
  const cursor = url.searchParams.get("cursor")
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100)

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", auth.userId)
    .single()

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let query = supabase
    .from("chat_messages")
    .select("id, room_id, sender_id, content, mentions, enquiry_refs, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows    = data ?? []
  const hasMore = rows.length > limit
  const slice   = rows.slice(0, limit)

  const nameMap = await getSenderNames(slice.map((m) => m.sender_id))

  const messages = slice.map((msg) => ({
    id:           msg.id,
    room_id:      msg.room_id,
    sender_id:    msg.sender_id,
    content:      msg.content,
    mentions:     msg.mentions,
    enquiry_refs: msg.enquiry_refs,
    created_at:   msg.created_at,
    sender_name:  nameMap.get(msg.sender_id) ?? null,
  }))

  const nextCursor = hasMore ? messages[messages.length - 1].created_at : null

  return NextResponse.json({ messages, nextCursor })
}

// ─── POST /api/chat/rooms/[id]/messages ──────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: roomId } = await params
  const body = await request.json()
  const { content, mentions = [], enquiry_refs = [] } = body as {
    content: string
    mentions: string[]
    enquiry_refs: string[]
  }

  if (!content || content.trim() === "") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", auth.userId)
    .single()

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: msg, error: insertErr } = await supabase
    .from("chat_messages")
    .insert({
      room_id:      roomId,
      sender_id:    auth.userId,
      content:      content.trim(),
      mentions,
      enquiry_refs,
    })
    .select("id, room_id, sender_id, content, mentions, enquiry_refs, created_at")
    .single()

  if (insertErr || !msg) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to send" }, { status: 500 })
  }

  const nameMap = await getSenderNames([auth.userId])

  return NextResponse.json({ ...msg, sender_name: nameMap.get(auth.userId) ?? null })
}
