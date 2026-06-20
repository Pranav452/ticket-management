import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const sp         = req.nextUrl.searchParams;
  const limit      = Math.min(200, Math.max(1, parseInt(sp.get("limit")  ?? "50", 10) || 50));
  const offset     = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const actorEmail = sp.get("actor_email");
  const action     = sp.get("action");
  const targetId   = sp.get("target_id");

  const sb = createAdminClient();
  let query = sb
    .from("bajaj_audit_logs")
    .select("id, actor_email, action, target_type, target_id, old_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorEmail) query = query.ilike("actor_email", `%${actorEmail}%`);
  if (action)     query = query.ilike("action",      `%${action}%`);
  if (targetId)   query = query.eq("target_id",       targetId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
