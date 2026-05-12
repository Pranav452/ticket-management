import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail } from "@/lib/bajaj/permissions";

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams;
  const woId    = sp.get("work_order_id");
  const moduleId = sp.get("module_id");

  const sb = createAdminClient();
  let query = sb.from("bajaj_reminders").select("*").order("due_at");

  if (woId)     query = query.eq("work_order_id", woId);
  if (moduleId) query = query.eq("module_id", moduleId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((r) => ({
      ...r,
      recipients: Array.isArray(r.recipients) ? r.recipients : [],
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { work_order_id, module_id, work_order_summary = "", due_at, days_offset = 0, recipients = [], message = "" } = body;

    if (!work_order_id || !module_id || !due_at)
      return NextResponse.json({ error: "work_order_id, module_id, due_at required" }, { status: 400 });

    const created_by = await getCurrentUserEmail();
    const sb = createAdminClient();

    const { data, error } = await sb
      .from("bajaj_reminders")
      .insert({ work_order_id, module_id, work_order_summary, created_by, due_at, days_offset, recipients, message })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/reminders]", err);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
