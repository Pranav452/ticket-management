/**
 * Workflow engine for Bajaj work orders.
 *
 * Handles:
 *  - Auto-progression rules (invoice_no → Completed, admin-configurable field→stage)
 *  - Billing prerequisite gate
 *  - Required-field gate before column move
 *  - BL 48-hour sailing alert
 *  - SI cutoff escalation alert
 *  - HAZ container restriction
 *  - Column auto-assignment on card move
 *  - Notification helpers (column assignee + superadmins)
 */

import { SupabaseClient } from "@supabase/supabase-js";

/* ─── Status name constants ─────────────────────────────────────────────────── */
export const STATUS_BILLING   = "billing";
export const STATUS_COMPLETED = "completed";
export const STATUS_BL_RELEASE = "bl release";

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function normName(name: string) {
  return name.trim().toLowerCase();
}

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s !== "null" && s !== "0";
}

/* ─── Resolve status name from ID ───────────────────────────────────────────── */
export async function getStatusName(sb: SupabaseClient, statusId: string): Promise<string> {
  const { data } = await sb
    .from("bajaj_statuses")
    .select("name")
    .eq("id", statusId)
    .single();
  return normName(data?.name ?? "");
}

/* ─── Resolve status ID from name (for auto-move) ───────────────────────────── */
export async function getStatusIdByName(
  sb: SupabaseClient,
  moduleId: string,
  targetName: string
): Promise<string | null> {
  const { data } = await sb
    .from("bajaj_statuses")
    .select("id, name")
    .eq("module_id", moduleId);

  const match = (data ?? []).find(s => normName(s.name).includes(normName(targetName)));
  return match?.id ?? null;
}

/* ─── Get superadmin emails ─────────────────────────────────────────────────── */
export async function getSuperAdminEmails(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb
    .from("bajaj_users")
    .select("email")
    .eq("role", "superadmin")
    .eq("status", "approved");
  return (data ?? []).map(u => u.email);
}

/* ─── Get column assignee emails ────────────────────────────────────────────── */
export async function getColumnAssigneeEmails(
  sb: SupabaseClient,
  moduleSlug: string,
  statusId: string
): Promise<string[]> {
  const { data } = await sb
    .from("bajaj_column_assignments")
    .select("user_email")
    .eq("module_slug", moduleSlug)
    .eq("status_id", statusId);
  return (data ?? []).map(a => a.user_email).filter(Boolean);
}

