/**
 * GET /api/bajaj/work-orders
 *   ?module=<slug>         filter by module_slug
 *   ?statusId=<uuid>       filter by status
 *   ?search=<text>         searches WO, BL no, vessel name, port inside data jsonb
 *   ?assignedTo=<email>    returns WOs in columns assigned to this user
 *   ?dateFrom=<YYYY-MM-DD>
 *   ?dateTo=<YYYY-MM-DD>
 *   ?page=<n>              1-based (default 1)
 *   ?pageSize=<n>          default 50, max 200
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const sp         = req.nextUrl.searchParams;
    const moduleSlug = sp.get("module");
    const statusId   = sp.get("statusId");
    const search     = sp.get("search");
    const assignedTo = sp.get("assignedTo");
    const dateFrom   = sp.get("dateFrom");
    const dateTo     = sp.get("dateTo");
    const page       = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize   = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10) || 50));

    const sb = createAdminClient();

    // If assignedTo, resolve which status_ids this user has access to
    let assignedStatusIds: string[] | null = null;
    if (assignedTo) {
      const { data: asgn } = await sb
        .from("bajaj_column_assignments")
        .select("status_id, module_slug")
        .eq("user_email", assignedTo);

      if (asgn && asgn.length > 0) {
        // null status_id means module-wide access — include all WOs in those modules
        const hasModuleWide = asgn.some((a) => a.status_id === null);
        if (!hasModuleWide) {
          assignedStatusIds = asgn.map((a) => a.status_id).filter(Boolean) as string[];
        }
        // if module-wide, assignedStatusIds stays null = no status filter needed
      } else {
        // No assignments at all — return empty
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
    }

    let query = sb
      .from("bajaj_work_orders")
      .select(`
        id, module_id, module_slug, status_id, data, column_order,
        import_batch_id, created_at, updated_at,
        bajaj_statuses ( id, name, color_hex, display_order )
      `, { count: "exact" })
      .order("column_order", { ascending: true });

    if (moduleSlug)          query = query.eq("module_slug", moduleSlug);
    if (statusId)            query = query.eq("status_id", statusId);
    if (assignedStatusIds)   query = query.in("status_id", assignedStatusIds);
    if (search)              query = query.or(
      `data->>'wo'.ilike.%${search}%,data->>'blno'.ilike.%${search}%,data->>'vslname'.ilike.%${search}%,data->>'port'.ilike.%${search}%`
    );
    if (dateFrom)            query = query.gte("data->>'wodt'", dateFrom);
    if (dateTo)              query = query.lte("data->>'wodt'", dateTo);

    // Pagination
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []).map((r) => {
      const status = Array.isArray(r.bajaj_statuses)
        ? r.bajaj_statuses[0]
        : r.bajaj_statuses;
      return {
        id:              r.id,
        module_id:       r.module_id,
        module_slug:     r.module_slug,
        status_id:       r.status_id ?? null,
        data:            r.data ?? {},
        column_order:    r.column_order ?? 0,
        import_batch_id: r.import_batch_id ?? null,
        created_at:      r.created_at,
        updated_at:      r.updated_at,
        status:          status ? { id: status.id, name: status.name, color_hex: status.color_hex } : null,
      };
    });

    return NextResponse.json({ data: rows, total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error("[GET /api/bajaj/work-orders]", err);
    return NextResponse.json({ error: "Failed to fetch work orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json() as { moduleSlug?: string; data?: Record<string, unknown> } & Record<string, unknown>;
    const moduleSlug = String(body.moduleSlug ?? body.module_slug ?? "").toLowerCase();
    const data       = (body.data ?? {}) as Record<string, unknown>;

    if (!moduleSlug) return NextResponse.json({ error: "moduleSlug required" }, { status: 400 });
    if (!data.wo)    return NextResponse.json({ error: "data.wo (work order number) required" }, { status: 400 });

    const sb = createAdminClient();
    const { data: mod } = await sb
      .from("bajaj_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .single();

    if (!mod) return NextResponse.json({ error: `Unknown module: ${moduleSlug}` }, { status: 400 });

    // Default status to "Planning" (display_order 0) for the module
    const { data: firstStatus } = await sb
      .from("bajaj_statuses")
      .select("id")
      .eq("module_id", mod.id)
      .order("display_order")
      .limit(1)
      .single();

    const { data: inserted, error } = await sb
      .from("bajaj_work_orders")
      .insert({
        module_id:   mod.id,
        module_slug: moduleSlug,
        status_id:   firstStatus?.id ?? null,
        data,
      })
      .select("id, module_id, module_slug, status_id, data, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/work-orders]", err);
    return NextResponse.json({ error: "Failed to create work order" }, { status: 500 });
  }
}
