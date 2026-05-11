/**
 * DELETE /api/bajaj/work-orders/clear
 * Truncates bajaj_wo_meta then bajaj_work_orders.
 * Requires active Supabase session with admin email.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinksPool } from "@/lib/db";

const ADMIN_EMAIL = "pranavnairop090@gmail.com";

export async function DELETE(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getLinksPool();
    await pool.request().query(`DELETE FROM bajaj_wo_meta`);
    await pool.request().query(`DELETE FROM bajaj_work_orders`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/bajaj/work-orders/clear]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
