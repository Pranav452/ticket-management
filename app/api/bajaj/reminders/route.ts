/**
 * GET  /api/bajaj/reminders?work_order_id=<id>&module_id=<id>
 * POST /api/bajaj/reminders
 *
 * Validation: due_at must be in the future.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail } from "@/lib/bajaj/permissions";

function rowToReminder(r: Record<string, unknown>) {
  return {
    id:                  r.id,
    work_order_id:       r.work_order_id,
    module_id:           r.module_id,
    work_order_summary:  r.work_order_summary,
    created_by:          r.created_by ?? null,
    created_at:          r.created_at,
    due_at:              r.due_at,
    days_offset:         r.days_offset,
    recipients: (() => {
      if (!r.recipients) return [];
      if (Array.isArray(r.recipients)) return r.recipients;
      try { return JSON.parse(String(r.recipients)); } catch { return []; }
    })(),
    message:  r.message,
    status:   r.status,
    sent_at:  r.sent_at  ?? null,
    done_at:  r.done_at  ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sp       = req.nextUrl.searchParams;
    const woId     = sp.get("work_order_id");
    const moduleId = sp.get("module_id");

    const sb = createAdminClient();
    let query = sb.from("bajaj_reminders").select("*").order("due_at");
    if (woId)     query = query.eq("work_order_id", woId);
    if (moduleId) query = query.eq("module_id", moduleId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToReminder));
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
      due_at, days_offset = 0, recipients = [], message = "",
    } = body;

    if (!work_order_id || !module_id || !due_at)
      return NextResponse.json({ error: "work_order_id, module_id, due_at required" }, { status: 400 });

    // ── Future-date validation ─────────────────────────────────────────────
    const dueDate = new Date(due_at);
    if (isNaN(dueDate.getTime()))
      return NextResponse.json({ error: "due_at is not a valid date" }, { status: 400 });

    if (dueDate.getTime() <= Date.now())
      return NextResponse.json(
        { error: "Reminder due date must be in the future. Past dates are not allowed." },
        { status: 400 }
      );

    const created_by = await getCurrentUserEmail();
    const sb         = createAdminClient();

    const { data, error } = await sb
      .from("bajaj_reminders")
      .insert({
        work_order_id, module_id, work_order_summary,
        created_by, due_at, days_offset,
        recipients: JSON.stringify(recipients),
        message,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(rowToReminder(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/reminders]", err);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
