/**
 * GET /api/bajaj/cron/bl-alert
 *
 * Scans ALL work orders where:
 *   - sailingdt is set
 *   - blno is empty
 *   - sailing date was between 0–48 hours ago
 *
 * Fires email alert to all admins + superadmins.
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

    // Fetch all WOs that have sailingdt but no blno (paginated — the table
    // exceeds supabase's 1000-row default cap now that months accumulate).
    const wos: { id: string; data: Record<string, unknown> }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await sb
        .from("bajaj_work_orders")
        .select("id, data")
        .range(from, from + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      wos.push(...((page ?? []) as { id: string; data: Record<string, unknown> }[]));
      if (!page || page.length < 1000) break;
    }

    let alerted = 0;
    for (const wo of wos ?? []) {
      const d    = wo.data as Record<string, unknown>;
      // Archived cards are parked — never alert on them.
      if (d["archived_at"] != null && String(d["archived_at"]).trim() !== "") continue;
      const blno = String(d["blno"] ?? "").trim();
      const sailingdt = String(d["sailingdt"] ?? "").trim();
      if (blno || !sailingdt) continue;

      await checkBL48hrAlert(sb, wo.id, d);
      alerted++;
    }

    return NextResponse.json({ success: true, checked: wos?.length ?? 0, alerted });
  } catch (err) {
    console.error("[GET /api/bajaj/cron/bl-alert]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
