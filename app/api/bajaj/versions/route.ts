/**
 * GET /api/bajaj/versions — list version snapshots (newest first).
 * Snapshots are written after every successful real sheet sync
 * (lib/bajaj/versions.ts); rollback goes through POST /api/bajaj/sheet-sync
 * with { action: "rollback", versionKey }.
 * Auth: admin only.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listVersions } from "@/lib/bajaj/versions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const versions = await listVersions(createAdminClient());
    return NextResponse.json({ versions });
  } catch (err) {
    console.error("[GET /api/bajaj/versions]", err);
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
  }
}
