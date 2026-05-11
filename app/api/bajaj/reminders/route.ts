/**
 * GET  /api/bajaj/reminders?work_order_id=<pkid>&module_id=<id>
 * POST /api/bajaj/reminders
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

function rowToReminder(r: Record<string, unknown>) {
  return {
    id:                  r.id,
    work_order_id:       String(r.work_order_pkid),
    module_id:           r.module_id,
    work_order_summary:  r.work_order_summary,
    created_by:          r.created_by ?? null,
    created_at:          r.created_at,
    due_at:              r.due_at,
    days_offset:         r.days_offset,
    recipients:          (() => {
      if (!r.recipients) return [];
      if (Array.isArray(r.recipients)) return r.recipients;
      try { return JSON.parse(String(r.recipients)); } catch { return []; }
    })(),
    message:             r.message,
    status:              r.status,
    sent_at:             r.sent_at ?? null,
    done_at:             r.done_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const woId     = sp.get("work_order_id");
    const moduleId = sp.get("module_id");

    const pool    = await getLinksPool();
    const request = pool.request();
    const conditions: string[] = [];

    if (woId)     { request.input("woid", sql.Int,    parseInt(woId, 10)); conditions.push("work_order_pkid=@woid"); }
    if (moduleId) { request.input("mid",  sql.VarChar, moduleId);           conditions.push("module_id=@mid"); }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const result = await request.query(
      `SELECT * FROM bajaj_reminders ${where} ORDER BY due_at ASC`
    );

    return NextResponse.json(result.recordset.map(rowToReminder));
  } catch (err) {
    console.error("[GET /api/bajaj/reminders]", err);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      work_order_id, module_id, work_order_summary = "",
      created_by = null, due_at, days_offset = 0,
      recipients = [], message = "",
    } = body;

    if (!work_order_id || !module_id || !due_at)
      return NextResponse.json({ error: "work_order_id, module_id, due_at required" }, { status: 400 });

    const pool = await getLinksPool();
    const r = await pool.request()
      .input("woid",    sql.Int,      parseInt(work_order_id, 10))
      .input("mid",     sql.VarChar,  module_id)
      .input("summary", sql.NVarChar, work_order_summary)
      .input("by",      sql.NVarChar, created_by)
      .input("due",     sql.DateTime, new Date(due_at))
      .input("offset",  sql.Int,      days_offset)
      .input("recips",  sql.NVarChar, JSON.stringify(recipients))
      .input("msg",     sql.NVarChar, message)
      .query(`
        INSERT INTO bajaj_reminders
          (work_order_pkid,module_id,work_order_summary,created_by,due_at,days_offset,recipients,message)
        OUTPUT inserted.*
        VALUES (@woid,@mid,@summary,@by,@due,@offset,@recips,@msg)
      `);

    return NextResponse.json(rowToReminder(r.recordset[0]), { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/reminders]", err);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
