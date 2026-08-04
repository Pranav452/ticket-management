/**
 * Workflow engine for Bajaj work orders.
 *
 * The Google Sheet is the single source of truth for card movement
 * (lib/bajaj/sheet-sync.ts) — the old column-assignment / required-field /
 * auto-progression machinery is gone. What remains here:
 *  - LINKS invoice auto-complete (invoice_no → Completed)
 *  - BL 48-hour sailing alert
 *  - SI cutoff escalation alert
 *  - HAZ container restriction
 *  - Notification helpers (all admins + superadmins)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, sendNotifyEmail } from "@/lib/email/notify";

/* ─── Status name constants ─────────────────────────────────────────────────── */
export const STATUS_COMPLETED = "completed";

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function normName(name: string) {
  return name.trim().toLowerCase();
}

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s !== "null" && s !== "0";
}

/** True when a HAZ flag value is affirmative. The Google Sheet sync writes
 * "YES"/"NO" strings; legacy manual data used booleans/1/"true". */
export function isHazValue(v: unknown): boolean {
  if (v === true || v === 1) return true;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "TRUE" || s === "1" || s === "YES";
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

/* ─── Get alert recipients — ALL approved admins + superadmins ──────────────── */
export async function getAdminAlertEmails(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb
    .from("bajaj_users")
    .select("email")
    .in("role", ["admin", "superadmin"])
    .eq("status", "approved");
  return (data ?? []).map(u => u.email);
}

/* ─── Send notification emails (shared Resend sender) ───────────────────────── */
export async function sendAlert(opts: {
  to: string[];
  subject: string;
  message: string;
  workOrderId: string;
  workOrderSummary: string;
  senderName?: string;
}) {
  // Send directly via the shared Resend sender — NOT by HTTP-fetching
  // /api/bajaj/notify: that route requires a session cookie, which server-side
  // workflow/cron callers never have (the fetch always 401'd silently).
  for (const email of opts.to) {
    try {
      const result = await sendNotifyEmail({
        to:               email,
        subject:          opts.subject,
        senderName:       opts.senderName ?? "System",
        workOrderSummary: opts.workOrderSummary,
        messageHtml:      opts.message,
      });
      if (!result.success) console.warn(`[sendAlert] Failed to notify ${email}: ${result.error}`);
    } catch {
      // non-fatal — log and continue
      console.warn(`[sendAlert] Failed to notify ${email}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE — Links invoice auto-complete
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
   RULE — BL 48-hour sailing alert
   Called after any field save. If sailingdt is set and blno is still empty,
   AND sailing date is within the past 48 hours → alert.
   Notifies ALL admins + superadmins.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkBL48hrAlert(
  sb: SupabaseClient,
  workOrderId: string,
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

  // Dedup: max one BL alert per WO per day (the daily cron and the inline
  // PATCH trigger can both fire for the same WO).
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: alreadySent } = await sb
    .from("bajaj_audit_logs")
    .select("id")
    .eq("target_type", "work_order")
    .eq("target_id", workOrderId)
    .eq("action", "bl_48hr_alert")
    .gte("created_at", `${today}T00:00:00Z`)
    .limit(1);
  if (alreadySent?.length) return;

  const recipients = Array.from(new Set(await getAdminAlertEmails(sb)));
  if (!recipients.length) return;

  const hoursAgo = Math.round(diff / (60 * 60 * 1000));
  await sendAlert({
    to:               recipients,
    subject:          `⚠️ BL Release Overdue — WO ${woNo}`,
    message:          `Work order <strong>${escapeHtml(woNo)}</strong> sailed ${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago but the BL number has not been released yet.<br><br>Sailing date: <strong>${escapeHtml(sailingdt)}</strong><br>BL Number: <em>Not yet added</em><br><br>Please release the BL immediately to avoid delays.`,
    workOrderId,
    workOrderSummary: `WO ${woNo}`,
    senderName:       "Bajaj Workflow Engine",
  });

  // Log so we don't re-alert today
  await sb.from("bajaj_audit_logs").insert({
    actor_email: "system@workflow",
    action:      "bl_48hr_alert",
    target_type: "work_order",
    target_id:   workOrderId,
    new_value:   { wo: woNo, sailingdt, hoursAgo },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RULE — SI Cutoff escalation
   If current date > SI cutoff AND SI has NOT been filed (si_filed / sifiling is
   falsy), alert ALL admins + superadmins.
   Safe to call on every save — deduped by checking if already alerted this day
   via bajaj_audit_logs.
   ═══════════════════════════════════════════════════════════════════════════════ */
export async function checkSICutoffAlert(
  sb: SupabaseClient,
  workOrderId: string,
  woData: Record<string, unknown>
): Promise<void> {
  const woNo      = String(woData["wo"] ?? workOrderId);
  // "si_submitted" is what the Google Sheet sync writes ("SI Submitted" column);
  // the other keys cover legacy manual-entry data.
  const siFiled   =
    present(woData["si_submitted"]) ||
    present(woData["si_filed"]) ||
    present(woData["sifiling"]) ||
    present(woData["sifile"]);
  const sicutoff  = String(woData["sicutoff"] ?? woData["si_cutoff"] ?? "").trim();

  // Skip if SI already filed or no cutoff date configured
  if (siFiled || !sicutoff) return;

  const cutoff = parseDateString(sicutoff);
  if (!cutoff) return;

  // Only alert once the cutoff has PASSED. Sheet dates are date-only
  // ("YYYY-MM-DD" parses to midnight UTC) — treat those as end-of-day so the
  // alert fires the day AFTER the cutoff, not on the cutoff morning itself.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(sicutoff);
  const cutoffEnd  = cutoff.getTime() + (isDateOnly ? 86_400_000 - 1 : 0);
  if (Date.now() <= cutoffEnd) return;

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

  const recipients = Array.from(new Set(await getAdminAlertEmails(sb)));

  if (recipients.length) {
    const daysOverdue = Math.max(1, Math.floor((Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000)));
    await sendAlert({
      to:               recipients,
      subject:          `🚨 SI Cutoff Missed — WO ${woNo}`,
      message:          `Work order <strong>${escapeHtml(woNo)}</strong> has passed its SI cutoff date and SI has <strong>not</strong> been filed yet.<br><br>SI Cutoff: <strong>${escapeHtml(sicutoff)}</strong><br>Overdue by: <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong><br><br>Please file the Shipping Instruction immediately to avoid vessel booking cancellation.`,
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
   RULE — HAZ container restriction
   If the work order has an affirmative haz flag (see isHazValue — the sheet
   writes "YES"/"NO"), it must travel in a dedicated
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

  // Find any OTHER WOs that share at least one container number (paginated —
  // the table exceeds supabase's 1000-row default cap now that months accumulate).
  const others: { id: string; data: Record<string, unknown> }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await sb
      .from("bajaj_work_orders")
      .select("id, data")
      .neq("id", workOrderId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    others.push(...((page ?? []) as { id: string; data: Record<string, unknown> }[]));
    if (!page || page.length < PAGE) break;
  }

  const containers = containerno
    .split(/[\s,;/]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  for (const wo of others) {
    const d = wo.data as Record<string, unknown>;
    const otherContainers = String(d["containerno"] ?? d["container_no"] ?? "")
      .split(/[\s,;/]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const shared = containers.filter(c => otherContainers.includes(c));
    if (!shared.length) continue;

    const otherHAZ = isHazValue(d["haz"]);
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
