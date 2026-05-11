import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getChatAuthContext } from "@/lib/chat-auth"
import { createClient } from "@/lib/supabase/server"
import { getLinksPool, sql } from "@/lib/db"
import type { SupabaseClient } from "@supabase/supabase-js"

// Fetch user display names from MSSQL bajaj_users by their Supabase auth UIDs.
// bajaj_users.id stores the Supabase UID (NEWID() was used with the UID when the user first logged in).
async function fetchUserProfiles(
  userIds: string[]
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return new Map()

  try {
    const pool = await getLinksPool()
    // Build IN clause — safe because UUIDs match a strict format
    const idList = unique.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
    const result = await pool.request().query(
      `SELECT supabase_uid, full_name, email FROM bajaj_users WHERE supabase_uid IN (${idList})`
    )
    const map = new Map<string, { full_name: string | null; email: string | null }>()
    for (const row of result.recordset ?? []) {
      map.set(row.supabase_uid, { full_name: row.full_name ?? null, email: row.email ?? null })
    }
    return map
  } catch {
    return new Map()
  }
}

async function enrichRoom(
  supabase: SupabaseClient,
  roomId: string,
  base: Record<string, unknown>
) {
  const { data: members } = await supabase
    .from("chat_members")
    .select("room_id, user_id, joined_at")
    .eq("room_id", roomId)

  const profiles = await fetchUserProfiles((members ?? []).map((m) => m.user_id))

  return {
    ...base,
    id: roomId,
    members: (members ?? []).map((m) => ({
      room_id:   m.room_id,
      user_id:   m.user_id,
      joined_at: m.joined_at,
      full_name: profiles.get(m.user_id)?.full_name ?? null,
      email:     profiles.get(m.user_id)?.email ?? null,
    })),
  }
}

// ─── GET /api/chat/rooms ──────────────────────────────────────────────────────
export async function GET() {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = await createClient()

  const { data: memberRows, error: memberErr } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("user_id", auth.userId)

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })
  if (!memberRows || memberRows.length === 0) return NextResponse.json([])

  const roomIds = memberRows.map((r) => r.room_id)

  const [roomsRes, membersRes, messagesRes, unreadRes] = await Promise.all([
    supabase.from("chat_rooms").select("*").in("id", roomIds),
    supabase.from("chat_members").select("room_id, user_id, joined_at").in("room_id", roomIds),
    supabase
      .from("chat_messages")
      .select("id, room_id, sender_id, content, created_at")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_room_unread_counts", {
      p_user_id:  auth.userId,
      p_room_ids: roomIds,
    }),
  ])

  if (roomsRes.error)    return NextResponse.json({ error: roomsRes.error.message },    { status: 500 })
  if (membersRes.error)  return NextResponse.json({ error: membersRes.error.message },  { status: 500 })
  if (messagesRes.error) return NextResponse.json({ error: messagesRes.error.message }, { status: 500 })

  const allUserIds = [
    ...(membersRes.data  ?? []).map((m) => m.user_id),
    ...(messagesRes.data ?? []).map((m) => m.sender_id),
  ]
  const profiles = await fetchUserProfiles(allUserIds)

  // Last message per room
  const lastMessageByRoom = new Map<string, unknown>()
  for (const msg of messagesRes.data ?? []) {
    if (!lastMessageByRoom.has(msg.room_id)) {
      lastMessageByRoom.set(msg.room_id, {
        id: msg.id, room_id: msg.room_id, sender_id: msg.sender_id,
        content: msg.content, created_at: msg.created_at,
        sender_name: profiles.get(msg.sender_id)?.full_name ?? null,
      })
    }
  }

  // Members per room
  const membersByRoom = new Map<string, unknown[]>()
  for (const m of membersRes.data ?? []) {
    if (!membersByRoom.has(m.room_id)) membersByRoom.set(m.room_id, [])
    const p = profiles.get(m.user_id)
    membersByRoom.get(m.room_id)!.push({
      room_id: m.room_id, user_id: m.user_id, joined_at: m.joined_at,
      full_name: p?.full_name ?? null, email: p?.email ?? null,
    })
  }

  // Unread count per room
  const unreadByRoom = new Map<string, number>()
  for (const row of (unreadRes.data ?? []) as { room_id: string; unread_count: number }[]) {
    unreadByRoom.set(row.room_id, Number(row.unread_count))
  }

  const result = (roomsRes.data ?? []).map((room) => ({
    ...room,
    members:      membersByRoom.get(room.id) ?? [],
    last_message: lastMessageByRoom.get(room.id) ?? null,
    unread_count: unreadByRoom.get(room.id) ?? 0,
  }))

  result.sort((a, b) => {
    const tA = (a.last_message as { created_at: string } | null)?.created_at ?? a.created_at
    const tB = (b.last_message as { created_at: string } | null)?.created_at ?? b.created_at
    return new Date(tB).getTime() - new Date(tA).getTime()
  })

  return NextResponse.json(result)
}

// ─── POST /api/chat/rooms ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { type, name, member_ids } = body as {
    type: "direct" | "group"
    name?: string
    member_ids: string[]
  }

  if (!type || !member_ids || !Array.isArray(member_ids)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabase = await createClient()

  if (type === "direct") {
    const otherId = member_ids[0]
    if (!otherId) return NextResponse.json({ error: "member_ids required" }, { status: 400 })

    const { data: myRooms }    = await supabase.from("chat_members").select("room_id").eq("user_id", auth.userId)
    const { data: otherRooms } = await supabase.from("chat_members").select("room_id").eq("user_id", otherId)

    const myRoomIds = new Set((myRooms    ?? []).map((r) => r.room_id))
    const sharedIds = (otherRooms ?? []).map((r) => r.room_id).filter((id) => myRoomIds.has(id))

    if (sharedIds.length > 0) {
      const { data: existing } = await supabase
        .from("chat_rooms").select("*").in("id", sharedIds).eq("type", "direct").limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json(await enrichRoom(supabase, existing[0].id, existing[0] as Record<string, unknown>))
      }
    }
  }

  if (type === "group" && (!name || name.trim() === "")) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 })
  }

  const newRoomId = randomUUID()
  const now       = new Date().toISOString()

  const { error: roomErr } = await supabase
    .from("chat_rooms")
    .insert({ id: newRoomId, type, name: name?.trim() ?? null, created_by: auth.userId, created_at: now })

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })

  const allMemberIds  = [...new Set([auth.userId, ...member_ids])]
  const { error: insertErr } = await supabase
    .from("chat_members")
    .insert(allMemberIds.map((uid) => ({ room_id: newRoomId, user_id: uid, joined_at: now })))

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json(await enrichRoom(supabase, newRoomId, {
    id: newRoomId, type, name: name?.trim() ?? null, created_by: auth.userId, created_at: now,
  }))
}
