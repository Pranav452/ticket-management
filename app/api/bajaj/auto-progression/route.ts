/**
 * GET  /api/bajaj/auto-progression?module_slug=xxx
 * POST /api/bajaj/auto-progression  { module_slug, trigger_field, target_status_name, description? }
 * DELETE /api/bajaj/auto-progression?id=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, getCurrentUserEmail } from "@/lib/bajaj/permissions";

export async function GET(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module_slug");
  const sb = createAdminClient();

  const query = sb
    .from("bajaj_auto_progression")
    .select("*")
    .order("created_at", { ascending: true });

  if (moduleSlug) query.eq("module_slug", moduleSlug);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!(await isAdminEmail(actorEmail)))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json() as {
    module_slug: string;
    trigger_field: string;
    target_status_name: string;
    description?: string;
  };

  if (!body.module_slug || !body.trigger_field || !body.target_status_name)
    return NextResponse.json({ error: "module_slug, trigger_field, and target_status_name are required" }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_auto_progression")
    .upsert({
      module_slug:        body.module_slug,
      trigger_field:      body.trigger_field,
      target_status_name: body.target_status_name,
      description:        body.description ?? null,
    }, { onConflict: "module_slug,trigger_field" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!(await isAdminEmail(actorEmail)))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from("bajaj_auto_progression").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
