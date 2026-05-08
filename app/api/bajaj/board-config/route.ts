/**
 * GET   /api/bajaj/board-config?module_id=<id>
 * PATCH /api/bajaj/board-config  { module_id, card_face_fields, unique_key_field }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const moduleId = req.nextUrl.searchParams.get("module_id");
    if (!moduleId)
      return NextResponse.json({ error: "module_id required" }, { status: 400 });

    const pool   = await getLinksPool();
    const result = await pool.request()
      .input("mid", sql.VarChar, moduleId)
      .query("SELECT * FROM bajaj_board_config WHERE module_id=@mid");

    if (!result.recordset.length)
      return NextResponse.json(null);

    const r = result.recordset[0];
    return NextResponse.json({
      module_id:        r.module_id,
      card_face_fields: JSON.parse(r.card_face_fields ?? "[]"),
      unique_key_field: r.unique_key_field ?? null,
      updated_at:       r.updated_at,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/board-config]", err);
    return NextResponse.json({ error: "Failed to fetch board config" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { module_id, card_face_fields, unique_key_field } = await req.json();
    if (!module_id)
      return NextResponse.json({ error: "module_id required" }, { status: 400 });

    const pool = await getLinksPool();
    await pool.request()
      .input("mid",    sql.VarChar,  module_id)
      .input("fields", sql.NVarChar, JSON.stringify(card_face_fields ?? []))
      .input("uk",     sql.NVarChar, unique_key_field ?? null)
      .input("now",    sql.DateTime, new Date())
      .query(`
        UPDATE bajaj_board_config
        SET card_face_fields=@fields, unique_key_field=@uk, updated_at=@now
        WHERE module_id=@mid
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/board-config]", err);
    return NextResponse.json({ error: "Failed to update board config" }, { status: 500 });
  }
}
