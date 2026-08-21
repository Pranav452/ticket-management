/**
 * POST /api/bajaj/sheet-sync
 * Body: { action?: "sync" | "archiveMissing" | "rollback", dryRun?: boolean, versionKey?: string }
 *
 *   - "sync" (default): pulls every ACTIVE monthly workbook and reconciles it
 *     into bajaj_work_orders (see lib/bajaj/sheet-sync.ts). dryRun computes
 *     the full diff with zero writes. Auth: admin session OR cron secret.
 *   - "archiveMissing": stamps data.archived_at/archived_by on non-archived
 *     rows absent from their month's workbook. Auth: ADMIN ONLY (not cron).
 *   - "rollback": restores the version snapshot named by versionKey.
 *     Auth: ADMIN ONLY (not cron).
 *
 * GET /api/bajaj/sheet-sync — scheduled invocation (Vercel Cron sends GET with
 * Authorization: Bearer CRON_SECRET). Cron-secret only; runs a real sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";
import { verifyCronSecret } from "@/lib/bajaj/cron-auth";
import { runSheetSync } from "@/lib/bajaj/sheet-sync";
import { sheetSyncEnabled } from "@/lib/bajaj/sheet-sources";
import { missingSheetSyncEnv } from "@/lib/bajaj/google-sheets";
import { archiveMissing } from "@/lib/bajaj/archive";
import { rollbackToVersion } from "@/lib/bajaj/versions";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: `Google Sheet sync is not configured — missing env: ${missingSheetSyncEnv().join(", ")}` },
    { status: 503 },
  );
}

// Scheduled invocation (Vercel Cron) — authorized by CRON_SECRET only.
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await sheetSyncEnabled())) return notConfigured();

    // Scheduled run: skip the AI briefing — nobody reads the cron response.
    const result = await runSheetSync("cron", { dryRun: false, explain: false });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[GET /api/bajaj/sheet-sync]", err);
    return NextResponse.json({ ok: false, error: "Sheet sync failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string; dryRun?: boolean; versionKey?: string;
    };
    const action = body.action ?? "sync";

    // Cron may only run a plain sync; archiveMissing/rollback are admin-only.
    let actor: string;
    if (action === "sync" && verifyCronSecret(req)) {
      actor = "cron";
    } else {
      const auth = await requireAdmin();
      if (auth instanceof NextResponse) return auth;
      actor = auth.email;
    }

    if (action === "archiveMissing") {
      const result = await archiveMissing(actor);
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    if (action === "rollback") {
      const versionKey = String(body.versionKey ?? "").trim();
      if (!versionKey) {
        return NextResponse.json({ ok: false, error: "versionKey is required" }, { status: 400 });
      }
      const result = await rollbackToVersion(versionKey, actor);
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    if (action !== "sync") {
      return NextResponse.json({ ok: false, error: `Unknown action "${action}"` }, { status: 400 });
    }

    if (!(await sheetSyncEnabled())) return notConfigured();

    const result = await runSheetSync(actor, { dryRun: !!body.dryRun });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[POST /api/bajaj/sheet-sync]", err);
    return NextResponse.json({ ok: false, error: "Sheet sync failed" }, { status: 500 });
  }
}
