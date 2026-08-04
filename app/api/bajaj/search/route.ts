/**
 * GET /api/bajaj/search?q=xxx&limit=10
 *
 * Full-DB work order search across ALL modules (archived cards excluded).
 * Searches the canonical data keys the sheet sync writes (see
 * lib/bajaj/import-map.mjs HEADER_MAP) using Postgres ILIKE on the JSONB cast.
 * Returns up to `limit` results (default 10, max 30) with enough fields to
 * render a result row + navigate to the detail page.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

const SEARCH_FIELDS = [
  "wo", "variant", "vslname", "container_no", "blno", "booking_no",
  "sbno", "agent", "port", "consignee", "transporter", "remark",
];

const MODULE_META: Record<string, { name: string; flag: string }> = {
  vipar:      { name: "VIPAR",      flag: "🌐" },
  srilanka:   { name: "Sri Lanka",  flag: "🌴" },
  nigeria:    { name: "Nigeria",    flag: "🟢" },
  bangladesh: { name: "Bangladesh", flag: "🔴" },
  triumph:    { name: "Triumph",    flag: "⚡" },
};

export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const q     = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "10"), 30);

  // Strip characters that break PostgREST's .or() clause grammar (commas
  // separate clauses, parens group them) before building the filter.
  const safeQ = q.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();

  if (!safeQ || safeQ.length < 2)
    return NextResponse.json([]);

  const sb = createAdminClient();

  // Build OR filter across all searchable fields using PostgREST JSONB syntax.
  // Correct format: data->>fieldname.ilike.%value% (no quotes around field name)
  const orClauses = SEARCH_FIELDS
    .map(f => `data->>${f}.ilike.%${safeQ}%`)
    .join(",");

  const { data, error } = await sb
    .from("bajaj_work_orders")
    .select("id, module_slug, status_id, data, bajaj_statuses(name, color_hex)")
    .or(orClauses)
    // Archived cards are parked — never surfaced in search.
    .is("data->>archived_at", null)
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map(wo => {
    const d       = wo.data as Record<string, unknown>;
    const status  = Array.isArray(wo.bajaj_statuses) ? wo.bajaj_statuses[0] : wo.bajaj_statuses;
    const meta    = MODULE_META[wo.module_slug] ?? { name: wo.module_slug, flag: "📦" };
    return {
      id:          wo.id,
      module_slug: wo.module_slug,
      module_name: meta.name,
      module_flag: meta.flag,
      wo:          String(d["wo"] ?? ""),
      brand:       String(d["brand"] ?? ""),
      variant:     String(d["variant"] ?? ""),
      port:        String(d["port"] ?? ""),
      vslname:     String(d["vslname"] ?? ""),
      status_name: status?.name ?? "",
      status_color: status?.color_hex ?? "6b7280",
    };
  });

  return NextResponse.json(results);
}
