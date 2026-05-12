/**
 * GET  /api/bajaj/comments?work_order_id=<pkid>
 * POST /api/bajaj/comments  { work_order_id, author_email, author_name, content }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const woId = req.nextUrl.searchParams.get("work_order_id");
    if (!woId) return NextResponse.json({ error: "work_order_id required" }, { status: 400 });

    const pool = await getLinksPool();
    const result = await pool
      .request()
      .input("woid", sql.Int, parseInt(woId, 10))
      .query(`
        SELECT id, work_order_pkid AS work_order_id,
               author_email, author_name, content, created_at
        FROM bajaj_comments
        WHERE work_order_pkid = @woid
        ORDER BY created_at ASC
      `);

    const rows = result.recordset.map((r) => ({
      id:              r.id,
      work_order_id:   String(r.work_order_id),
      author_id:       r.author_email,
      content:         r.content,
      created_at:      r.created_at,
      author: {
        id:        r.author_email,
        email:     r.author_email,
        full_name: r.author_name ?? null,
        avatar_url: null,
      },
    }));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/bajaj/comments]", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { work_order_id, author_email, author_name, content } = await req.json();
    if (!work_order_id || !content)
      return NextResponse.json({ error: "work_order_id and content required" }, { status: 400 });

    const pool = await getLinksPool();
    const r = await pool
      .request()
      .input("woid",  sql.Int,      parseInt(work_order_id, 10))
      .input("email", sql.NVarChar, author_email ?? "unknown")
      .input("name",  sql.NVarChar, author_name  ?? null)
      .input("body",  sql.NVarChar, content)
      .query(`
        INSERT INTO bajaj_comments (work_order_pkid, author_email, author_name, content)
        OUTPUT inserted.id, inserted.created_at
        VALUES (@woid, @email, @name, @body)
      `);

    return NextResponse.json(
      {
        id:            r.recordset[0].id,
        work_order_id: String(work_order_id),
        author_id:     author_email,
        content,
        created_at:    r.recordset[0].created_at,
        author: { id: author_email, email: author_email, full_name: author_name ?? null, avatar_url: null },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/bajaj/comments]", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
