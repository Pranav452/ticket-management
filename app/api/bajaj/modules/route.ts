import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

export async function GET() {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_modules")
    .select("*")
    .order("display_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
