import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/bajaj/guards";
import { escapeHtml, sendNotifyEmail } from "@/lib/email/notify";

// POST /api/bajaj/notify
// Body: { to: string, subject?: string, workOrderId: string, workOrderSummary: string, message: string, senderName: string }
export async function POST(req: NextRequest) {
  // Only approved Bajaj users may send notifications through the shared sender.
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { to, workOrderId, workOrderSummary, message } = body;

  if (!to || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Sender identity comes from the session, not the body.
  const senderName = auth.email;

  const subject = body.subject ?? `Work Order Update — ${workOrderSummary ?? workOrderId}`;

  const result = await sendNotifyEmail({
    to,
    subject,
    senderName,
    workOrderSummary,
    messageHtml: escapeHtml(message),
  });

  if (!result.success) {
    console.error("Resend error:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (result.demo) return NextResponse.json({ success: true, demo: true });
  return NextResponse.json({ success: true, id: result.id });
}
