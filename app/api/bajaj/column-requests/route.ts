/**
 * GET    /api/bajaj/column-requests?module_slug=vipar
 *   Admin: all requests
 *   Approved user: their own requests
 *
 * POST   /api/bajaj/column-requests  (approved users)
 *   Body: { module_slug, status_id, reason? }
 *
 * PATCH  /api/bajaj/column-requests/[id]  (admin only)
 *   Body: { status: "approved"|"rejected" }
 *   On approval: auto-creates bajaj_column_assignment with full permissions
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

  let query = supabase.from("bajaj_column_requests").select("*");
  if (moduleSlug) query = query.eq("module_slug", moduleSlug);
  if (!isAdmin(actorEmail)) query = query.eq("user_email", actorEmail);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!actorEmail) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as {
    module_slug: string;
    status_id: string | null;
    reason?: string;
  };

  if (!body.module_slug)
    return NextResponse.json({ error: "module_slug required" }, { status: 400 });

  const supabase = await getSupabase();

  // Check if user is approved
  const { data: bajajUser } = await supabase
    .from("bajaj_users")
    .select("status")
    .eq("email", actorEmail)
    .maybeSingle();

  if (!bajajUser || bajajUser.status !== "approved")
    return NextResponse.json({ error: "Bajaj access not approved" }, { status: 403 });

  const { data, error } = await supabase
    .from("bajaj_column_requests")
    .upsert({
      module_slug: body.module_slug,
      status_id:   body.status_id ?? null,
      user_email:  actorEmail,
      reason:      body.reason ?? null,
      status:      "pending",
    }, { onConflict: "module_slug,status_id,user_email" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!isAdmin(actorEmail)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json() as { status: "approved" | "rejected" };
  if (!["approved", "rejected"].includes(body.status))
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });

  const supabase = await getSupabase();

  // Fetch the request
  const { data: reqRow, error: fetchErr } = await supabase
    .from("bajaj_column_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // Update request status
  const { error: updateErr } = await supabase
    .from("bajaj_column_requests")
    .update({ status: body.status, reviewed_by: actorEmail })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // On approval: auto-create assignment with full permissions
  if (body.status === "approved") {
    const { error: assignErr } = await supabase
      .from("bajaj_column_assignments")
      .upsert({
        module_slug: reqRow.module_slug,
        status_id:   reqRow.status_id,
        user_email:  reqRow.user_email,
        can_edit:    true,
        can_move:    true,
        can_assign:  true,
      }, { onConflict: "module_slug,status_id,user_email" });

    if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
