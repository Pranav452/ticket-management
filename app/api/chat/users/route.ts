import { NextResponse } from "next/server"
import { getChatAuthContext } from "@/lib/chat-auth"
import { getLinksPool, sql } from "@/lib/db"

// GET /api/chat/users — returns approved bajaj_users for chat directory
export async function GET() {
  const auth = await getChatAuthContext()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const pool = await getLinksPool()
    const result = await pool.request().query(`
      SELECT supabase_uid, email, full_name, role, department
      FROM bajaj_users
      WHERE status = 'approved'
        AND supabase_uid IS NOT NULL
      ORDER BY full_name
    `)
    // Return supabase_uid as "id" so it matches auth.users(id) for chat_members FK
    return NextResponse.json(
      (result.recordset ?? []).map((u: Record<string, string>) => ({
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
