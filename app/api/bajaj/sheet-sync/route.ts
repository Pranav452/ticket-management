/**
 * POST /api/bajaj/sheet-sync
 * Body: { dryRun?: boolean }
 *
 * Pulls the configured Google Sheet and reconciles it into bajaj_work_orders
 * (see lib/bajaj/sheet-sync.ts). dryRun computes the full diff with zero writes.
 *
 * Auth: an admin session (requireAdmin) OR the cron shared secret
 * (verifyCronSecret) — either passes, so a scheduler can drive the sync too.
 *
 * GET /api/bajaj/sheet-sync — scheduled invocation (Vercel Cron sends GET with
 * Authorization: Bearer CRON_SECRET). Cron-secret only; runs a real sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";
import { verifyCronSecret } from "@/lib/bajaj/cron-auth";
import { runSheetSync } from "@/lib/bajaj/sheet-sync";
import { sheetSyncEnabled, missingSheetSyncEnv } from "@/lib/bajaj/google-sheets";

export const dynamic = "force-dynamic";

// Scheduled invocation (Vercel Cron) — authorized by CRON_SECRET only.
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!sheetSyncEnabled()) {
      return NextResponse.json(
        { ok: false, error: `Google Sheet sync is not configured — missing env: ${missingSheetSyncEnv().join(", ")}` },
        { status: 503 },
      );
    }

    const result = await runSheetSync("cron", { dryRun: false });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[GET /api/bajaj/sheet-sync]", err);
    return NextResponse.json({ ok: false, error: "Sheet sync failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let actor: string;
    if (verifyCronSecret(req)) {
      actor = "cron";
    } else {
      const auth = await requireAdmin();
      if (auth instanceof NextResponse) return auth;
      actor = auth.email;
    }

    if (!sheetSyncEnabled()) {
      return NextResponse.json(
        { ok: false, error: `Google Sheet sync is not configured — missing env: ${missingSheetSyncEnv().join(", ")}` },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = !!(body as { dryRun?: boolean }).dryRun;

    const result = await runSheetSync(actor, { dryRun });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[POST /api/bajaj/sheet-sync]", err);
    return NextResponse.json({ ok: false, error: "Sheet sync failed" }, { status: 500 });
  }
}
