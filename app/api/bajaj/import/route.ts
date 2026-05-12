/**
 * POST /api/bajaj/import
 * Accepts multipart/form-data: file (.xlsx) + moduleSlug
 * Parses Excel, maps columns to work order data, inserts into Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail } from "@/lib/bajaj/permissions";
import { validateWorkOrderRules } from "@/lib/bajaj/validation";

const HEADER_MAP: Record<string, string> = {
  "wo":             "wo",
  "wo no":          "wo",
  "wo no.":         "wo",
  "work order":     "wo",
  "work order no":  "wo",
  "wodt":           "wodt",
  "wo date":        "wodt",
  "port":           "port",
  "port (wo/pod)":  "port",
  "pod":            "port",
  "country":        "country",
  "plant":          "plant",
  "brand":          "brand",
  "variant":        "variant",
  "qty":            "qty",
  "quantity":       "qty",
  "40hc":           "hc40",
  "40 hc":          "hc40",
  "40hc qty":       "hc40",
  "std20":          "std20",
  "std 20":         "std20",
  "sbno":           "sbno",
  "sb no":          "sbno",
  "blno":           "blno",
  "bl no":          "blno",
  "bldt":           "bldt",
  "bl date":        "bldt",
  "sailingdt":      "sailingdt",
  "sailing date":   "sailingdt",
  "etd":            "sailingdt",
  "booking no":     "booking_no",
  "booking no.":    "booking_no",
  "bookingno":      "booking_no",
  "agent":          "agent",
  "cha":            "agent",
  "remark":         "remark",
  "remarks":        "remark",
  "assy config":    "assy_config",
};

const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

function matchHeader(h: string): string | null {
  return HEADER_MAP[h.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    const moduleSlug = (formData.get("moduleSlug") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const sb          = createAdminClient();
    const actorEmail  = await getCurrentUserEmail();

    // Resolve module
    const { data: mod } = await sb
      .from("bajaj_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .single();
    if (!mod) return NextResponse.json({ error: `Unknown module: ${moduleSlug}` }, { status: 400 });

    // Parse Excel
    const arrayBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(new Uint8Array(arrayBuf) as any);

    // Find sheet with a WO column
    let sheet = workbook.worksheets[0];
    let colMap: Record<number, string> = {};
    for (const ws of workbook.worksheets) {
      const hdr = ws.getRow(1).values as (string | undefined)[];
      const map: Record<number, string> = {};
      hdr.forEach((h, idx) => { if (h) { const m = matchHeader(String(h)); if (m) map[idx] = m; } });
      if (Object.values(map).includes("wo")) { sheet = ws; colMap = map; break; }
    }
    if (!Object.values(colMap).includes("wo")) {
      const hdr = workbook.worksheets[0].getRow(1).values as (string | undefined)[];
      hdr.forEach((h, idx) => { if (h) { const m = matchHeader(String(h)); if (m) colMap[idx] = m; } });
    }

    // Fetch existing WO numbers to dedup
    const { data: existingWOs } = await sb
      .from("bajaj_work_orders")
      .select("data->>'wo'")
      .eq("module_slug", moduleSlug);
    const existingSet = new Set((existingWOs ?? []).map((r) => String(Object.values(r)[0])));

    const defaultCountry = MODULE_DEFAULT_COUNTRY[moduleSlug] ?? null;
    const toInsert: Record<string, unknown>[] = [];

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row    = sheet.getRow(rowNum);
      const values = row.values as (string | number | undefined)[];
      const record: Record<string, string | number | null> = {};

      Object.entries(colMap).forEach(([idx, col]) => {
        const v = values[parseInt(idx, 10)];
        if (col === "qty" || col === "hc40" || col === "std20") {
          record[col] = v != null ? parseInt(String(v)) : null;
        } else {
          record[col] = v != null ? String(v).trim() : null;
        }
      });

      const wo = String(record["wo"] ?? "").trim();
      if (!wo || existingSet.has(wo)) continue;

      if (!record["country"]) record["country"] = defaultCountry;
      existingSet.add(wo);
      toInsert.push({ module_id: mod.id, module_slug: moduleSlug, data: record });
    }

    // ── Validate business rules across all rows to insert ───────────────────
    const violations: { wo: string; warnings: string[] }[] = [];
    const clean: typeof toInsert = [];

    for (const row of toInsert) {
      const d = row.data as Record<string, unknown>;
      const warnings = await validateWorkOrderRules(sb, [{
        country:     d["country"]     ? String(d["country"])     : (defaultCountry ?? null),
        containerno: d["containerno"] ? String(d["containerno"]) : null,
        vslname:     d["vslname"]     ? String(d["vslname"])     : null,
        assy_config: d["assy_config"] ? String(d["assy_config"]) : null,
      }]);
      if (warnings.length > 0) {
        violations.push({ wo: String(d["wo"] ?? ""), warnings: warnings.map(w => w.message) });
      } else {
        clean.push(row);
      }
    }

    let addedCount   = 0;
    let skippedCount = 0;

    if (clean.length > 0) {
      const { data: inserted, error } = await sb
        .from("bajaj_work_orders")
        .insert(clean)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      addedCount   = inserted?.length ?? 0;
      skippedCount = (sheet.rowCount - 1) - addedCount - violations.length;
    } else {
      skippedCount = sheet.rowCount - 1 - violations.length;
    }

    // Record import batch
    await sb.from("bajaj_import_batches").insert({
      module_id:     mod.id,
      module_slug:   moduleSlug,
      filename:      file.name,
      imported_by:   actorEmail,
      row_count:     sheet.rowCount - 1,
      added_count:   addedCount,
      skipped_count: skippedCount,
    });

    return NextResponse.json({ success: true, addedCount, skippedCount, violations });
  } catch (err) {
    console.error("[POST /api/bajaj/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
