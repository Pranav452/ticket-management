/**
 * POST /api/bajaj/repair
 * Fixes NULL / misspelled country values in bajaj_work_orders for a given module.
 *
 * Body: { moduleSlug: string, dryRun?: boolean }
 *
 * Logic:
 *  - Finds all WOs for the module where data->>'country' is NULL, empty, or a
 *    known spelling variant (e.g. "BANGALDESH").
 *  - Sets it to the canonical country string for that module.
 *  - dryRun=true (default) → only counts, no writes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/bajaj/guards";

const MODULE_CONFIG: Record<string, { slug: string; canonical: string; variants: string[] }> = {
  bangladesh: { slug: "bangladesh", canonical: "Bangladesh",    variants: ["BANGALDESH", "Bangaldesh", "bangladesh"] },
  srilanka:   { slug: "srilanka",   canonical: "Sri Lanka",     variants: ["SriLanka", "sri lanka", "SRILANKA", "Srilanka"] },
  nigeria:    { slug: "nigeria",    canonical: "Nigeria",       variants: ["NIGERIA", "nigeria"] },
  triumph:    { slug: "triumph",    canonical: "United Kingdom", variants: ["UK", "U.K", "United kingdom", "UNITED KINGDOM"] },
  vipar:      { slug: "vipar",      canonical: "VIPAR",         variants: ["Vipar", "vipar", "VIPAR"] },
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json() as { moduleSlug: string; dryRun?: boolean };
    const { moduleSlug, dryRun = true } = body;

    const cfg = MODULE_CONFIG[moduleSlug];
    if (!cfg) {
      return NextResponse.json({ error: `Unknown moduleSlug: ${moduleSlug}` }, { status: 400 });
    }

    const sb = createAdminClient();

    // Fetch all WOs for this module
    const { data: allWOs, error: fetchErr } = await sb
      .from("bajaj_work_orders")
      .select("id, data")
      .eq("module_slug", moduleSlug);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const nullRows:    string[] = [];
    const variantRows: string[] = [];

    for (const wo of allWOs ?? []) {
      const d = wo.data as Record<string, unknown>;
      const country = d["country"];

      if (country === null || country === undefined || String(country).trim() === "") {
        nullRows.push(wo.id);
      } else if (
        cfg.variants.some(v => v.toLowerCase() === String(country).trim().toLowerCase()) &&
        String(country).trim() !== cfg.canonical
      ) {
        variantRows.push(wo.id);
      }
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        moduleSlug,
        canonicalCountry:         cfg.canonical,
        wouldUpdateNullRows:      nullRows.length,
        wouldFixSpellingVariants: variantRows.length,
      });
    }

    // Apply fixes
    let updatedNullRows = 0;
    let fixedVariants   = 0;

    if (nullRows.length > 0) {
      for (const id of nullRows) {
        const { data: wo } = await sb
          .from("bajaj_work_orders")
          .select("data")
          .eq("id", id)
          .single();
        if (!wo) continue;
        const merged = { ...(wo.data as Record<string, unknown>), country: cfg.canonical };
        const { error: upErr } = await sb
          .from("bajaj_work_orders")
          .update({ data: merged })
          .eq("id", id);
        if (!upErr) updatedNullRows++;
      }
    }

    if (variantRows.length > 0) {
      for (const id of variantRows) {
        const { data: wo } = await sb
          .from("bajaj_work_orders")
          .select("data")
          .eq("id", id)
          .single();
        if (!wo) continue;
        const merged = { ...(wo.data as Record<string, unknown>), country: cfg.canonical };
        const { error: upErr } = await sb
          .from("bajaj_work_orders")
          .update({ data: merged })
          .eq("id", id);
        if (!upErr) fixedVariants++;
      }
    }

    return NextResponse.json({
      dryRun: false,
      moduleSlug,
      canonicalCountry: cfg.canonical,
      updatedNullRows,
      fixedVariants,
    });
  } catch (err) {
    console.error("[POST /api/bajaj/repair]", err);
    return NextResponse.json({ error: "Repair failed" }, { status: 500 });
  }
}
