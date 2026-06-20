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
 * Called by Vercel Cron daily at 02:00 UTC (see vercel.json). Protected by
 * CRON_SECRET (verifyCronSecret accepts the Authorization: Bearer header Vercel
 * sends automatically).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkBL48hrAlert } from "@/lib/bajaj/workflow";
import { verifyCronSecret } from "@/lib/bajaj/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Cron-only: requires a valid CRON_SECRET (fails closed if unset).
  if (!verifyCronSecret(req)) {
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
