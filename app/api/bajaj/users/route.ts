import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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
    const { email, full_name } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

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
