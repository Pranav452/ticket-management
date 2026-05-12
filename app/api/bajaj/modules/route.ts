import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_modules")
    .select("*")
    .order("display_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
