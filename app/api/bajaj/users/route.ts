/**
 * GET  /api/bajaj/users
 * POST /api/bajaj/users  { email, full_name }  — request access
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET() {
  try {
    const pool   = await getLinksPool();
    const result = await pool.request().query(
      "SELECT id, email, full_name, status, approved_by, approved_at, created_at FROM bajaj_users ORDER BY created_at DESC"
    );
    return NextResponse.json(
      result.recordset.map((r) => ({ ...r, user_id: r.id }))
    );
  } catch (err) {
    console.error("[GET /api/bajaj/users]", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, full_name } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const pool = await getLinksPool();
    // Upsert — don't create duplicates
    const existing = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT id FROM bajaj_users WHERE email=@email");

    if (existing.recordset.length)
      return NextResponse.json({ error: "User already registered" }, { status: 409 });

    const r = await pool.request()
      .input("email",     sql.NVarChar, email)
      .input("full_name", sql.NVarChar, full_name ?? null)
      .query(`
        INSERT INTO bajaj_users (email, full_name)
        OUTPUT inserted.*
        VALUES (@email, @full_name)
      `);

    return NextResponse.json({ ...r.recordset[0], user_id: r.recordset[0].id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/users]", err);
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 });
  }
}
