/**
 * GET /api/bajaj/audit-logs?limit=50&offset=0&actor_email=&action=
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp     = req.nextUrl.searchParams;
    const limitRaw  = parseInt(sp.get("limit")  ?? "50", 10);
    const offsetRaw = parseInt(sp.get("offset") ?? "0",  10);
    const limit  = Math.min(200, Math.max(1, isNaN(limitRaw)  ? 50 : limitRaw));
    const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

    const actorEmail = sp.get("actor_email");
    const action     = sp.get("action");
    const targetId   = sp.get("target_id");

    const pool    = await getLinksPool();
    const request = pool.request()
      .input("limit",  sql.Int, limit)
      .input("offset", sql.Int, offset);

    const conditions: string[] = [];
    if (actorEmail) { request.input("ae", sql.NVarChar, `%${actorEmail}%`); conditions.push("actor_email LIKE @ae"); }
    if (action)     { request.input("ac", sql.NVarChar, `%${action}%`);     conditions.push("action LIKE @ac"); }
    if (targetId)   { request.input("ti", sql.NVarChar, targetId);           conditions.push("target_id = @ti"); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    // MSSQL 2008 R2 does not support OFFSET/FETCH — use ROW_NUMBER()
    const result = await request.query(`
      SELECT id, actor_email, action, target_type, target_id,
             old_value, new_value, created_at
      FROM (
        SELECT id, actor_email, action, target_type, target_id,
               old_value, new_value, created_at,
               ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
        FROM bajaj_audit_log
        ${where}
      ) AS paged
      WHERE rn > @offset AND rn <= @offset + @limit
      ORDER BY rn
    `);

    return NextResponse.json(
      result.recordset.map((r: Record<string, unknown>) => ({
        id:          r.id,
        actor_id:    r.actor_email,
        actor_email: r.actor_email,
        action:      r.action,
        target_type: r.target_type,
        target_id:   r.target_id,
        created_at:  r.created_at,
        old_value:   r.old_value ? (() => { try { return JSON.parse(r.old_value as string); } catch { return r.old_value; } })() : null,
        new_value:   r.new_value ? (() => { try { return JSON.parse(r.new_value as string); } catch { return r.new_value; } })() : null,
      }))
    );
  } catch (err) {
    console.error("[GET /api/bajaj/audit-logs]", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