/* ─── Send notification via /api/bajaj/notify ───────────────────────────────── */
export async function sendAlert(opts: {
  to: string[];
  subject: string;
  message: string;
  workOrderId: string;
  workOrderSummary: string;
  senderName?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticket-management-sooty.vercel.app";
  for (const email of opts.to) {
    try {
      await fetch(`${baseUrl}/api/bajaj/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:               email,
          subject:          opts.subject,
          message:          opts.message,
          workOrderId:      opts.workOrderId,
          workOrderSummary: opts.workOrderSummary,
          senderName:       opts.senderName ?? "System",
        }),
      });
    } catch {
      // non-fatal — log and continue
      console.warn(`[sendAlert] Failed to notify ${email}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 1 — Required-field gate before column move
   Returns error string if blocked, null if allowed.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkRequiredFieldsForMove(
  sb: SupabaseClient,
  moduleSlug: string,
  targetStatusName: string,
  woData: Record<string, unknown>
): Promise<{ blocked: boolean; missing: string[] }> {
  const { data: rules } = await sb
    .from("bajaj_column_required_fields")
    .select("field_key")
    .eq("module_slug", moduleSlug)
    .ilike("status_name", `%${targetStatusName.trim()}%`);

  if (!rules?.length) return { blocked: false, missing: [] };

  const missing = rules
    .map(r => r.field_key)
    .filter(key => !present(woData[key]));

  return { blocked: missing.length > 0, missing };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 2 — Billing prerequisites gate
   BL number + SB number + E-doc must all be present before entering Billing.
   ═══════════════════════════════════════════════════════════════════════════════ */
export function checkBillingPrerequisites(
  woData: Record<string, unknown>
): { blocked: boolean; missing: string[] } {
  const checks: [string, string][] = [
    ["blno",   "BL Number"],
    ["sbno",   "SB Number"],
    ["edoc",   "E-Document"],
  ];

  const missing = checks
    .filter(([key]) => !present(woData[key]))
    .map(([, label]) => label);

  return { blocked: missing.length > 0, missing };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 3 — Links invoice auto-complete
   If agent = LINKS and invoice_no is newly set, auto-move to Completed.
   Returns the completed status_id if triggered, null otherwise.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkInvoiceAutoComplete(
  sb: SupabaseClient,
  moduleId: string,
  newData:  Record<string, unknown>,
  prevData: Record<string, unknown>
): Promise<string | null> {
  const agent      = String(newData["agent"] ?? prevData["agent"] ?? "").trim().toUpperCase();
  const invoiceNew = String(newData["invoice_no"] ?? "").trim();
  const invoiceOld = String(prevData["invoice_no"] ?? "").trim();

  // Only trigger for LINKS, only when invoice_no is NEWLY added (was empty before)
  if (agent !== "LINKS") return null;
  if (!invoiceNew || invoiceOld) return null;

  const completedId = await getStatusIdByName(sb, moduleId, STATUS_COMPLETED);
  return completedId;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 4 — BL 48-hour sailing alert
   Called after any field save. If sailingdt is set and blno is still empty,
   AND sailing date is within the past 48 hours → alert.
   Notifies column assignees of BL Release column + all superadmins.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkBL48hrAlert(
  sb: SupabaseClient,
  workOrderId: string,
  moduleSlug: string,
  woData: Record<string, unknown>
): Promise<void> {
  const blno      = String(woData["blno"]      ?? "").trim();
  const sailingdt = String(woData["sailingdt"] ?? "").trim();
  const woNo      = String(woData["wo"]        ?? workOrderId);

  // Skip if BL already present
  if (blno) return;
  // Skip if no sailing date
  if (!sailingdt) return;

  // Parse sailing date — handles "DD-Mon", "YYYY-MM-DD", "DD/MM/YYYY"
  const sailing = parseDateString(sailingdt);
  if (!sailing) return;

  const now      = Date.now();
  const diff     = now - sailing.getTime();
  const hrs48    = 48 * 60 * 60 * 1000;

  // Alert if sailing was between 0 and 48 hours ago AND BL still missing
  if (diff < 0 || diff > hrs48) return;

  // Resolve BL Release column to get assignees
  const { data: statuses } = await sb
    .from("bajaj_statuses")
    .select("id, name")
    .eq("module_id", (await sb.from("bajaj_work_orders").select("module_id").eq("id", workOrderId).single()).data?.module_id ?? "");

  const blReleaseStatus = (statuses ?? []).find(s => normName(s.name).includes(STATUS_BL_RELEASE));

  const assigneeEmails = blReleaseStatus
    ? await getColumnAssigneeEmails(sb, moduleSlug, blReleaseStatus.id)
    : [];
  const superAdminEmails = await getSuperAdminEmails(sb);

  const recipients = Array.from(new Set([...assigneeEmails, ...superAdminEmails]));
  if (!recipients.length) return;

  const hoursAgo = Math.round(diff / (60 * 60 * 1000));
  await sendAlert({
    to:               recipients,
    subject:          `⚠️ BL Release Overdue — WO ${woNo}`,
    message:          `Work order <strong>${woNo}</strong> sailed ${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago but the BL number has not been released yet.<br><br>Sailing date: <strong>${sailingdt}</strong><br>BL Number: <em>Not yet added</em><br><br>Please release the BL immediately to avoid delays.`,
    workOrderId,
    workOrderSummary: `WO ${woNo}`,
    senderName:       "Bajaj Workflow Engine",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 5 — SI Cutoff escalation
   If current date > SI cutoff AND SI has NOT been filed (si_filed / sifiling is
   falsy), alert the column assignees of "SI Filing" column + all superadmins.
   Safe to call on every save — deduped by checking if already alerted this day
   via bajaj_audit_logs.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkSICutoffAlert(
  sb: SupabaseClient,
  workOrderId: string,
  moduleSlug: string,
  woData: Record<string, unknown>
): Promise<void> {
  const woNo      = String(woData["wo"] ?? workOrderId);
  const siFiled   = present(woData["si_filed"]) || present(woData["sifiling"]) || present(woData["sifile"]);
  const sicutoff  = String(woData["sicutoff"] ?? woData["si_cutoff"] ?? "").trim();

  // Skip if SI already filed or no cutoff date configured
  if (siFiled || !sicutoff) return;

  const cutoff = parseDateString(sicutoff);
  if (!cutoff) return;

  // Only alert if cutoff has PASSED (strict past)
  if (Date.now() <= cutoff.getTime()) return;

  // Dedup: skip if we already fired this alert for this WO today
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: existing } = await sb
    .from("bajaj_audit_logs")
    .select("id")
    .eq("target_type", "work_order")
    .eq("target_id", workOrderId)
    .eq("action", "si_cutoff_alert")
    .gte("created_at", `${today}T00:00:00Z`)
    .limit(1);

  if (existing?.length) return; // already sent today

  // Resolve SI Filing column
  const { data: wo } = await sb
    .from("bajaj_work_orders")
    .select("module_id")
    .eq("id", workOrderId)
    .single();

  const { data: statuses } = await sb
    .from("bajaj_statuses")
    .select("id, name")
    .eq("module_id", wo?.module_id ?? "");

  const siFiling = (statuses ?? []).find(s => normName(s.name).includes("si filing") || normName(s.name).includes("si_filing"));

  const assigneeEmails = siFiling
    ? await getColumnAssigneeEmails(sb, moduleSlug, siFiling.id)
    : [];
  const superAdminEmails = await getSuperAdminEmails(sb);
  const recipients = Array.from(new Set([...assigneeEmails, ...superAdminEmails]));

  if (recipients.length) {
    const daysOverdue = Math.floor((Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000));
    await sendAlert({
      to:               recipients,
      subject:          `🚨 SI Cutoff Missed — WO ${woNo}`,
      message:          `Work order <strong>${woNo}</strong> has passed its SI cutoff date and SI has <strong>not</strong> been filed yet.<br><br>SI Cutoff: <strong>${sicutoff}</strong><br>Overdue by: <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong><br><br>Please file the Shipping Instruction immediately to avoid vessel booking cancellation.`,
      workOrderId,
      workOrderSummary: `WO ${woNo}`,
      senderName:       "Bajaj Workflow Engine",
    });
  }

  // Log so we don't re-alert today
  await sb.from("bajaj_audit_logs").insert({
    actor_email: "system@workflow",
    action:      "si_cutoff_alert",
    target_type: "work_order",
    target_id:   workOrderId,
    new_value:   { wo: woNo, sicutoff, daysOverdue: Math.floor((Date.now() - cutoff.getTime()) / 86400000) },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 6 — HAZ container restriction
   If the work order has haz = true/1/"true"/"1", it must travel in a dedicated
   HAZ-only container. It cannot share a container number with any non-HAZ WO,
   and a non-HAZ WO cannot be assigned a container already used by a HAZ WO.

   Returns { blocked: true, reason } when the constraint is violated.
   Called from the PATCH route when containerno or haz is updated.
   Scoped to: all modules (HAZ is a global safety rule, not country-specific).
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkHAZContainerRule(
  sb: SupabaseClient,
  workOrderId: string,
  containerno: string,
  isHAZ: boolean
): Promise<{ blocked: boolean; reason?: string }> {
  if (!containerno.trim()) return { blocked: false };

  // Find any OTHER WOs that share at least one container number
  const { data: others } = await sb
    .from("bajaj_work_orders")
    .select("id, data")
    .neq("id", workOrderId);

  const containers = containerno
    .split(/[\s,;/]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  for (const wo of others ?? []) {
    const d = wo.data as Record<string, unknown>;
    const otherContainers = String(d["containerno"] ?? d["container_no"] ?? "")
      .split(/[\s,;/]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const shared = containers.filter(c => otherContainers.includes(c));
    if (!shared.length) continue;

    const otherHAZ = d["haz"] === true || d["haz"] === 1 || d["haz"] === "true" || d["haz"] === "1";
    const woNo     = String(d["wo"] ?? wo.id);

    if (isHAZ && !otherHAZ) {
      return {
        blocked: true,
        reason:  `HAZ work order cannot share container(s) ${shared.join(", ")} with non-HAZ work order ${woNo}. HAZ cargo requires a dedicated container.`,
      };
    }
    if (!isHAZ && otherHAZ) {
      return {
        blocked: true,
        reason:  `Container(s) ${shared.join(", ")} already assigned to HAZ work order ${woNo}. Non-HAZ cargo cannot share a HAZ-dedicated container.`,
      };
    }
  }

  return { blocked: false };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 7 — Column auto-assignment on card move
   When a card is moved to a new column, look up bajaj_column_assignments for
   that column (module_slug + status_id). If exactly one user is assigned with
   can_edit = true AND the WO's data doesn't already have an "assigned_to" value
   for that column, auto-populate data.assigned_to with that user's email.
   If multiple users are assigned, leave it alone (ambiguous — human decides).
   Returns the email that was auto-assigned, or null if nothing changed.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function autoAssignColumnOwner(
  sb: SupabaseClient,
  workOrderId: string,
  moduleSlug: string,
  newStatusId: string,
  currentData: Record<string, unknown>
): Promise<string | null> {
  const { data: assignments } = await sb
    .from("bajaj_column_assignments")
    .select("user_email, can_edit")
    .eq("module_slug", moduleSlug)
    .eq("status_id", newStatusId)
    .eq("can_edit", true);

  if (!assignments?.length) return null;

  // Resolve the status name so we can store "assigned_to_<stage>" per stage
  const { data: statusRow } = await sb
    .from("bajaj_statuses")
    .select("name")
    .eq("id", newStatusId)
    .single();

  const stageName  = (statusRow?.name ?? "unknown").toLowerCase().replace(/\s+/g, "_");
  const assignKey  = `assigned_to_${stageName}`;

  // Skip if already manually set for this stage
  if (present(currentData[assignKey])) return null;

  // Only auto-assign when exactly one editor is on the column (no ambiguity)
  if (assignments.length !== 1) return null;

  const email = assignments[0].user_email;

  await sb
    .from("bajaj_work_orders")
    .update({ data: { ...currentData, [assignKey]: email } })
    .eq("id", workOrderId);

  await sb.from("bajaj_audit_logs").insert({
    actor_email: "system@workflow",
    action:      "auto_assigned",
    target_type: "work_order",
    target_id:   workOrderId,
    new_value:   { [assignKey]: email, stage: stageName },
  });

  return email;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE 8 — Admin-configurable field → stage auto-progression
   Reads bajaj_auto_progression table (module_slug, trigger_field, target_status_name).
   After any field save, checks each rule: if trigger_field is now present (non-empty)
   and was previously empty, auto-moves the WO to target_status_name IF the WO is
   currently at a lower lifecycle stage (never moves backwards).

   Falls back gracefully — if the table doesn't exist yet, returns [].
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkAutoProgressionRules(
  sb: SupabaseClient,
  workOrderId: string,
  moduleId: string,
  moduleSlug: string,
  currentStatusId: string | null,
  newData: Record<string, unknown>,
  prevData: Record<string, unknown>
): Promise<{ autoMovedTo: string; targetStatusName: string } | null> {
  // Load all auto-progression rules for this module
  let rules: { trigger_field: string; target_status_name: string }[] = [];
  try {
    const { data, error } = await sb
      .from("bajaj_auto_progression")
      .select("trigger_field, target_status_name")
      .eq("module_slug", moduleSlug);
    if (!error && data) rules = data;
  } catch {
    return null; // table may not exist — silent fail
  }

  if (!rules.length) return null;

  // Get all statuses for this module so we can compare display_order
  const { data: allStatuses } = await sb
    .from("bajaj_statuses")
    .select("id, name, display_order")
    .eq("module_id", moduleId);

  if (!allStatuses?.length) return null;

  const currentStatus = currentStatusId
    ? allStatuses.find(s => s.id === currentStatusId)
    : null;
  const currentOrder = currentStatus?.display_order ?? -1;

  // Evaluate each rule — take the HIGHEST target stage that is triggered
  let bestTargetId: string | null = null;
  let bestTargetName = "";
  let bestOrder = -1;

  for (const rule of rules) {
    const field    = rule.trigger_field;
    const wasEmpty = !present(prevData[field]);
    const isNowSet = present(newData[field] ?? prevData[field]);

    // Only trigger when field transitions from empty → filled
    if (!wasEmpty || !isNowSet) continue;

    const target = allStatuses.find(
      s => normName(s.name).includes(normName(rule.target_status_name))
    );
    if (!target) continue;

    // Never move backwards
    if (target.display_order <= currentOrder) continue;

    if (target.display_order > bestOrder) {
      bestOrder      = target.display_order;
      bestTargetId   = target.id;
      bestTargetName = target.name;
    }
  }

  if (!bestTargetId) return null;

  // Apply the move
  await sb
    .from("bajaj_work_orders")
    .update({ status_id: bestTargetId })
    .eq("id", workOrderId);

  await sb.from("bajaj_audit_logs").insert({
    actor_email: "system@workflow",
    action:      "auto_progression",
    target_type: "work_order",
    target_id:   workOrderId,
    new_value:   { status_id: bestTargetId, target: bestTargetName, reason: "field trigger" },
  });

  return { autoMovedTo: bestTargetId, targetStatusName: bestTargetName };
}

/* ── Date parser — handles multiple formats ops use ─────────────────────────── */
function parseDateString(s: string): Date | null {
  if (!s) return null;
  // ISO: 2025-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
  // DD-Mon (e.g. "15-Jan") — assume current year
  const dmon = s.match(/^(\d{1,2})-([A-Za-z]{3})/);
  if (dmon) return new Date(`${dmon[2]} ${dmon[1]} ${new Date().getFullYear()}`);
  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
