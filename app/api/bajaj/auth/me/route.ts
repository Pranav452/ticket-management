/**
 * GET /api/bajaj/auth/me
 *
 * Requires a valid Supabase session cookie.
 * Looks up bajaj_users by email → returns role/department.
 * If user not found in bajaj_users → creates a pending entry and returns { status: "pending" }.
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
        SELECT id, email, full_name, status, role, department
        FROM bajaj_users
        WHERE LOWER(email) = @email
      `);

    if (result.recordset.length === 0) {
      // Create pending entry
      await pool.request()
        .input("email", sql.NVarChar, user.email!)
        .input("full_name", sql.NVarChar, user.user_metadata?.full_name ?? null)
        .query(`
          INSERT INTO bajaj_users (id, email, full_name, status, role)
          VALUES (NEWID(), @email, @full_name, 'pending', 'viewer')
        `);
      return NextResponse.json({ status: "pending" }, { status: 200 });
    }

    const bajajUser = result.recordset[0];

    if (bajajUser.status === "pending") {
      return NextResponse.json({ status: "pending" }, { status: 200 });
    }
    if (bajajUser.status === "rejected") {
      return NextResponse.json({ error: "Access rejected." }, { status: 403 });
    }

    return NextResponse.json({
      id:         bajajUser.id,
      email:      bajajUser.email,
      full_name:  bajajUser.full_name ?? null,
      role:       bajajUser.role ?? "viewer",
      department: bajajUser.department ?? null,
      status:     bajajUser.status,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/auth/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
