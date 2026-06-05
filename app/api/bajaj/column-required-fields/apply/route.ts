/**
 * POST /api/bajaj/column-required-fields/apply  (admin only)
 * Body: { module_slug: string } | { all: true }
 *
 * For each work order, determines the correct column by walking the lifecycle
 * order and finding the HIGHEST column whose cumulative required fields are
 * ALL filled on the card. Moves the card there.
 *
 * Cumulative: column N requires every field required by columns 1..N.
 * If even one field is missing for column N, card stays at N-1.
 *
 * Returns: { moved: number; details: { wo_number, from, to }[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";

const LIFECYCLE_ORDER = [
  "Planning",
  "Booking Request",
  "Booking",
  "Container Allocation",
  "SI Filing",
  "Custom Clearance",
  "Gate Open",
  "Billing",
  "BL Release",
  "Completed",
];

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

async function applyToModule(
  sb: ReturnType<typeof createAdminClient>,
  moduleSlug: string
): Promise<{ wo_number: string; from: string; to: string }[]> {
  // Load module
  const { data: mod } = await sb
    .from("bajaj_modules")
    .select("id")
    .eq("slug", moduleSlug)
    .maybeSingle();
  if (!mod) return [];

  // Load statuses (id + name)
  const { data: statuses } = await sb
    .from("bajaj_statuses")
    .select("id, name, display_order")
    .eq("module_id", mod.id)
    .order("display_order");
  if (!statuses?.length) return [];

  // Build name→id map
  const statusByName = Object.fromEntries(
    statuses.map(s => [s.name.toLowerCase().trim(), s])
  );

  // Load all required field rules for module
  const { data: rawRules } = await sb
    .from("bajaj_column_required_fields")
    .select("status_name, field_key")
    .eq("module_slug", moduleSlug);

  // Group rules by column name (lowercase)
  const rulesByColumn: Record<string, string[]> = {};
  for (const r of rawRules ?? []) {
    const key = r.status_name.toLowerCase().trim();
    if (!rulesByColumn[key]) rulesByColumn[key] = [];
    rulesByColumn[key].push(r.field_key);
  }

  // Build cumulative required fields per lifecycle position
  // cumulativeRequired[i] = all fields that must be present to be IN column i
  const cumulative: string[][] = [];
  let running: string[] = [];
  for (const colName of LIFECYCLE_ORDER) {
    const key = colName.toLowerCase().trim();
    const colFields = rulesByColumn[key] ?? [];
    running = [...running, ...colFields];
    cumulative.push([...running]);
  }

  // Load all work orders
  const { data: workOrders } = await sb
    .from("bajaj_work_orders")
    .select("id, wo_number, status_id, data")
    .eq("module_id", mod.id);
  if (!workOrders?.length) return [];

  const moved: { wo_number: string; from: string; to: string }[] = [];

  for (const wo of workOrders) {
    const woData = (wo.data as Record<string, unknown>) ?? {};
    const currentStatus = statuses.find(s => s.id === wo.status_id);

    // Walk lifecycle from end to start — find highest column where all cumulative fields filled
    let targetIndex = 0; // default: Planning (index 0)
    for (let i = LIFECYCLE_ORDER.length - 1; i >= 0; i--) {
      const required = cumulative[i];
      if (required.every(f => present(woData[f]))) {
        targetIndex = i;
        break;
      }
    }

    const targetName = LIFECYCLE_ORDER[targetIndex];
    const targetStatus = statusByName[targetName.toLowerCase().trim()];
    if (!targetStatus) continue;

    // Skip if already in correct column
    if (wo.status_id === targetStatus.id) continue;

    const { error } = await sb
      .from("bajaj_work_orders")
      .update({ status_id: targetStatus.id })
      .eq("id", wo.id);

    if (error) continue;

    moved.push({
      wo_number: wo.wo_number ?? wo.id,
      from: currentStatus?.name ?? "Unknown",
      to: targetName,
    });
  }

  return moved;
}

export async function POST(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!(await isAdminEmail(actorEmail)))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json() as { module_slug?: string; all?: boolean };

  const sb = createAdminClient();
  const allDetails: { wo_number: string; from: string; to: string }[] = [];

  if (body.all) {
    const { data: modules } = await sb
      .from("bajaj_modules")
      .select("slug")
      .order("display_order");

    for (const mod of modules ?? []) {
      const details = await applyToModule(sb, mod.slug);
      allDetails.push(...details);
    }
  } else {
    if (!body.module_slug)
      return NextResponse.json({ error: "module_slug or all required" }, { status: 400 });
    const details = await applyToModule(sb, body.module_slug);
    allDetails.push(...details);
  }

  return NextResponse.json({ moved: allDetails.length, details: allDetails });
}
