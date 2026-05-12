/**
 * GET /api/bajaj/cron/bl-alert
 *
 * Scans ALL work orders where:
 *   - sailingdt is set
 *   - blno is empty
 *   - sailing date was between 0–48 hours ago
 *
 * Fires email alert to column assignees of BL Release + all superadmins.
 *
 * Call this from a cron service (Vercel Cron, GitHub Actions, external scheduler)
 * every hour. Protected by CRON_SECRET env var.
 *
 * Vercel cron config (vercel.json):
 *   { "crons": [{ "path": "/api/bajaj/cron/bl-alert", "schedule": "0 * * * *" }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkBL48hrAlert } from "@/lib/bajaj/workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify cron secret (set CRON_SECRET in env)
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = createAdminClient();

    // Fetch all WOs that have sailingdt but no blno
    const { data: wos, error } = await sb
      .from("bajaj_work_orders")
      .select("id, module_slug, data");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let alerted = 0;
    for (const wo of wos ?? []) {
      const d    = wo.data as Record<string, unknown>;
      const blno = String(d["blno"] ?? "").trim();
      const sailingdt = String(d["sailingdt"] ?? "").trim();
      if (blno || !sailingdt) continue;

      await checkBL48hrAlert(sb, wo.id, wo.module_slug ?? "", d);
      alerted++;
    }

    return NextResponse.json({ success: true, checked: wos?.length ?? 0, alerted });
  } catch (err) {
    console.error("[GET /api/bajaj/cron/bl-alert]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
