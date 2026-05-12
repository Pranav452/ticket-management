import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/bajaj/statuses?module_id=<uuid>&module_slug=<slug> */
export async function GET(req: NextRequest) {
  const sp         = req.nextUrl.searchParams;
  const moduleId   = sp.get("module_id");
  const moduleSlug = sp.get("module_slug");
  const sb = createAdminClient();

  let query = sb
    .from("bajaj_statuses")
    .select("id, module_id, name, color_hex, display_order")
    .order("display_order");

  if (moduleId) {
    query = query.eq("module_id", moduleId);
  } else if (moduleSlug) {
    const { data: mod } = await sb
      .from("bajaj_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .single();
    if (mod) query = query.eq("module_id", mod.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
