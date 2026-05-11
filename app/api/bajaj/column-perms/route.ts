/**
 * GET    /api/bajaj/column-perms?module=<slug>   list all perms for module
 * POST   /api/bajaj/column-perms                 upsert a perm entry
 * DELETE /api/bajaj/column-perms?id=<uuid>       remove a perm entry
 *
 * Admin only.
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

async function assertAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email !== ADMIN_EMAIL) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabase();
  if (!await assertAdmin(supabase)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const moduleSlug = req.nextUrl.searchParams.get("module");
  let q = supabase.from("bajaj_column_perms").select("*").order("module_slug").order("grantee_type").order("grantee");
  if (moduleSlug) q = q.eq("module_slug", moduleSlug);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  if (!await assertAdmin(supabase)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json() as {
    module_slug:     string;
    status_id?:      string | null;
    grantee_type:    "role" | "user";
    grantee:         string;
    can_view?:        boolean;
    can_edit_fields?: boolean;
    can_move_cards?:  boolean;
    can_assign?:      boolean;
  };

  const { data, error } = await supabase
    .from("bajaj_column_perms")
    .upsert({
      module_slug:     body.module_slug,
      status_id:       body.status_id ?? null,
      grantee_type:    body.grantee_type,
      grantee:         body.grantee,
      can_view:        body.can_view        ?? true,
      can_edit_fields: body.can_edit_fields ?? false,
      can_move_cards:  body.can_move_cards  ?? false,
      can_assign:      body.can_assign      ?? false,
    }, { onConflict: "module_slug,status_id,grantee_type,grantee" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabase();
  if (!await assertAdmin(supabase)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("bajaj_column_perms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
