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

    // Parse Excel
    const arrayBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(new Uint8Array(arrayBuf) as any);

    // Auto-route ON (default): every sheet goes to the board its name maps to
    // (SHEET_MODULE_MAP); unrecognised sheets fall back to the selected module.
    // OFF ("autoRoute=false"): legacy behaviour — first WO sheet → selected module.
    const autoRoute = (formData.get("autoRoute") as string | null) !== "false";

    // Per-module context: id, status-name→id map, dedup keys, running order, rows.
    type ModCtx = {
      id: string; slug: string;
      statusIdByName: Record<string, string>;
      existingKeys: Set<string>;
      order: number;
      toInsert: Record<string, unknown>[];
    };
    const ctxCache = new Map<string, ModCtx>();
    async function getCtx(slug: string): Promise<ModCtx | null> {
      const cached = ctxCache.get(slug);
      if (cached) return cached;
      const { data: mod } = await sb.from("bajaj_modules").select("id").eq("slug", slug).single();
      if (!mod) return null;
      const { data: statusRows } = await sb.from("bajaj_statuses").select("id, name").eq("module_id", mod.id);
      const statusIdByName: Record<string, string> = {};
      for (const s of statusRows ?? []) statusIdByName[s.name] = s.id;
      const { data: existing } = await sb.from("bajaj_work_orders").select("data, column_order").eq("module_slug", slug);
      const existingKeys = new Set((existing ?? []).map((r) => rowKey(r.data as Record<string, unknown>)));
      const order = (existing ?? []).reduce((m, r) => Math.max(m, Number(r.column_order) || 0), 0);
      const ctx: ModCtx = { id: mod.id, slug, statusIdByName, existingKeys, order, toInsert: [] };
      ctxCache.set(slug, ctx);
      return ctx;
    }

    // Sheets that actually hold work orders (have a WO column).
    let sheets = workbook.worksheets.filter(
      (ws) => Object.values(buildColMap(ws.getRow(1).values as unknown[])).includes("wo"),
    );
    if (sheets.length === 0) {
      return NextResponse.json({ error: "No sheet with a 'WO' column was found." }, { status: 400 });
    }
    if (!autoRoute) {
      const picked = sheetName ? workbook.getWorksheet(sheetName) : undefined;
      sheets = picked ? [picked] : [sheets[0]];
    }

    // Build rows, routing each sheet to its own module.
    let totalDataRows = 0;
    for (const ws of sheets) {
      const colMap = buildColMap(ws.getRow(1).values as unknown[]);
      if (!Object.values(colMap).includes("wo")) continue;
      const sheetMeta   = SHEET_MODULE_MAP[normHeader(ws.name)];
      const targetSlug  = (autoRoute ? sheetMeta?.slug : null) ?? moduleSlug;
      const partsFrames = !!sheetMeta?.partsFrames;
      const ctx = await getCtx(targetSlug);
      if (!ctx) continue; // unknown module — skip rather than fail the whole import
      const defaultCountry = MODULE_DEFAULT_COUNTRY[targetSlug] ?? null;
      totalDataRows += Math.max(0, ws.rowCount - 1);

      for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
        const data = buildRecord(colMap, ws.getRow(rowNum).values as unknown[], { partsFrames }) as Record<string, unknown> | null;
        if (!data) continue;
        if (!data["country"]) data["country"] = defaultCountry;

        const key = rowKey(data);
        if (ctx.existingKeys.has(key)) continue;
        ctx.existingKeys.add(key);

        const statusId = ctx.statusIdByName[deriveStatusName(data) as string] ?? null;
        ctx.toInsert.push({
          module_id:    ctx.id,
          module_slug:  ctx.slug,
          status_id:    statusId,
          column_order: ++ctx.order,
          data,
        });
      }
    }

    // ── Validate + insert, per module ─────────────────────────────────────────
    let addedCount = 0;
    const violations: { wo: string; warnings: string[] }[] = [];
    const perModule: Record<string, number> = {};

    for (const ctx of ctxCache.values()) {
      const clean: Record<string, unknown>[] = [];
      for (const row of ctx.toInsert) {
        const d = row.data as Record<string, unknown>;
        const warnings = await validateWorkOrderRules(sb, [{
          country:     d["country"]      ? String(d["country"])      : (MODULE_DEFAULT_COUNTRY[ctx.slug] ?? null),
          agent:       d["agent"]        ? String(d["agent"])        : null,
          containerno: d["container_no"] ? String(d["container_no"]) : null,
          vslname:     d["vslname"]      ? String(d["vslname"])      : null,
          assy_config: d["assy_config"]  ? String(d["assy_config"])  : null,
        }]);
        if (warnings.length > 0) violations.push({ wo: String(d["wo"] ?? ""), warnings: warnings.map((w) => w.message) });
        else clean.push(row);
      }

      if (clean.length > 0) {
        const { data: inserted, error } = await sb.from("bajaj_work_orders").insert(clean).select("id");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const n = inserted?.length ?? 0;
        addedCount += n;
        perModule[ctx.slug] = (perModule[ctx.slug] ?? 0) + n;
        await sb.from("bajaj_import_batches").insert({
          module_id:     ctx.id,
          module_slug:   ctx.slug,
          filename:      file.name,
          imported_by:   actorEmail,
          row_count:     clean.length,
          added_count:   n,
          skipped_count: 0,
        });
      }
    }

    const skippedCount = Math.max(0, totalDataRows - addedCount - violations.length);
    return NextResponse.json({ success: true, addedCount, skippedCount, violations, perModule, autoRoute });
  } catch (err) {
    console.error("[POST /api/bajaj/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
