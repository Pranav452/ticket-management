import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const update: Record<string, unknown> = {};
    if (body.status !== undefined)     update.status     = body.status;
    if ("sent_at" in body)             update.sent_at    = body.sent_at;
    if ("done_at" in body)             update.done_at    = body.done_at;
    if (body.message !== undefined)    update.message    = body.message;
    if (body.due_at !== undefined)     update.due_at     = body.due_at;
    if (body.recipients !== undefined) update.recipients = body.recipients;

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const sb = createAdminClient();
    const { error } = await sb.from("bajaj_reminders").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    const sb = createAdminClient();
    const { error } = await sb.from("bajaj_reminders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/bajaj/reminders/[id]]", err);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
