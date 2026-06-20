/**
 * GET  /api/cron/bajaj-reminders  — Vercel cron: daily at 09:00 IST (03:30 UTC)
 * POST /api/cron/bajaj-reminders  — Admin manual trigger
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transporter } from "@/lib/email/mailer";
import { verifyCronSecret } from "@/lib/bajaj/cron-auth";
import { requireAdmin } from "@/lib/bajaj/guards";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildReminderHtml(recipients: string[], summary: string, message: string, dueAt: Date) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#d97706;margin-bottom:8px;">Bajaj Shipment — Reminder Due</h2>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
        This reminder was due on <strong>${formatDate(dueAt)}</strong>.
      </p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px 0;">Work Order</p>
        <p style="font-size:15px;color:#111827;font-weight:600;margin:0;">${summary}</p>
      </div>
      ${message ? `<div style="border-left:3px solid #d97706;padding-left:16px;margin-bottom:24px;">
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${message}</p>
      </div>` : ""}
      <p style="color:#9ca3af;font-size:11px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
        Sent to: ${recipients.join(", ")} · Bajaj Shipment Dashboard
      </p>
    </div>
  `;
}

async function runCron(): Promise<NextResponse> {
  const sb  = createAdminClient();
  const now = new Date().toISOString();

  const { data: pending, error } = await sb
    .from("bajaj_reminders")
    .select("id, work_order_summary, recipients, message, due_at")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ sent: false, message: "No reminders due", total: 0 });

  const results: { id: string; ok: boolean; to: string[]; error?: string }[] = [];

  for (const row of pending) {
    const recipients: string[] = Array.isArray(row.recipients) ? row.recipients : [];

    if (!recipients.length) {
      await sb.from("bajaj_reminders").update({ status: "sent", sent_at: now }).eq("id", row.id);
      continue;
    }

    try {
      await transporter.sendMail({
        from:    `"Bajaj Shipment" <${process.env.GMAIL_USER}>`,
        to:      recipients.join(", "),
        subject: `🔔 Reminder: ${row.work_order_summary} — ${formatDate(new Date(row.due_at))}`,
        html:    buildReminderHtml(recipients, row.work_order_summary ?? "", row.message ?? "", new Date(row.due_at)),
      });
      await sb.from("bajaj_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
      results.push({ id: row.id, ok: true, to: recipients });
    } catch (err) {
      console.error(`[cron/bajaj-reminders] Failed for reminder ${row.id}:`, err);
      results.push({ id: row.id, ok: false, to: recipients, error: String(err) });
    }
  }

  return NextResponse.json({ sent: true, total: pending.length, results });
}

// Scheduled invocation (Vercel Cron) — authorized by CRON_SECRET only.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCron();
}

// Manual trigger — allowed for an admin session OR a valid cron secret.
// (Never fabricate the secret server-side; authorize the real request.)
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
  }
  return runCron();
}
