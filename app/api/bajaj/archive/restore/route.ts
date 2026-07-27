/**
 * POST /api/bajaj/archive/restore
 * Body: { id } — clears the archive stamps (data.archived_at / archived_by)
 * on one work order so it returns to its board.
 * Auth: admin only (everyone can VIEW the archive; only admins restore).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";
import { restoreArchived } from "@/lib/bajaj/archive";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const result = await restoreArchived(id, auth.email);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[POST /api/bajaj/archive/restore]", err);
    return NextResponse.json({ ok: false, error: "Restore failed" }, { status: 500 });
  }
}
