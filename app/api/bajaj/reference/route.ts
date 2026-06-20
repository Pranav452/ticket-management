/**
 * GET /api/bajaj/reference?type=bookings|rates
 *   Reads the booking list / rate card stored in app_config (JSON blobs).
 * PUT /api/bajaj/reference
 *   Body: { type, rows?, grid?, baseUpdatedAt? } — saves the booking list / rate
 *   card. Uses an optimistic lock (baseUpdatedAt) so two desks editing at once
 *   don't silently clobber each other.
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

export async function PUT(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    type?: keyof typeof KEY;
    rows?: Record<string, string>[];
    grid?: string[][];
    baseUpdatedAt?: string | null;
  };

  const type = body.type ?? "bookings";
  const key = KEY[type];
  if (!key) return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  const sb = createAdminClient();

  // Optimistic lock: reject if the stored copy changed since the client loaded it.
  const { data: current } = await sb.from("app_config").select("value").eq("key", key).maybeSingle();
  if (current?.value && body.baseUpdatedAt !== undefined) {
    try {
      const parsed = JSON.parse(current.value);
      if (parsed.updated_at && parsed.updated_at !== body.baseUpdatedAt) {
        return NextResponse.json(
          { error: "conflict", message: "This list was changed by someone else. Reload before saving.", updated_at: parsed.updated_at },
          { status: 409 },
        );
      }
    } catch { /* corrupt stored value — allow overwrite */ }
  }

  const payload = type === "rates"
    ? { updated_at: new Date().toISOString(), grid: Array.isArray(body.grid) ? body.grid : [] }
    : { updated_at: new Date().toISOString(), rows: Array.isArray(body.rows) ? body.rows : [] };

  const { error } = await sb
    .from("app_config")
    .upsert({ key, value: JSON.stringify(payload) }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(payload);
}
