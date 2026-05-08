/**
 * GET   /api/bajaj/work-orders/[id]  — fetch single work order by PKID
 * PATCH /api/bajaj/work-orders/[id]  — update status_id, assigned_to, column_order
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pkid = parseInt(id, 10);
    if (isNaN(pkid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const pool = await getLinksPool();
    const result = await pool
      .request()
      .input("pkid", sql.Int, pkid)
      .query(`
        SELECT
          w.PKID AS id, w.FFJOBNO, w.WO, w.WODT, w.port, w.country,
          w.bookingno, w.SBNO, w.SBDT, w.BLNO, w.BLDT,
          w.containerno, w.vslname, w.SAILINGDT, w.REMARK,
          m.status_id, m.assigned_to, m.column_order,
          s.name AS status_name, s.color_hex AS status_color
        FROM TMP_TBL_BAJAJ_WO w
        LEFT JOIN bajaj_wo_meta  m ON m.pkid = w.PKID
        LEFT JOIN bajaj_statuses s ON s.id   = m.status_id
        WHERE w.PKID = @pkid
      `);

    if (!result.recordset.length)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const r = result.recordset[0];
    return NextResponse.json({
      id:           String(r.id),
      status_id:    r.status_id ?? null,
      assigned_to:  r.assigned_to ?? null,
      column_order: r.column_order ?? 0,
      data: {
        PKID: r.id, FFJOBNO: r.FFJOBNO, WO: r.WO, WODT: r.WODT,
        port: r.port, country: r.country, bookingno: r.bookingno,
        SBNO: r.SBNO, SBDT: r.SBDT, BLNO: r.BLNO, BLDT: r.BLDT,
        containerno: r.containerno, vslname: r.vslname,
        SAILINGDT: r.SAILINGDT, REMARK: r.REMARK,
      },
      status: r.status_id
        ? { id: r.status_id, name: r.status_name, color_hex: r.status_color }
        : null,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch work order" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pkid = parseInt(id, 10);
    if (isNaN(pkid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json() as {
      status_id?: string | null;
      assigned_to?: string | null;
      column_order?: number;
    };

    const pool = await getLinksPool();

    // Upsert into bajaj_wo_meta
    const existing = await pool.request()
      .input("pkid", sql.Int, pkid)
      .query("SELECT pkid FROM bajaj_wo_meta WHERE pkid=@pkid");

    const request = pool.request().input("pkid", sql.Int, pkid);

    if (existing.recordset.length === 0) {
      request
        .input("status_id",    sql.VarChar,  body.status_id    ?? null)
        .input("assigned_to",  sql.NVarChar, body.assigned_to  ?? null)
        .input("column_order", sql.Int,       body.column_order ?? 0);
      await request.query(
        "INSERT INTO bajaj_wo_meta (pkid,status_id,assigned_to,column_order) VALUES (@pkid,@status_id,@assigned_to,@column_order)"
      );
    } else {
      const sets: string[] = ["updated_at = GETDATE()"];
      if ("status_id"    in body) { request.input("status_id",    sql.VarChar,  body.status_id    ?? null); sets.push("status_id=@status_id"); }
      if ("assigned_to"  in body) { request.input("assigned_to",  sql.NVarChar, body.assigned_to  ?? null); sets.push("assigned_to=@assigned_to"); }
      if ("column_order" in body) { request.input("column_order", sql.Int,       body.column_order);         sets.push("column_order=@column_order"); }
      await request.query(`UPDATE bajaj_wo_meta SET ${sets.join(",")} WHERE pkid=@pkid`);
    }

    // Audit log
    try {
      await pool.request()
        .input("action", sql.NVarChar, "work_order.update")
        .input("target_id", sql.NVarChar, String(pkid))
        .input("new_value", sql.NVarChar, JSON.stringify(body))
        .query(
          "INSERT INTO bajaj_audit_log (action,target_type,target_id,new_value) VALUES (@action,'work_order',@target_id,@new_value)"
        );
    } catch (_) { /* non-fatal */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}
