/**
 * GET   /api/bajaj/work-orders/[id]
 * PATCH /api/bajaj/work-orders/[id]  { status_id?, column_order?, data?, force? }
 *
 * Business rules enforced here:
 *  1. Required-field gate — destination column may require fields to be filled
 *  2. Billing prerequisites — blno + sbno + edoc must exist before entering Billing
 *  3. Invoice auto-complete — LINKS WOs auto-move to Completed when invoice_no is set
 *  4. BL 48-hour alert — fires after any save if sailing date passed 48h with no BL
 *  5. SI Cutoff escalation — fires after save if SI cutoff passed and SI not filed
 *  6. HAZ container restriction — HAZ WOs cannot share containers with non-HAZ (hard block)
 *  7. Column auto-assignment — single assignee auto-populated on stage move
 *  8. Admin-configurable field→stage auto-progression
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkColumnAccess, getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";
import { validateWorkOrderRules } from "@/lib/bajaj/validation";
import {
  getStatusName,
  getStatusIdByName,
  checkRequiredFieldsForMove,
  checkBillingPrerequisites,
  checkInvoiceAutoComplete,
  checkBL48hrAlert,
  checkSICutoffAlert,
  checkHAZContainerRule,
  autoAssignColumnOwner,
  checkAutoProgressionRules,
  STATUS_BILLING,
} from "@/lib/bajaj/workflow";

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
      force?:        boolean;
    };

    const actorEmail = await getCurrentUserEmail();
    const sb         = createAdminClient();
    const force      = body.force === true;

    // ── Fetch current WO (needed for multiple checks below) ─────────────────
    const { data: currentWO } = await sb
      .from("bajaj_work_orders")
      .select("module_id, module_slug, status_id, data")
      .eq("id", id)
      .single();

    const moduleSlug  = currentWO?.module_slug ?? "";
    const moduleId    = currentWO?.module_id   ?? "";
    const curStatusId = currentWO?.status_id   ?? null;
    const prevData    = (currentWO?.data ?? {}) as Record<string, unknown>;

    // Merged WO data for checks (prev + incoming)
    const mergedData: Record<string, unknown> = {
      ...prevData,
      ...(body.data ?? {}),
    };

    // ── Permission check for non-admins ─────────────────────────────────────
    if (!(await isAdminEmail(actorEmail))) {
      if (moduleSlug) {
        if ("data" in body) {
          const perm = await checkColumnAccess("can_edit", moduleSlug, curStatusId);
          if (!perm.allowed)
            return NextResponse.json({ error: perm.reason ?? "Not assigned to this column" }, { status: 403 });
        }
        if ("status_id" in body && body.status_id) {
          const perm = await checkColumnAccess("can_move", moduleSlug, body.status_id);
          if (!perm.allowed)
            return NextResponse.json({ error: perm.reason ?? "Cannot move to target column" }, { status: 403 });
        }
      }
    }

    // ── Container / vessel business rule validation ──────────────────────────
    if (body.data && !force) {
      const newData     = body.data;
      const containerno = String(newData["containerno"] ?? newData["container_no"] ?? "");
      const vslname     = String(newData["vslname"]     ?? "");
      const assy_config = String(newData["assy_config"] ?? "");

      if (containerno || vslname) {
        let country = String(newData["country"] ?? prevData["country"] ?? "");
        if (!country && moduleSlug === "srilanka") country = "Sri Lanka";

        const warnings = await validateWorkOrderRules(sb, [{
          country, containerno: containerno || null,
          vslname: vslname || null, assy_config: assy_config || null,
          excludeId: id,
        }]);
        if (warnings.length > 0)
          return NextResponse.json({ warnings, requiresForce: true }, { status: 409 });
      }

      // ── HAZ container restriction (hard block — no force override) ─────────
      const incomingContainerno = String(body.data["containerno"] ?? body.data["container_no"] ?? prevData["containerno"] ?? "");
      const hazRaw = body.data["haz"] ?? prevData["haz"];
      const isHAZ  = hazRaw === true || hazRaw === 1 || hazRaw === "true" || hazRaw === "1";

      if (incomingContainerno) {
        const hazCheck = await checkHAZContainerRule(sb, id, incomingContainerno, isHAZ);
        if (hazCheck.blocked) {
          return NextResponse.json({
            error:         hazCheck.reason,
            requiresForce: false, // hard block — HAZ safety cannot be overridden
          }, { status: 422 });
        }
      }
    }

    // ── Required-field gate (column move) ────────────────────────────────────
    if ("status_id" in body && body.status_id && !force) {
      const targetStatusName = await getStatusName(sb, body.status_id);

      // Required fields defined by admin for the destination column
      const reqCheck = await checkRequiredFieldsForMove(
        sb, moduleSlug, targetStatusName, mergedData
      );
      if (reqCheck.blocked) {
        return NextResponse.json({
          error:    `Cannot move to "${targetStatusName}" — required fields missing.`,
          missing:  reqCheck.missing,
          requiresForce: true,
        }, { status: 422 });
      }

      // Billing-specific prerequisites (hard-coded business rule)
      if (targetStatusName.includes(STATUS_BILLING)) {
        const billCheck = checkBillingPrerequisites(mergedData);
        if (billCheck.blocked) {
          return NextResponse.json({
            error:   `Cannot move to Billing — prerequisites not met.`,
            missing: billCheck.missing,
            requiresForce: false, // billing prereqs are HARD blocks — no override
          }, { status: 422 });
        }
      }
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const updates: Record<string, unknown> = {};

    if ("status_id"    in body) updates.status_id    = body.status_id ?? null;
    if ("column_order" in body) updates.column_order = body.column_order;

    if (body.data && Object.keys(body.data).length > 0) {
      updates.data = mergedData;
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ success: true });

    const { error } = await sb
      .from("bajaj_work_orders")
      .update(updates)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Post-save: column auto-assignment (on stage move) ───────────────────
    let autoAssignedTo: string | null = null;
    if ("status_id" in body && body.status_id && moduleSlug) {
      autoAssignedTo = await autoAssignColumnOwner(
        sb, id, moduleSlug, body.status_id, mergedData
      ).catch(e => { console.warn("[AutoAssign]", e); return null; });
    }

    // ── Post-save: invoice auto-complete (LINKS only) ────────────────────────
    let autoMovedTo: string | null = null;
    if (body.data && moduleId) {
      const completedStatusId = await checkInvoiceAutoComplete(
        sb, moduleId, body.data, prevData
      );
      if (completedStatusId && completedStatusId !== curStatusId) {
        await sb
          .from("bajaj_work_orders")
          .update({ status_id: completedStatusId })
          .eq("id", id);
        autoMovedTo = completedStatusId;

        await sb.from("bajaj_audit_logs").insert({
          actor_email: "system",
          action:      "moved_card",
          target_type: "work_order",
          target_id:   id,
          new_value:   { status_id: completedStatusId, reason: "invoice_no set — auto-completed" },
        });
      }
    }

    // ── Post-save: admin-configurable field→stage auto-progression ───────────
    // Only run if no auto-move has already happened this save (avoid double-moves)
    if (!autoMovedTo && body.data && moduleId) {
      const progressionResult = await checkAutoProgressionRules(
        sb, id, moduleId, moduleSlug, curStatusId, body.data, prevData
      ).catch(e => { console.warn("[AutoProgression]", e); return null; });
      if (progressionResult) {
        autoMovedTo = progressionResult.autoMovedTo;
      }
    }

    // ── Post-save: BL 48-hour alert (async, non-blocking) ───────────────────
    if (body.data) {
      checkBL48hrAlert(sb, id, moduleSlug, mergedData).catch(e =>
        console.warn("[BL48hr]", e)
      );
    }

    // ── Post-save: SI cutoff escalation (async, non-blocking) ───────────────
    if (body.data) {
      checkSICutoffAlert(sb, id, moduleSlug, mergedData).catch(e =>
        console.warn("[SICutoff]", e)
      );
    }

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

    return NextResponse.json({ success: true, autoMovedTo, autoAssignedTo });
  } catch (err) {
    console.error("[PATCH /api/bajaj/work-orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}
