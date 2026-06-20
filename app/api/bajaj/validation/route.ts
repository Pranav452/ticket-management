/**
 * GET /api/bajaj/validation
 * Returns all existing business-rule violations in the DB.
 * Used by Admin → Data Tools to surface pre-existing conflicts.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditExistingViolations } from "@/lib/bajaj/validation";
import { requireApprovedUser } from "@/lib/bajaj/guards";

export async function GET() {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const sb = createAdminClient();
    const result = await auditExistingViolations(sb);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/bajaj/validation]", err);
    return NextResponse.json({ error: "Failed to run audit" }, { status: 500 });
  }
}
