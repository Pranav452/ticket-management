/**
 * PATCH /api/bajaj/reminders/[id]  — update status, sent_at, done_at, message etc.
 * DELETE /api/bajaj/reminders/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      status?: string;
      sent_at?: string | null;
      done_at?: string | null;
      message?: string;
      due_at?: string;
      recipients?: string[];
    };

    const pool    = await getLinksPool();
    const request = pool.request().input("id", sql.VarChar, id);
    const sets: string[] = ["updated_at = GETDATE()"];

    if (body.status)     { request.input("status",  sql.VarChar,  body.status);           sets.push("status=@status"); }
    if ("sent_at" in body) { request.input("sent_at", sql.DateTime, body.sent_at ? new Date(body.sent_at) : null); sets.push("sent_at=@sent_at"); }
    if ("done_at" in body) { request.input("done_at", sql.DateTime, body.done_at ? new Date(body.done_at) : null); sets.push("done_at=@done_at"); }
    if (body.message)    { request.input("msg",     sql.NVarChar, body.message);           sets.push("message=@msg"); }
    if (body.due_at)     { request.input("due",     sql.DateTime, new Date(body.due_at));  sets.push("due_at=@due"); }
    if (body.recipients) { request.input("recips",  sql.NVarChar, JSON.stringify(body.recipients)); sets.push("recipients=@recips"); }

    // bajaj_reminders doesn't have updated_at — remove that set
    const filteredSets = sets.filter(s => s !== "updated_at = GETDATE()");
    if (filteredSets.length === 0)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    await request.query(`UPDATE bajaj_reminders SET ${filteredSets.join(",")} WHERE id=@id`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/reminders/[id]]", err);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = await getLinksPool();
    await pool.request().input("id", sql.VarChar, id)
      .query("DELETE FROM bajaj_reminders WHERE id=@id");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/bajaj/reminders/[id]]", err);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
