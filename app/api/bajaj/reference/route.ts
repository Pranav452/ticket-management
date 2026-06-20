/**
 * GET /api/bajaj/reference?type=bookings|rates
 * Reads the booking list / rate card stored in app_config (JSON blobs).
 * Auth: any approved Bajaj user (middleware blocks anonymous).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

const KEY = { bookings: "bajaj_bookings", rates: "bajaj_rate_card" } as const;

export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const type = (req.nextUrl.searchParams.get("type") ?? "bookings") as keyof typeof KEY;
  const key = KEY[type];
  if (!key) return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  const sb = createAdminClient();
  const { data } = await sb.from("app_config").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return NextResponse.json({ updated_at: null, rows: [], grid: [] });

  try {
    return NextResponse.json(JSON.parse(data.value));
  } catch {
    return NextResponse.json({ error: "Corrupt reference data" }, { status: 500 });
  }
}
