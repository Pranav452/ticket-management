/**
 * GET   /api/bajaj/work-orders/[id]
 * PATCH /api/bajaj/work-orders/[id]  { status_id?, column_order?, data? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkColumnAccess, getCurrentUserEmail, isAdmin } from "@/lib/bajaj/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = createAdminClient();

    const { data, error } = await sb
      .from("bajaj_work_orders")
      .select(`
        id, module_id, module_slug, status_id, data, column_order,
        import_batch_id, created_at, updated_at,
        bajaj_statuses ( id, name, color_hex, display_order )
      `)
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = Array.isArray(data.bajaj_statuses)
      ? data.bajaj_statuses[0]
      : data.bajaj_statuses;

    return NextResponse.json({
      id:              data.id,
      module_id:       data.module_id,
      module_slug:     data.module_slug,
      status_id:       data.status_id ?? null,
      data:            data.data ?? {},
      column_order:    data.column_order ?? 0,
      import_batch_id: data.import_batch_id ?? null,
      created_at:      data.created_at,
      updated_at:      data.updated_at,
      status:          status ? { id: status.id, name: status.name, color_hex: status.color_hex } : null,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch work order" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      status_id?:    string | null;
      column_order?: number;
      data?:         Record<string, unknown>;
    };

    const actorEmail = await getCurrentUserEmail();
    const sb = createAdminClient();

    // ── Permission check for non-admins ─────────────────────────────────────
    if (!isAdmin(actorEmail)) {
      const { data: wo } = await sb
        .from("bajaj_work_orders")
        .select("module_slug, status_id")
        .eq("id", id)
        .single();

      const moduleSlug   = wo?.module_slug ?? null;
      const curStatusId  = wo?.status_id   ?? null;

      if (moduleSlug) {
        if ("data" in body) {
          const perm = await checkColumnAccess("can_edit", moduleSlug, curStatusId);
          if (!perm.allowed) return NextResponse.json({ error: perm.reason ?? "Not assigned to this column" }, { status: 403 });
        }
        if ("status_id" in body && body.status_id) {
          const perm = await checkColumnAccess("can_move", moduleSlug, body.status_id);
          if (!perm.allowed) return NextResponse.json({ error: perm.reason ?? "Cannot move to target column" }, { status: 403 });
        }
      }
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const updates: Record<string, unknown> = {};

    if ("status_id"    in body) updates.status_id    = body.status_id    ?? null;
    if ("column_order" in body) updates.column_order = body.column_order;

    // Merge data fields into existing JSONB using Supabase's jsonb concat
    if (body.data && Object.keys(body.data).length > 0) {
      // Fetch current data first so we can merge
      const { data: current } = await sb
        .from("bajaj_work_orders")
        .select("data")
        .eq("id", id)
        .single();

      updates.data = { ...(current?.data as Record<string, unknown> ?? {}), ...body.data };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await sb
      .from("bajaj_work_orders")
      .update(updates)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Audit log ────────────────────────────────────────────────────────────
    const action = "status_id" in body ? "moved_card"
                 : "data"      in body ? "edited_field"
                 : "work_order.update";

    await sb.from("bajaj_audit_logs").insert({
      actor_email: actorEmail ?? "system",
      action,
      target_type: "work_order",
      target_id:   id,
      new_value:   body,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}
