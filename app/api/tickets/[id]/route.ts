/**
 * GET    /api/tickets/[id]
 * PATCH  /api/tickets/[id]  { status?, title?, description?, assigned_to? }
 * DELETE /api/tickets/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getManilalPool, sql } from "@/lib/db";

function rowToTicket(r: Record<string, unknown>) {
  return {
    id:          String(r.pk_id),
    title:       r.mail_subject ?? "",
    subject:     r.mail_subject ?? "",
    description: r.mail_body   ?? null,
    status:      (r.status as string) ?? "backlog",
    priority:    "medium",
    created_at:  r.makerdate ?? new Date().toISOString(),
    updated_at:  r.makerdate ?? new Date().toISOString(),
    column_order: 0,
    created_by:  r.makerid   ?? null,
    assigned_to: null,
    cc:          r.mail_cc ? String(r.mail_cc).split(",").map((e: string) => e.trim()).filter(Boolean) : [],
    bcc:         [],
    creator: {
      id:        String(r.makerid ?? ""),
      email:     String(r.mail_from ?? ""),
      full_name: null,
      avatar_url:null,
      role:      "dev",
    },
    assignee: null,
    files:    [],
    module_id: r.module_id ?? null,
    ticket_id: r.ticket_id ?? null,
    filepath:  r.filepath  ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool   = await getManilalPool();
    const result = await pool.request()
      .input("id", sql.Int, parseInt(id, 10))
      .query("SELECT * FROM tbl_ticket_raise WHERE pk_id=@id");

    if (!result.recordset.length)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(rowToTicket(result.recordset[0]));
  } catch (err) {
    console.error("[GET /api/tickets/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json() as {
      status?: string;
      title?: string;
      subject?: string;
      description?: string;
      mail_body?: string;
      mail_cc?: string | string[];
    };

    const pool    = await getManilalPool();
    const request = pool.request().input("id", sql.Int, parseInt(id, 10));
    const sets: string[] = [];

    if (body.status)      { request.input("status", sql.VarChar,  body.status);     sets.push("status=@status"); }
    if (body.title || body.subject) {
      const subj = body.subject ?? body.title;
      request.input("subj", sql.NVarChar, subj!);
      sets.push("mail_subject=@subj");
    }
    if ("description" in body || "mail_body" in body) {
      request.input("body", sql.NVarChar, body.description ?? body.mail_body ?? "");
      sets.push("mail_body=@body");
    }
    if ("mail_cc" in body) {
      const cc = Array.isArray(body.mail_cc) ? body.mail_cc.join(",") : body.mail_cc ?? "";
      request.input("cc", sql.NVarChar, cc);
      sets.push("mail_cc=@cc");
    }

    if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    await request.query(`UPDATE tbl_ticket_raise SET ${sets.join(",")} WHERE pk_id=@id`);
    const updated = await pool.request()
      .input("id", sql.Int, parseInt(id, 10))
      .query("SELECT * FROM tbl_ticket_raise WHERE pk_id=@id");

    return NextResponse.json(rowToTicket(updated.recordset[0]));
  } catch (err) {
    console.error("[PATCH /api/tickets/[id]]", err);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool   = await getManilalPool();
    await pool.request()
      .input("id", sql.Int, parseInt(id, 10))
      .query("DELETE FROM tbl_ticket_raise WHERE pk_id=@id");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/tickets/[id]]", err);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}
