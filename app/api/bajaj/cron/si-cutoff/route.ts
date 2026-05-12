/**
 * GET /api/bajaj/cron/si-cutoff
 *
 * Scans ALL work orders where:
 *   - sicutoff / si_cutoff field is set
 *   - SI has NOT been filed (si_filed / sifiling / sifile is empty)
 *   - cutoff date is in the past
 *
 * Fires escalation email to the SI Filing column assignees + all superadmins.
 * Deduped per-WO per-day via bajaj_audit_logs.
 *
 * Scheduled via vercel.json — runs daily at 06:00 UTC.
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSICutoffAlert } from "@/lib/bajaj/workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = createAdminClient();

    // Fetch all WOs — filter in JS (JSONB field lookup cheaper this way for small datasets)
    const { data: wos, error } = await sb
      .from("bajaj_work_orders")
      .select("id, module_slug, data");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let checked = 0;
    let escalated = 0;

    for (const wo of wos ?? []) {
      const d        = wo.data as Record<string, unknown>;
      const sicutoff = String(d["sicutoff"] ?? d["si_cutoff"] ?? "").trim();
      if (!sicutoff) continue; // no cutoff date — skip

      const siFiled = !!(
        String(d["si_filed"]  ?? "").trim() ||
        String(d["sifiling"]  ?? "").trim() ||
        String(d["sifile"]    ?? "").trim()
      );
      if (siFiled) continue; // already filed — skip

      checked++;
      await checkSICutoffAlert(sb, wo.id, wo.module_slug ?? "", d);
      escalated++;
    }

    return NextResponse.json({ success: true, total: wos?.length ?? 0, checked, escalated });
  } catch (err) {
    console.error("[GET /api/bajaj/cron/si-cutoff]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
