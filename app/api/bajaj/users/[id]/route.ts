/**
 * PATCH /api/bajaj/users/[id]  { action: "approve"|"reject", approved_by }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action, approved_by } = await req.json();

    if (!["approve", "reject"].includes(action))
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

    const status = action === "approve" ? "approved" : "rejected";
    const pool   = await getLinksPool();

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
      await pool.request()
        .input("action", sql.NVarChar, `user.${action}`)
        .input("tid",    sql.NVarChar, id)
        .input("nv",     sql.NVarChar, JSON.stringify({ status }))
        .query(
          "INSERT INTO bajaj_audit_log (action,target_type,target_id,new_value) VALUES (@action,'bajaj_user',@tid,@nv)"
        );
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/users/[id]]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
