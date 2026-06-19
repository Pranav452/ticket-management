import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("module_id");
  if (!moduleId) return NextResponse.json({ error: "module_id required" }, { status: 400 });

  const sb = createAdminClient();
  const { data } = await sb
    .from("bajaj_board_config")
    .select("*")
    .eq("module_id", moduleId)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}

export async function PATCH(req: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { module_id, card_face_fields, unique_key_field } = await req.json();
    if (!module_id) return NextResponse.json({ error: "module_id required" }, { status: 400 });

    const sb = createAdminClient();
    const { error } = await sb
      .from("bajaj_board_config")
      .upsert({ module_id, card_face_fields: card_face_fields ?? [], unique_key_field: unique_key_field ?? null, updated_at: new Date().toISOString() });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/board-config]", err);
    return NextResponse.json({ error: "Failed to update board config" }, { status: 500 });
  }
}
