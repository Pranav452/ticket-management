/**
 * GET /api/bajaj/audit-logs?limit=50&offset=0
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp     = req.nextUrl.searchParams;
    const limit  = Math.min(200, parseInt(sp.get("limit") ?? "50", 10));
    const offset = parseInt(sp.get("offset") ?? "0", 10);

    const actorEmail = sp.get("actor_email");
    const action     = sp.get("action");

    const pool    = await getLinksPool();
    const request = pool.request()
      .input("limit",  sql.Int, limit)
      .input("offset", sql.Int, offset);

    const conditions: string[] = [];
    if (actorEmail) { request.input("ae", sql.NVarChar, `%${actorEmail}%`); conditions.push("actor_email LIKE @ae"); }
    if (action)     { request.input("ac", sql.NVarChar, `%${action}%`);     conditions.push("action LIKE @ac"); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const result = await request.query(`
        SELECT id, actor_email, action, target_type, target_id,
               old_value, new_value, created_at
        FROM bajaj_audit_log
        ${where}
        ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    return NextResponse.json(
      result.recordset.map((r) => ({
        ...r,
        actor_id:  r.actor_email,
        old_value: r.old_value ? JSON.parse(r.old_value) : null,
        new_value: r.new_value ? JSON.parse(r.new_value) : null,
      }))
    );
  } catch (err) {
    console.error("[GET /api/bajaj/audit-logs]", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
