/**
 * Shared Resend notification sender.
 *
 * Used by:
 *   - POST /api/bajaj/notify        (user-facing mentions / manual reminders)
 *   - lib/bajaj/workflow.ts         (server-side workflow alerts: BL 48hr, SI cutoff)
 *
 * The workflow engine MUST call this directly rather than HTTP-fetching the
 * notify route — that route requires a session cookie, which cron/server-side
 * callers never have.
 */

import { Resend } from "resend";

/** Escape user-supplied text before interpolating it into email HTML. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True when Resend is configured and real emails will be sent. */
export function notifyConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface NotifyEmailResult {
  success: boolean;
  /** True when RESEND_API_KEY is unset — nothing was sent, treated as OK. */
  demo?: boolean;
  id?: string;
  error?: string;
}

export async function sendNotifyEmail(opts: {
  to: string;
  subject: string;
  senderName: string;
  workOrderSummary?: string;
  /** Trusted/pre-sanitized HTML — escape any user input BEFORE passing it in. */
  messageHtml: string;
}): Promise<NotifyEmailResult> {
  // Demo mode: if email is not configured, pretend it succeeded so flows work offline.
  if (!notifyConfigured()) return { success: true, demo: true };

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: "Bajaj Shipment <onboarding@resend.dev>",
    to: [opts.to],
    subject: opts.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d97706; margin-bottom: 8px;">Bajaj Shipment — Work Order Notification</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          You have been mentioned in a work order update by <strong>${escapeHtml(opts.senderName)}</strong>.
        </p>

        ${opts.workOrderSummary ? `
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Work Order</p>
          <p style="font-size: 15px; color: #111827; font-weight: 600; margin: 0;">${escapeHtml(opts.workOrderSummary)}</p>
        </div>
        ` : ""}

        <div style="border-left: 3px solid #d97706; padding-left: 16px; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${opts.messageHtml}</p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          This notification was sent from the Bajaj Shipment Dashboard.
          Please do not reply to this email.
        </p>
      </div>
    `,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}
