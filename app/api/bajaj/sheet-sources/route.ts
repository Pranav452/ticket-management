/**
 * GET  /api/bajaj/sheet-sources — the monthly workbook sources config
 *      ({ updated_at, sources }); includes the env fallback indicator.
 * PUT  /api/bajaj/sheet-sources — replace the sources list.
 *      Body: { sources: [{ month, label?, sheetId, status }] }
 *      Validates: month "YYYY-MM", sheetId nonempty, status "active"|"archived",
 *      no duplicate months.
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSheetSourcesConfig, saveSheetSources, envFallbackSource, MONTH_RE, type SheetSource,
} from "@/lib/bajaj/sheet-sources";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const sb = createAdminClient();
    const config = await getSheetSourcesConfig(sb);
    return NextResponse.json({
      ...config,
      envFallback: config.sources.length === 0 ? envFallbackSource() : null,
      // For the admin share hint — each workbook must be shared (Viewer) with
      // this service account. The email is not a secret; the key never leaves env.
      serviceAccountEmail: process.env.GOOGLE_SA_EMAIL?.trim() || null,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/sheet-sources]", err);
    return NextResponse.json({ error: "Failed to load sheet sources" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => null)) as { sources?: unknown } | null;
    if (!body || !Array.isArray(body.sources)) {
      return NextResponse.json({ error: "Body must be { sources: [...] }" }, { status: 400 });
    }

    const sources: SheetSource[] = [];
    const seenMonths = new Set<string>();
    for (let i = 0; i < body.sources.length; i++) {
      const raw = body.sources[i] as Record<string, unknown> | null;
      if (!raw || typeof raw !== "object") {
        return NextResponse.json({ error: `sources[${i}] must be an object` }, { status: 400 });
      }
      const month = String(raw.month ?? "").trim();
      const sheetId = String(raw.sheetId ?? "").trim();
      const status = raw.status;
      if (!MONTH_RE.test(month)) {
        return NextResponse.json({ error: `sources[${i}].month must be "YYYY-MM"` }, { status: 400 });
      }
      if (!sheetId) {
        return NextResponse.json({ error: `sources[${i}].sheetId is required` }, { status: 400 });
      }
      if (status !== "active" && status !== "archived") {
        return NextResponse.json(
          { error: `sources[${i}].status must be "active" or "archived"` }, { status: 400 },
        );
      }
      if (seenMonths.has(month)) {
        return NextResponse.json({ error: `Duplicate month "${month}"` }, { status: 400 });
      }
      seenMonths.add(month);
      sources.push({ month, label: String(raw.label ?? "").trim() || month, sheetId, status });
    }

    const sb = createAdminClient();
    const saved = await saveSheetSources(sb, sources);

    await sb.from("bajaj_audit_logs").insert({
      actor_email: auth.email,
      action:      "updated_sheet_sources",
      target_type: "app_config",
      target_id:   "bajaj_sheet_sources",
      new_value:   { sources: sources.map(({ month, status }) => ({ month, status })) },
    });

    return NextResponse.json(saved);
  } catch (err) {
    console.error("[PUT /api/bajaj/sheet-sources]", err);
    return NextResponse.json({ error: "Failed to save sheet sources" }, { status: 500 });
  }
}
