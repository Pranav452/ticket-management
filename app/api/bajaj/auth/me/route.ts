/**
 * GET /api/bajaj/auth/me
 *
 * Requires a valid Supabase session cookie.
 * Looks up bajaj_users by email → returns role/department.
 * If user not found in bajaj_users → creates a pending entry and returns { status: "pending" }.
 *
 * Also stamps supabase_uid on every login so the chat module can link
 * auth.users(id) → bajaj_users.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getLinksPool();
    const result = await pool.request()
      .input("email", sql.NVarChar, user.email!.trim().toLowerCase())
      .query(`
        SELECT id, email, full_name, status, role, department, supabase_uid
        FROM bajaj_users
        WHERE LOWER(email) = @email
      `);

    if (result.recordset.length === 0) {
      // Create pending entry — store Supabase UID from the start
      await pool.request()
        .input("email",        sql.NVarChar,    user.email!)
        .input("full_name",    sql.NVarChar,    user.user_metadata?.full_name ?? null)
        .input("supabase_uid", sql.NVarChar, user.id)
        .query(`
          INSERT INTO bajaj_users (id, email, full_name, status, role, supabase_uid)
          VALUES (NEWID(), @email, @full_name, 'pending', 'viewer', @supabase_uid)
        `);
      return NextResponse.json({ status: "pending" }, { status: 200 });
    }

    const bajajUser = result.recordset[0];

    // Stamp supabase_uid if missing (existing users logging in for first time after migration)
    if (!bajajUser.supabase_uid) {
      await pool.request()
        .input("email",        sql.NVarChar,    user.email!.trim().toLowerCase())
        .input("supabase_uid", sql.NVarChar, user.id)
        .query(`UPDATE bajaj_users SET supabase_uid = @supabase_uid WHERE LOWER(email) = @email`);
    }

    if (bajajUser.status === "pending") {
      return NextResponse.json({ status: "pending" }, { status: 200 });
    }
    if (bajajUser.status === "rejected") {
      return NextResponse.json({ error: "Access rejected." }, { status: 403 });
    }

    return NextResponse.json({
      id:           bajajUser.id,
      supabase_uid: bajajUser.supabase_uid ?? user.id,
      email:        bajajUser.email,
      full_name:    bajajUser.full_name ?? null,
      role:         bajajUser.role ?? "viewer",
      department:   bajajUser.department ?? null,
      status:       bajajUser.status,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/auth/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
