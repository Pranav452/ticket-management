import { NextResponse } from "next/server"
import { getChatAuthContext } from "@/lib/chat-auth"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/chat/users — returns approved bajaj_users for chat directory
export async function GET() {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("bajaj_users")
      .select("supabase_uid, email, full_name, role, department")
      .eq("status", "approved")
      .not("supabase_uid", "is", null)
      .order("full_name")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return supabase_uid as "id" so it matches auth.users(id) for chat_members FK
    return NextResponse.json(
      (data ?? []).map((u) => ({
        id:         u.supabase_uid,
        full_name:  u.full_name,
        email:      u.email,
        role:       u.role,
        department: u.department,
      }))
    )
  } catch (err) {
    console.error("[GET /api/chat/users]", err)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
