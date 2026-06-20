/**
 * GET /api/bajaj/export?module=<slug|all>
 * Returns ALL work orders (unpaginated) for the export page: each row carries
 * the full data jsonb + resolved status name + module slug.
 * Auth: any approved Bajaj user (middleware already blocks anonymous access).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const moduleSlug = req.nextUrl.searchParams.get("module");
    const sb = createAdminClient();

    const rows: { id: string; module_slug: string; status: string | null; data: Record<string, unknown> }[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = sb
        .from("bajaj_work_orders")
        .select("id, module_slug, data, bajaj_statuses ( name )")
        .order("module_slug", { ascending: true })
        .order("column_order", { ascending: true })
        .range(from, from + PAGE - 1);
      if (moduleSlug && moduleSlug !== "all") q = q.eq("module_slug", moduleSlug);

      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      for (const r of data ?? []) {
        const st = Array.isArray(r.bajaj_statuses) ? r.bajaj_statuses[0] : r.bajaj_statuses;
        rows.push({
          id: r.id,
          module_slug: r.module_slug,
          status: st?.name ?? null,
          data: (r.data as Record<string, unknown>) ?? {},
        });
      }
      if (!data || data.length < PAGE) break;
    }

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[GET /api/bajaj/export]", err);
    return NextResponse.json({ error: "Export fetch failed" }, { status: 500 });
  }
}
