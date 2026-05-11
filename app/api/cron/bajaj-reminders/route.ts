/**
 * GET  /api/cron/bajaj-reminders
 *   Vercel cron: daily at 09:00 IST (03:30 UTC).
 *   Finds pending bajaj_reminders with due_at <= now, sends email to each
 *   recipient list, marks them as sent.
 *
 * POST /api/cron/bajaj-reminders
 *   Admin manual trigger (no CRON_SECRET needed — session gate).
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";
import { transporter } from "@/lib/email/mailer";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildReminderHtml(
  recipients: string[],
  workOrderSummary: string,
  message: string,
  dueAt: Date
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#d97706;margin-bottom:8px;">Bajaj Shipment — Reminder Due</h2>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
        This reminder was due on <strong>${formatDate(dueAt)}</strong>.
      </p>

      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px 0;">Work Order</p>
        <p style="font-size:15px;color:#111827;font-weight:600;margin:0;">${workOrderSummary}</p>
      </div>

      ${message ? `
      <div style="border-left:3px solid #d97706;padding-left:16px;margin-bottom:24px;">
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${message}</p>
      </div>` : ""}

      <p style="color:#9ca3af;font-size:11px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
        Sent to: ${recipients.join(", ")} · Bajaj Shipment Dashboard
      </p>
    </div>
  `;
}

type ReminderRow = {
  id: number;
  work_order_summary: string;
  recipients: string;
  message: string;
  due_at: Date;
};

type SendResult = { id: number; ok: boolean; to: string[]; error?: string };

async function runCron(): Promise<NextResponse> {
  const pool    = await getLinksPool();
  const now     = new Date();

  const result  = await pool.request()
    .input("now", sql.DateTime, now)
    .query<ReminderRow>(`
      SELECT id, work_order_summary, recipients, message, due_at
      FROM bajaj_reminders
      WHERE status = 'pending' AND due_at <= @now
      ORDER BY due_at ASC
    `);

  const pending = result.recordset;
  if (!pending.length) {
    return NextResponse.json({ sent: false, message: "No reminders due", total: 0 });
  }

  const results: SendResult[] = [];

  for (const row of pending) {
    let recipients: string[] = [];
    try {
      recipients = Array.isArray(row.recipients) ? row.recipients : JSON.parse(row.recipients ?? "[]");
    } catch { recipients = []; }

    if (!recipients.length) {
      await pool.request().input("id", sql.Int, row.id).query(
        `UPDATE bajaj_reminders SET status='sent', sent_at=GETDATE() WHERE id=@id`
      );
      continue;
    }

    try {
      await transporter.sendMail({
        from:    `"Bajaj Shipment" <${process.env.GMAIL_USER}>`,
        to:      recipients.join(", "),
        subject: `🔔 Reminder: ${row.work_order_summary} — ${formatDate(new Date(row.due_at))}`,
        html:    buildReminderHtml(recipients, row.work_order_summary, row.message, new Date(row.due_at)),
      });

      await pool.request().input("id", sql.Int, row.id).query(
        `UPDATE bajaj_reminders SET status='sent', sent_at=GETDATE() WHERE id=@id`
      );

      results.push({ id: row.id, ok: true, to: recipients });
    } catch (err) {
      console.error(`[cron/bajaj-reminders] Failed for reminder ${row.id}:`, err);
      results.push({ id: row.id, ok: false, to: recipients, error: String(err) });
    }
  }

  return NextResponse.json({ sent: true, total: pending.length, results });
}

// ─── GET — Vercel Cron ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCron();
}

// ─── POST — Admin manual trigger ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const syntheticReq = new NextRequest("http://localhost/api/cron/bajaj-reminders", {
    headers: process.env.CRON_SECRET
      ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
      : {},
  });
  return GET(syntheticReq);
}
