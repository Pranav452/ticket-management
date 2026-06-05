/**
 * POST /api/bajaj/auto-progression/apply  (admin only)
 * Body: { module_slug: string }
 *
 * Scans all work orders in the module, applies auto-progression rules
 * retroactively: if trigger_field is present and WO is currently at a
 * lower lifecycle stage than target_status_name, move it forward.
 *
 * Returns: { moved: number; details: { wo_number: string; from: string; to: string }[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

export async function POST(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!(await isAdminEmail(actorEmail)))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { module_slug } = await req.json() as { module_slug: string };
  if (!module_slug)
    return NextResponse.json({ error: "module_slug required" }, { status: 400 });

  const sb = createAdminClient();

  // 1. Load module
  const { data: mod } = await sb
    .from("bajaj_modules")
    .select("id")
    .eq("slug", module_slug)
    .maybeSingle();
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  // 2. Load statuses with display_order
  const { data: statuses } = await sb
    .from("bajaj_statuses")
    .select("id, name, display_order")
    .eq("module_id", mod.id)
    .order("display_order");
  if (!statuses?.length)
    return NextResponse.json({ error: "No statuses found" }, { status: 404 });

  // 3. Load auto-progression rules
  const { data: rules } = await sb
    .from("bajaj_auto_progression")
    .select("trigger_field, target_status_name")
    .eq("module_slug", module_slug);
  if (!rules?.length)
    return NextResponse.json({ moved: 0, details: [] });

  // 4. Load all work orders for module
  const { data: workOrders, error: woErr } = await sb
    .from("bajaj_work_orders")
    .select("id, wo_number, status_id, data")
    .eq("module_id", mod.id);
  if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 });
  if (!workOrders?.length)
    return NextResponse.json({ moved: 0, details: [] });

  const details: { wo_number: string; from: string; to: string }[] = [];

  for (const wo of workOrders) {
    const woData = (wo.data as Record<string, unknown>) ?? {};
    const currentStatus = statuses.find(s => s.id === wo.status_id);
    const currentOrder = currentStatus?.display_order ?? -1;

    // Find the HIGHEST target stage triggered by this WO's filled fields
    let bestTargetId: string | null = null;
    let bestTargetName = "";
    let bestOrder = -1;

    for (const rule of rules) {
      if (!present(woData[rule.trigger_field])) continue;

      const target = statuses.find(
        s => s.name.toLowerCase().trim() === rule.target_status_name.toLowerCase().trim()
      );
      if (!target) continue;

      // Only advance forward, never backward
      if (target.display_order <= currentOrder) continue;
      if (target.display_order > bestOrder) {
        bestOrder = target.display_order;
        bestTargetId = target.id;
        bestTargetName = target.name;
      }
    }

    if (!bestTargetId) continue;

    // Move the card
    const { error: updateErr } = await sb
      .from("bajaj_work_orders")
      .update({ status_id: bestTargetId })
      .eq("id", wo.id);

    if (updateErr) continue; // skip failed, don't abort whole batch

    details.push({
      wo_number: wo.wo_number ?? wo.id,
      from: currentStatus?.name ?? "Unknown",
      to: bestTargetName,
    });
  }

  return NextResponse.json({ moved: details.length, details });
}
