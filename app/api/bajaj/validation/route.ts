/**
 * GET /api/bajaj/validation?month=<YYYY-MM>
 * Returns all existing business-rule violations in the DB (archived cards
 * excluded; optional month scoping on data->>sheet_month).
 * Used by Admin → Data Tools to surface pre-existing conflicts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditExistingViolations } from "@/lib/bajaj/validation";
import { requireApprovedUser } from "@/lib/bajaj/guards";
import { MONTH_RE } from "@/lib/bajaj/sheet-sources";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const month = req.nextUrl.searchParams.get("month");
    const sb = createAdminClient();
    const result = await auditExistingViolations(
      sb, month && MONTH_RE.test(month) ? { month } : {},
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/bajaj/validation]", err);
    return NextResponse.json({ error: "Failed to run audit" }, { status: 500 });
  }
}
