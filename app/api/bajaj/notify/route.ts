import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/bajaj/notify
// Body: { to: string, subject?: string, workOrderId: string, workOrderSummary: string, message: string, senderName: string }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { to, workOrderId, workOrderSummary, message, senderName } = body;

  if (!to || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Demo mode: if email is not configured, pretend it succeeded so the UI flow works offline.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: true, demo: true });
  }

  const subject = body.subject ?? `Work Order Update — ${workOrderSummary ?? workOrderId}`;

  const { data, error } = await resend.emails.send({
    from: "Bajaj Shipment <onboarding@resend.dev>",
    to: [to],
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d97706; margin-bottom: 8px;">Bajaj Shipment — Work Order Notification</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          You have been mentioned in a work order update by <strong>${senderName ?? "a team member"}</strong>.
        </p>

        ${workOrderSummary ? `
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Work Order</p>
          <p style="font-size: 15px; color: #111827; font-weight: 600; margin: 0;">${workOrderSummary}</p>
        </div>
        ` : ""}

        <div style="border-left: 3px solid #d97706; padding-left: 16px; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${message}</p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          This notification was sent from the Bajaj Shipment Dashboard.
          Please do not reply to this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
