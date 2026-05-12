/**
 * POST /api/bajaj/auth/login
 * Body: { email, password }
 *
 * Looks up user in bajaj_users. If status=approved, returns user+role.
 * Password is stored as a simple hash in bajaj_users.password_hash.
 * For test users we accept password "Links@2026" by default.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string };
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });

    const pool = await getLinksPool();
    const result = await pool.request()
      .input("email", sql.NVarChar, email.trim().toLowerCase())
      .query(`
        SELECT id, email, full_name, status, role, department, password_hash
        FROM bajaj_users
        WHERE LOWER(email) = @email
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "No account found. Request access first." }, { status: 404 });
    }

    const user = result.recordset[0];

    // Password check — stored as plain text for now (dev mode).
    // In production replace with bcrypt comparison.
    const storedPwd: string | null = user.password_hash;
    const DEFAULT_TEST_PASSWORD = "Links@2026";
    const passwordOk = !storedPwd
      ? password === DEFAULT_TEST_PASSWORD   // test users: accept default password
      : password === storedPwd;              // real users: exact match (upgrade to hash later)

    if (!passwordOk) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    if (user.status === "pending") {
      return NextResponse.json({ error: "Your account is pending admin approval." }, { status: 403 });
    }
    if (user.status === "rejected") {
      return NextResponse.json({ error: "Your access request was rejected. Contact admin." }, { status: 403 });
    }

    return NextResponse.json({
      id:         user.id,
      email:      user.email,
      full_name:  user.full_name,
      role:       user.role ?? "viewer",
      department: user.department ?? null,
      status:     user.status,
    });
  } catch (err) {
    console.error("[POST /api/bajaj/auth/login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
