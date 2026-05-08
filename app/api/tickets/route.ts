/**
 * GET  /api/tickets   — list all tickets
 * POST /api/tickets   — create a ticket
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

export async function GET(req: NextRequest) {
  try {
    const sp     = req.nextUrl.searchParams;
    const status = sp.get("status");
    const pool   = await getManilalPool();
    const request = pool.request();

    let q = "SELECT * FROM tbl_ticket_raise";
    if (status) {
      request.input("status", sql.VarChar, status);
      q += " WHERE status=@status";
    }
    q += " ORDER BY pk_id DESC";

    const result = await request.query(q);
    return NextResponse.json(result.recordset.map(rowToTicket));
  } catch (err) {
    console.error("[GET /api/tickets]", err);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title, subject, description,
      mail_from = "", mail_to = "", mail_cc = "",
      module_id = null, filepath = null,
      status = "backlog",
      makerid = "system", makerip = "127.0.0.1",
    } = body;

    const subj = subject ?? title ?? "";
    if (!subj) return NextResponse.json({ error: "subject/title required" }, { status: 400 });

    const ticketId = `TKT-${Date.now()}`;
    const pool     = await getManilalPool();

    const r = await pool.request()
      .input("ticket_id",    sql.VarChar,  ticketId)
      .input("module_id",    sql.VarChar,  module_id)
      .input("mail_from",    sql.NVarChar, mail_from)
      .input("mail_to",      sql.NVarChar, mail_to)
      .input("mail_subject", sql.NVarChar, subj)
      .input("mail_body",    sql.NVarChar, description ?? "")
      .input("status",       sql.VarChar,  status)
      .input("filepath",     sql.NVarChar, filepath)
      .input("makerid",      sql.NVarChar, makerid)
      .input("makerdate",    sql.DateTime, new Date())
      .input("makerip",      sql.VarChar,  makerip)
      .input("mail_cc",      sql.NVarChar, Array.isArray(mail_cc) ? mail_cc.join(",") : mail_cc)
      .query(`
        INSERT INTO tbl_ticket_raise
          (ticket_id,module_id,mail_from,mail_to,mail_subject,mail_body,status,filepath,makerid,makerdate,makerip,mail_cc)
        OUTPUT inserted.*
        VALUES
          (@ticket_id,@module_id,@mail_from,@mail_to,@mail_subject,@mail_body,@status,@filepath,@makerid,@makerdate,@makerip,@mail_cc)
      `);

    return NextResponse.json(rowToTicket(r.recordset[0]), { status: 201 });
  } catch (err) {
    console.error("[POST /api/tickets]", err);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
