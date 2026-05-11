/**
 * PATCH /api/bajaj/users/[id]
 *   { action: "approve"|"reject", approved_by }
 *   OR { role: "superadmin"|"admin"|"operator"|"viewer" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getActorEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await sb.auth.getUser();
    return user?.email ?? null;
  } catch { return null; }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const pool = await getLinksPool();

    // Role update branch
    if ("role" in body) {
      const validRoles = ["superadmin", "admin", "operator", "viewer"];
      if (!validRoles.includes(body.role))
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });

      await pool.request()
        .input("id",   sql.VarChar, id)
        .input("role", sql.VarChar, body.role)
        .query("UPDATE bajaj_users SET role=@role WHERE id=@id");

      return NextResponse.json({ success: true });
    }

    // Approve / reject branch
    const actorEmail = await getActorEmail();
    const { action, approved_by } = body;
    if (!["approve", "reject"].includes(action))
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

    const status = action === "approve" ? "approved" : "rejected";

    await pool.request()
      .input("id",   sql.VarChar,  id)
      .input("st",   sql.VarChar,  status)
      .input("by",   sql.NVarChar, approved_by ?? "system")
      .input("at",   sql.DateTime, new Date())
      .query(
        "UPDATE bajaj_users SET status=@st, approved_by=@by, approved_at=@at WHERE id=@id"
      );

    // Audit
    try {
      const auditAction = action === "approve" ? "approved_user" : "rejected_user";
      await pool.request()
        .input("actor_email", sql.NVarChar, actorEmail ?? approved_by ?? "system")
        .input("action",      sql.NVarChar, auditAction)
        .input("tid",         sql.NVarChar, id)
        .input("nv",          sql.NVarChar, JSON.stringify({ status, by: approved_by }))
        .query(
          "INSERT INTO bajaj_audit_log (actor_email,action,target_type,target_id,new_value) VALUES (@actor_email,@action,'bajaj_user',@tid,@nv)"
        );
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/users/[id]]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
