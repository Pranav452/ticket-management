/**
 * GET   /api/bajaj/work-orders/[id]  — fetch single work order by id
 * PATCH /api/bajaj/work-orders/[id]  — update status_id, assigned_to, column_order, and/or data fields
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch { return null; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const woId = parseInt(id, 10);
    if (isNaN(woId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const pool = await getLinksPool();
    const result = await pool
      .request()
      .input("id", sql.Int, woId)
      .query(`
        SELECT
          w.*,
          m.status_id    AS status_id,
          m.assigned_to  AS assigned_to,
          m.column_order AS column_order,
          s.name         AS status_name,
          s.color_hex    AS status_color
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta  m ON m.wo_id = w.id
        LEFT JOIN bajaj_statuses s ON s.id    = m.status_id
        WHERE w.id = @id
      `);

    if (!result.recordset.length)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const r = result.recordset[0] as Record<string, unknown>;

    // Separate meta fields from data fields
    const metaFields = new Set(["status_id", "assigned_to", "column_order", "status_name", "status_color"]);
    const data: Record<string, unknown> = {};
    Object.keys(r).forEach((key) => {
      if (!metaFields.has(key)) data[key] = r[key];
    });

    return NextResponse.json({
      id:           String(r.id),
      module_id:    null,
      status_id:    r.status_id ?? null,
      assigned_to:  r.assigned_to ?? null,
      column_order: r.column_order ?? 0,
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
      data,
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
    const woId = parseInt(id, 10);
    if (isNaN(woId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json() as {
      status_id?:    string | null;
      assigned_to?:  string | null;
      column_order?: number;
      data?:         Record<string, unknown>;  // field-level edits
    };

    const pool = await getLinksPool();
    const actorEmail = await getCurrentUserEmail();

    // ── 1. Update meta (status, assignee, column_order) ───────────────────────
    const hasMeta = "status_id" in body || "assigned_to" in body || "column_order" in body;
    if (hasMeta) {
      const existing = await pool.request()
        .input("wo_id", sql.Int, woId)
        .query("SELECT id FROM bajaj_wo_meta WHERE wo_id=@wo_id");

      const metaReq = pool.request().input("wo_id", sql.Int, woId);

      if (existing.recordset.length === 0) {
        metaReq
          .input("status_id",    sql.VarChar,  body.status_id    ?? null)
          .input("assigned_to",  sql.NVarChar, body.assigned_to  ?? null)
          .input("column_order", sql.Int,       body.column_order ?? 0);
        await metaReq.query(
          "INSERT INTO bajaj_wo_meta (wo_id,status_id,assigned_to,column_order) VALUES (@wo_id,@status_id,@assigned_to,@column_order)"
        );
      } else {
        const sets: string[] = ["updated_at = GETDATE()"];
        if ("status_id"    in body) { metaReq.input("status_id",    sql.VarChar,  body.status_id    ?? null); sets.push("status_id=@status_id"); }
        if ("assigned_to"  in body) { metaReq.input("assigned_to",  sql.NVarChar, body.assigned_to  ?? null); sets.push("assigned_to=@assigned_to"); }
        if ("column_order" in body) { metaReq.input("column_order", sql.Int,       body.column_order);         sets.push("column_order=@column_order"); }
        await metaReq.query(`UPDATE bajaj_wo_meta SET ${sets.join(",")} WHERE wo_id=@wo_id`);
      }
    }

    // ── 2. Update data fields in bajaj_work_orders ────────────────────────────
    if (body.data && Object.keys(body.data).length > 0) {
      const dataReq = pool.request().input("wo_id", sql.Int, woId);
      const setClauses: string[] = [];

      // Get existing columns to avoid writing unknown columns
      const colResult = await pool.request().query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bajaj_work_orders'"
      );
      const validCols = new Set(colResult.recordset.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME.toLowerCase()));

      let paramIdx = 0;
      for (const [key, val] of Object.entries(body.data)) {
        const colName = key.toLowerCase();
        if (colName === "id" || !validCols.has(colName)) continue;

        const paramName = `f${paramIdx++}`;
        if (["qty", "hc40", "std20"].includes(colName)) {
          dataReq.input(paramName, sql.Int, val === "" || val === null ? null : Number(val));
        } else if (["haz", "vgm_submitted", "si_submitted"].includes(colName)) {
          dataReq.input(paramName, sql.Bit, val === true || val === "true" || val === 1 ? 1 : 0);
        } else {
          dataReq.input(paramName, sql.NVarChar, val == null ? null : String(val));
        }
        setClauses.push(`${colName} = @${paramName}`);
      }

      if (setClauses.length > 0) {
        await dataReq.query(
          `UPDATE bajaj_work_orders SET ${setClauses.join(", ")} WHERE id = @wo_id`
        );
      }
    }

    // ── 3. Audit log ─────────────────────────────────────────────────────────
    try {
      const action = "status_id" in body ? "moved_card"
                   : "assigned_to" in body ? "assigned"
                   : "data" in body ? "edited_field"
                   : "work_order.update";

      await pool.request()
        .input("actor_email", sql.NVarChar, actorEmail ?? "system")
        .input("action",      sql.NVarChar, action)
        .input("target_id",   sql.NVarChar, String(woId))
        .input("new_value",   sql.NVarChar, JSON.stringify(body))
        .query(
          "INSERT INTO bajaj_audit_log (actor_email,action,target_type,target_id,new_value) VALUES (@actor_email,@action,'work_order',@target_id,@new_value)"
        );
    } catch (_) { /* audit is non-fatal */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}
