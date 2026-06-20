import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/bajaj/guards";
import { getCurrentUserEmail } from "@/lib/bajaj/permissions";

export async function GET() {
  // The full user directory (emails, roles, status) is admin-only.
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_users")
    .select("id, email, full_name, status, role, department, approved_by, approved_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((r) => ({ ...r, user_id: r.id })));
}

export async function POST(req: NextRequest) {
  try {
    // Self-registration only: a logged-in user can create their own pending row.
    // Identity comes from the session — never trust the body's email.
    const sessionEmail = await getCurrentUserEmail();
    if (!sessionEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { full_name } = await req.json();
    const email = sessionEmail;

    const sb = createAdminClient();
    const { data: existing } = await sb
      .from("bajaj_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: "User already registered" }, { status: 409 });

    const { data, error } = await sb
      .from("bajaj_users")
      .insert({ email, full_name: full_name ?? null, status: "pending", role: "viewer" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ...data, user_id: data.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/users]", err);
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 });
  }
}
