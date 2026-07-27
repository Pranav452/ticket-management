/**
 * GET /api/bajaj/months — the list of workbook months for the global month
 * selector: [{ month: "YYYY-MM", label, status: "active"|"archived" }],
 * newest first. Falls back to the BAJAJ_SHEET_ID env source when the
 * bajaj_sheet_sources config is empty.
 * Auth: any approved Bajaj user (NOT admin-gated — every page filters by month).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";
import { resolveSheetSources } from "@/lib/bajaj/sheet-sources";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const { sources } = await resolveSheetSources(createAdminClient());
    const months = sources
      .map(({ month, label, status }) => ({ month, label, status }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return NextResponse.json({ months });
  } catch (err) {
    console.error("[GET /api/bajaj/months]", err);
    return NextResponse.json({ error: "Failed to list months" }, { status: 500 });
  }
}
