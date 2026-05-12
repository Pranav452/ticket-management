/**
 * GET    /api/bajaj/column-assignments?module_slug=vipar
 *   Admin: all assignments for module
 *   Approved user: their own assignments for module
 *
 * POST   /api/bajaj/column-assignments  (admin only)
 *   Body: { module_slug, status_id, user_email, can_edit?, can_move?, can_assign? }
 *
 * DELETE /api/bajaj/column-assignments?id=<uuid>  (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentUserEmail, isAdmin } from "@/lib/bajaj/permissions";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!actorEmail) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const moduleSlug = req.nextUrl.searchParams.get("module_slug");
  const supabase = await getSupabase();

  let query = supabase.from("bajaj_column_assignments").select("*");
  if (moduleSlug) query = query.eq("module_slug", moduleSlug);
  if (!isAdmin(actorEmail)) query = query.eq("user_email", actorEmail);
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!isAdmin(actorEmail)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json() as {
    module_slug: string;
    status_id: string | null;
    user_email: string;
    can_edit?: boolean;
    can_move?: boolean;
    can_assign?: boolean;
  };

  if (!body.module_slug || !body.user_email)
    return NextResponse.json({ error: "module_slug and user_email required" }, { status: 400 });

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bajaj_column_assignments")
    .upsert({
      module_slug: body.module_slug,
      status_id:   body.status_id ?? null,
      user_email:  body.user_email,
      can_edit:    body.can_edit  ?? true,
      can_move:    body.can_move  ?? true,
      can_assign:  body.can_assign ?? true,
    }, { onConflict: "module_slug,status_id,user_email" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!isAdmin(actorEmail)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await getSupabase();
  const { error } = await supabase.from("bajaj_column_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
