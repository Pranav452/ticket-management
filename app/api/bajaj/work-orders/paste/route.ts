/**
 * POST /api/bajaj/work-orders/paste
 * Body: { rows: PasteRow[], moduleSlug: string }
 * Inserts rows from pasted email content. Skips duplicate WO numbers.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";

const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

interface PasteRow {
  wo:           string;
  country?:     string;
  port?:        string;
  agent?:       string;
  plant?:       string;
  veh?:         string;
  type?:        string;
  qty?:         string | number;
  cont?:        string | number;
  po_no?:       string;
  lc_no?:       string;
  do_given_dt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const body       = await req.json() as { rows: PasteRow[]; moduleSlug?: string };
    const rows       = Array.isArray(body.rows) ? body.rows : [];
    const moduleSlug = String(body.moduleSlug ?? "").toLowerCase();

    if (rows.length === 0) return NextResponse.json({ added: 0, skipped: 0, errors: [] });

    const sb         = createAdminClient();
    const actorEmail = auth.email;

    const { data: mod } = await sb
      .from("bajaj_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .single();
    if (!mod) return NextResponse.json({ error: `Unknown module: ${moduleSlug}` }, { status: 400 });

    // Fetch existing WOs for dedup
    const { data: existingWOs } = await sb
      .from("bajaj_work_orders")
      .select("data->>'wo'")
      .eq("module_slug", moduleSlug);
    const existingSet = new Set((existingWOs ?? []).map((r) => String(Object.values(r)[0])));

    const defaultCountry = MODULE_DEFAULT_COUNTRY[moduleSlug] ?? null;
    const toInsert: Record<string, unknown>[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const row of rows) {
      const wo = String(row.wo ?? "").trim();
      if (!wo || existingSet.has(wo)) { skipped++; continue; }

      const data: Record<string, unknown> = {
        wo,
        country:     String(row.country     ?? "").trim() || defaultCountry,
        port:        String(row.port        ?? "").trim() || null,
        agent:       String(row.agent       ?? "").trim() || null,
        plant:       String(row.plant       ?? "").trim() || null,
        veh:         String(row.veh         ?? "").trim() || null,
        type:        String(row.type        ?? "").trim() || null,
        po_no:       String(row.po_no       ?? "").trim() || null,
        lc_no:       String(row.lc_no       ?? "").trim() || null,
        do_given_dt: String(row.do_given_dt ?? "").trim() || null,
        qty:  row.qty  != null ? (parseInt(String(row.qty),  10) || null) : null,
        cont: row.cont != null ? (parseInt(String(row.cont), 10) || null) : null,
      };

      existingSet.add(wo);
      toInsert.push({ module_id: mod.id, module_slug: moduleSlug, data });
    }

    let added = 0;
    if (toInsert.length > 0) {
      const { data: inserted, error } = await sb
        .from("bajaj_work_orders")
        .insert(toInsert)
        .select("id");
      if (error) errors.push(error.message);
      else added = inserted?.length ?? 0;
    }

    // Audit
    if (added > 0) {
      await sb.from("bajaj_audit_logs").insert({
        actor_email: actorEmail ?? "system",
        action:      "imported",
        target_type: "work_order",
        new_value:   { module_slug: moduleSlug, added },
      });
    }

    return NextResponse.json({ added, skipped, errors });
  } catch (err) {
    console.error("[POST /api/bajaj/work-orders/paste]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
