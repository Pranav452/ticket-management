/**
 * POST /api/bajaj/import
 * Accepts multipart/form-data: file (.xlsx) + moduleSlug + optional sheetName
 * Parses Excel, maps every column to canonical work-order data, derives the
 * lifecycle status + parts/frames tag, dedups by (wo|container|booking), inserts.
 *
 * Mapping / derivation logic is shared with scripts/import-june-2026.mjs via
 * lib/bajaj/import-map.mjs so the UI import and the one-off refill stay in sync.
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/bajaj/guards";
import { validateWorkOrderRules } from "@/lib/bajaj/validation";
import {
  SHEET_MODULE_MAP, normHeader, buildColMap, buildRecord, deriveStatusName,
} from "@/lib/bajaj/import-map.mjs";

const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

/** Composite dedup key — a WO can span multiple container/booking rows. */
function rowKey(d: Record<string, unknown>): string {
  return [d["wo"], d["container_no"], d["booking_no"]].map((v) => String(v ?? "").trim()).join("|");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedUser();
    if (auth instanceof NextResponse) return auth;

    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    const moduleSlug = (formData.get("moduleSlug") as string | null) ?? "";
    const sheetName  = (formData.get("sheetName") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const sb         = createAdminClient();
    const actorEmail = auth.email;

    // Resolve module
    const { data: mod } = await sb
      .from("bajaj_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .single();
    if (!mod) return NextResponse.json({ error: `Unknown module: ${moduleSlug}` }, { status: 400 });

    // Module status name → id (for auto-placement)
    const { data: statusRows } = await sb
      .from("bajaj_statuses")
      .select("id, name")
      .eq("module_id", mod.id);
    const statusIdByName: Record<string, string> = {};
    for (const s of statusRows ?? []) statusIdByName[s.name] = s.id;

    // Parse Excel
    const arrayBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(new Uint8Array(arrayBuf) as any);

    // Pick the sheet: explicit sheetName, else first sheet with a WO column.
    let sheet = sheetName ? workbook.getWorksheet(sheetName) : undefined;
    let colMap: Record<number, string> = {};
    if (sheet) {
      colMap = buildColMap(sheet.getRow(1).values as unknown[]);
    } else {
      for (const ws of workbook.worksheets) {
        const map = buildColMap(ws.getRow(1).values as unknown[]);
        if (Object.values(map).includes("wo")) { sheet = ws; colMap = map; break; }
      }
      if (!sheet) { sheet = workbook.worksheets[0]; colMap = buildColMap(sheet.getRow(1).values as unknown[]); }
    }
    if (!Object.values(colMap).includes("wo")) {
      return NextResponse.json({ error: "No 'WO' column found in the selected sheet." }, { status: 400 });
    }

    const partsFrames = !!SHEET_MODULE_MAP[normHeader(sheet.name)]?.partsFrames;
    const defaultCountry = MODULE_DEFAULT_COUNTRY[moduleSlug] ?? null;

    // Existing composite keys + current max column_order (append below existing cards)
    const { data: existing } = await sb
      .from("bajaj_work_orders")
      .select("data, column_order")
      .eq("module_slug", moduleSlug);
    const existingKeys = new Set((existing ?? []).map((r) => rowKey(r.data as Record<string, unknown>)));
    let order = (existing ?? []).reduce((m, r) => Math.max(m, Number(r.column_order) || 0), 0);

    const totalDataRows = Math.max(0, sheet.rowCount - 1);
    const toInsert: Record<string, unknown>[] = [];

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const data = buildRecord(colMap, sheet.getRow(rowNum).values as unknown[], { partsFrames }) as Record<string, unknown> | null;
      if (!data) continue;
      if (!data["country"]) data["country"] = defaultCountry;

      const key = rowKey(data);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      const statusId = statusIdByName[deriveStatusName(data) as string] ?? null;
      toInsert.push({
        module_id:   mod.id,
        module_slug: moduleSlug,
        status_id:   statusId,
        column_order: ++order,
        data,
      });
    }

    // ── Validate business rules (Sri Lanka · LINKS) — violations are skipped ──
    const violations: { wo: string; warnings: string[] }[] = [];
    const clean: typeof toInsert = [];
    for (const row of toInsert) {
      const d = row.data as Record<string, unknown>;
      const warnings = await validateWorkOrderRules(sb, [{
        country:     d["country"]     ? String(d["country"])     : (defaultCountry ?? null),
        agent:       d["agent"]       ? String(d["agent"])       : null,
        containerno: d["container_no"] ? String(d["container_no"]) : null,
        vslname:     d["vslname"]     ? String(d["vslname"])     : null,
        assy_config: d["assy_config"] ? String(d["assy_config"]) : null,
      }]);
      if (warnings.length > 0) {
        violations.push({ wo: String(d["wo"] ?? ""), warnings: warnings.map((w) => w.message) });
      } else {
        clean.push(row);
      }
    }

    let addedCount = 0;
    if (clean.length > 0) {
      const { data: inserted, error } = await sb
        .from("bajaj_work_orders")
        .insert(clean)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      addedCount = inserted?.length ?? 0;
    }
    const skippedCount = totalDataRows - addedCount - violations.length;

    // Record import batch
    await sb.from("bajaj_import_batches").insert({
      module_id:     mod.id,
      module_slug:   moduleSlug,
      filename:      file.name,
      imported_by:   actorEmail,
      row_count:     totalDataRows,
      added_count:   addedCount,
      skipped_count: skippedCount,
    });

    return NextResponse.json({ success: true, addedCount, skippedCount, violations });
  } catch (err) {
    console.error("[POST /api/bajaj/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
