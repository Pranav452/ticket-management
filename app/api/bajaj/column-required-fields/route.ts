/**
 * GET  /api/bajaj/column-required-fields?module=<slug>
 *   → { status_name: string; field_keys: string[] }[]
 *
 * POST /api/bajaj/column-required-fields   (admin only)
 *   body: { module_slug, status_name, field_key }
 *
 * DELETE /api/bajaj/column-required-fields  (admin only)
 *   body: { module_slug, status_name, field_key }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ADMIN_EMAIL = "pranavnairop090@gmail.com";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module") ?? "";
  const supabase = await getSupabase();

  const query = supabase
    .from("bajaj_column_required_fields")
    .select("status_name, field_key")
    .order("status_name");

  if (moduleSlug) query.eq("module_slug", moduleSlug);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by status_name
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!map[row.status_name]) map[row.status_name] = [];
    map[row.status_name].push(row.field_key);
  }
  const grouped = Object.entries(map).map(([status_name, field_keys]) => ({
    status_name,
    field_keys,
  }));

  return NextResponse.json(grouped);
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json() as { module_slug: string; status_name: string; field_key: string };
  if (!body.module_slug || !body.status_name || !body.field_key) {
    return NextResponse.json({ error: "module_slug, status_name, field_key are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bajaj_column_required_fields")
    .upsert({ module_slug: body.module_slug, status_name: body.status_name, field_key: body.field_key });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json() as { module_slug: string; status_name: string; field_key: string };
  if (!body.module_slug || !body.status_name || !body.field_key) {
    return NextResponse.json({ error: "module_slug, status_name, field_key are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bajaj_column_required_fields")
    .delete()
    .eq("module_slug", body.module_slug)
    .eq("status_name", body.status_name)
    .eq("field_key", body.field_key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
