/**
 * DELETE /api/bajaj/work-orders/clear?module=<slug>
 * Admin only. Deletes all work orders for a module (or all if no slug).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdmin } from "@/lib/bajaj/permissions";

export async function DELETE(req: NextRequest) {
  const actorEmail = await getCurrentUserEmail();
  if (!isAdmin(actorEmail)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const moduleSlug = req.nextUrl.searchParams.get("module");
  const sb = createAdminClient();

  let query = sb.from("bajaj_work_orders").delete();
  if (moduleSlug) query = query.eq("module_slug", moduleSlug);
  // Without a filter Supabase requires neq trick to delete all
  else query = (query as unknown as typeof query).neq("id", "00000000-0000-0000-0000-000000000000");

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
