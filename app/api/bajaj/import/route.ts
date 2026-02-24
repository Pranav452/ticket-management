import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

// Service role client to bypass RLS for inserts
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Strip colour-descriptor text that appears in legend rows alongside the real status name.
// e.g. "Shipment Complete Yellow Background" → keeps "Shipment Complete"
//      "HAZ Container (Yes) Red Font Color"  → keeps "HAZ Container (Yes)"
function stripColorDescriptor(text: string): string {
  // Matches trailing phrases like "Yellow Background", "Red Font Color", "Pink Colour", etc.
  return text
    .replace(/\b(yellow|green|red|blue|orange|pink|cyan|aqua|grey|gray|purple|white|black|brown)\s+(background|font\s+colou?r|colou?r|fill|shading)\b/gi, "")
    .replace(/\bfont\s+colou?r\b/gi, "")
    .replace(/\b(background|colou?r|fill)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ExcelJS ARGB format is AARRGGBB — strip the alpha prefix
function hexFromARGB(argb: string | undefined): string | null {
  if (!argb || argb.length < 6) return null;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  const upper = hex.toUpperCase();
  // Ignore white and empty fills
  if (upper === "FFFFFF" || upper === "000000" || upper === "00FFFFFF") return null;
  return upper;
}

// Scan a row for a colour indicator — background fill first, font colour as fallback.
// This handles both fill-coloured rows (Yellow/Green/Pink/Orange/Cyan) AND
// font-coloured rows (Red font = HAZ Container).
function getRowColorHex(row: ExcelJS.Row, maxCols: number): string | null {
  // Pass 1: background fill (highest priority — yellow/green/pink/orange/cyan)
  for (let c = 1; c <= maxCols; c++) {
    const cell = row.getCell(c);
    const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
    const hex = hexFromARGB(fill?.fgColor?.argb);
    if (hex) return hex;
  }
  // Pass 2: font colour (fallback — red font = HAZ Container, or other font-coded rows)
  for (let c = 1; c <= maxCols; c++) {
    const cell = row.getCell(c);
    const font = cell.font as { color?: { argb?: string } } | undefined;
    const hex = hexFromARGB(font?.color?.argb);
    if (hex) return hex;
  }
  return null;
}

// ── Sheet-name fuzzy matcher ──────────────────────────────────────────────────
// Handles: "Tirumph" ↔ "triumph", "NIgeria" ↔ "nigeria", "SriLanka" ↔ "srilanka"
function sheetMatchesSlug(sheetName: string, slug: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
  const s = norm(sheetName);
  const t = norm(slug);
  if (s === t) return true;
  // One contains the other
  if (s.includes(t) || t.includes(s)) return true;
  // First 5 characters match (handles Tirumph/triumph, SriLanka/srilanka)
  if (s.length >= 4 && t.length >= 4 && s.slice(0, 5) === t.slice(0, 5)) return true;
  return false;
}

// ── Build unique column headers (handle duplicate names in Excel) ─────────────
function buildUniqueHeaders(row: ExcelJS.Row): string[] {
  const seen = new Map<string, number>();
  const headers: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell) => {
    const raw = cell.text?.trim() ?? "";
    if (!raw) {
      headers.push(""); // keep position
      return;
    }
    const count = seen.get(raw) ?? 0;
    seen.set(raw, count + 1);
    headers.push(count === 0 ? raw : `${raw}_${count + 1}`);
  });
  return headers;
}

// ─── POST /api/bajaj/import?module=srilanka&phase=preview|confirm ─────────────
export async function POST(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module");
  const phase = req.nextUrl.searchParams.get("phase") ?? "preview";

  if (!moduleSlug) {
    return NextResponse.json({ error: "Missing module query param" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: mod, error: modError } = await supabase
    .from("bajaj_modules")
    .select("id")
    .eq("slug", moduleSlug)
    .single();

  if (modError || !mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // ─── Read Color Coding Legend sheet ────────────────────────────────────────
  // Scans EVERY cell in each legend row:
  //   - Background fill colour → status colour (e.g. Yellow, Green, Pink, Orange, Cyan)
  //   - Font colour fallback → for HAZ Container which uses red font, not background fill
  //   - All text-bearing cells → joined = status name
  const legendSheet = workbook.getWorksheet("Color Coding Legend");
  const colorMap = new Map<string, string>(); // hex → status name

  if (legendSheet) {
    legendSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header row

      let foundHex: string | null = null;
      const textParts: string[] = [];

      // Scan ALL cells in this legend row
      row.eachCell({ includeEmpty: false }, (cell) => {
        // Collect text
        const txt = cell.text?.trim();
        if (txt && !/^[0-9A-Fa-f]{6}$/.test(txt)) {
          // Ignore bare hex strings like "FFFF00" as text — those are code labels
          textParts.push(txt);
        }

        // Priority 1: background fill colour
        if (!foundHex) {
          const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
          const hex = hexFromARGB(fill?.fgColor?.argb);
          if (hex) foundHex = hex;
        }

        // Priority 2: font colour (catches "HAZ Container" entries styled with red text, no fill)
        if (!foundHex) {
          const font = cell.font as { color?: { argb?: string } } | undefined;
          const hex = hexFromARGB(font?.color?.argb);
          if (hex) foundHex = hex;
        }
      });

      // If we found a colour, map it to the cleaned status name
      if (foundHex) {
        const rawName = textParts.join(" ").trim();
        const name = stripColorDescriptor(rawName) || `Status (${foundHex})`;
        if (!colorMap.has(foundHex)) {
          colorMap.set(foundHex, name);
        }
      }
    });
  }

  // ─── Find target sheet (fuzzy match) ──────────────────────────────────────
  // Priority: exact → normalised exact → starts-with / contains → first data sheet
  const SKIP_SHEET_KEYWORDS = ["legend", "original data", "original"];

  function isSkipSheet(name: string) {
    return SKIP_SHEET_KEYWORDS.some((k) => name.toLowerCase().includes(k));
  }

  let dataSheet: ExcelJS.Worksheet | undefined;

  // Pass 1: exact or fuzzy match on slug
  workbook.eachSheet((sheet) => {
    if (!dataSheet && !isSkipSheet(sheet.name) && sheetMatchesSlug(sheet.name, moduleSlug)) {
      dataSheet = sheet;
    }
  });

  // Pass 2: fallback — first non-legend, non-original sheet
  if (!dataSheet) {
    workbook.eachSheet((sheet) => {
      if (!dataSheet && !isSkipSheet(sheet.name)) {
        dataSheet = sheet;
      }
    });
  }

  if (!dataSheet) {
    // Return available sheet names to help debug
    const names: string[] = [];
    workbook.eachSheet((s) => names.push(s.name));
    return NextResponse.json(
      { error: `No matching sheet for "${moduleSlug}". Available: ${names.join(", ")}` },
      { status: 404 }
    );
  }

  // ─── Build column headers (deduplicated) ─────────────────────────────────
  const headers = buildUniqueHeaders(dataSheet.getRow(1));
  // Count how many columns actually have headers
  const lastHeaderIdx = headers.reduce((last, h, i) => (h ? i : last), -1);
  const activeHeaders = headers.slice(0, lastHeaderIdx + 1);

  // ─── Scan data rows ───────────────────────────────────────────────────────
  const detectedStatuses = new Map<string, { colorHex: string; name: string; rowCount: number }>();
  const rows: { data: Record<string, unknown>; colorHex: string | null }[] = [];

  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    // Detect colour across the whole row: background fill first, font colour fallback
    const hex = getRowColorHex(row, Math.max(activeHeaders.length, 5));

    // Build data object
    const rowData: Record<string, unknown> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = activeHeaders[colNumber - 1];
      if (header) {
        const raw = cell.text?.trim() ?? "";
        rowData[header] = raw !== "" ? raw : cell.value;
        hasData = true;
      }
    });

    if (!hasData) return;
    rows.push({ data: rowData, colorHex: hex });

    if (hex) {
      if (!detectedStatuses.has(hex)) {
        const name = colorMap.get(hex) ?? `Status (${hex})`;
        detectedStatuses.set(hex, { colorHex: hex, name, rowCount: 0 });
      }
      detectedStatuses.get(hex)!.rowCount++;
    }
  });

  // ─── Merge legend colours + data-detected colours ─────────────────────────
  // Legend colours always appear as columns (rowCount=0 if no rows use that colour yet).
  // This ensures all 7 Kanban columns exist even if a particular sheet only uses 3 of them.
  const mergedStatuses: { colorHex: string; name: string; rowCount: number }[] = [];

  // 1. Start with every colour from the Color Coding Legend
  for (const [hex, name] of colorMap.entries()) {
    mergedStatuses.push({
      colorHex: hex,
      name,
      rowCount: detectedStatuses.get(hex)?.rowCount ?? 0,
    });
  }

  // 2. Add any colours found in data rows that aren't already in the legend
  for (const stat of detectedStatuses.values()) {
    if (!colorMap.has(stat.colorHex)) {
      mergedStatuses.push(stat);
    }
  }

  // 3. Fallback: if legend is missing AND no data colours found
  const statusesOut = mergedStatuses.length > 0
    ? mergedStatuses
    : [{ colorHex: "808080", name: "Unclassified", rowCount: rows.length }];

  // ── PREVIEW phase ──────────────────────────────────────────────────────────
  if (phase === "preview") {
    return NextResponse.json({
      statuses: statusesOut,
      columns: activeHeaders.filter(Boolean),
      preview: rows.slice(0, 5).map((r) => r.data),
      totalRows: rows.length,
      moduleSlug,
      sheetName: (dataSheet as ExcelJS.Worksheet).name,
    });
  }

  // ── CONFIRM phase ──────────────────────────────────────────────────────────
  const configRaw = formData.get("config");
  if (!configRaw) {
    return NextResponse.json({ error: "Missing config for confirm phase" }, { status: 400 });
  }

  const config = JSON.parse(configRaw as string) as {
    statuses: { colorHex: string; name: string }[];
    cardFaceFields: string[];
    uniqueKeyField: string;
    importedBy: string;
  };

  // Upsert statuses
  const statusIdMap = new Map<string, string>();
  for (let i = 0; i < config.statuses.length; i++) {
    const s = config.statuses[i];
    const { data: existing } = await supabase
      .from("bajaj_statuses")
      .select("id")
      .eq("module_id", mod.id)
      .eq("color_hex", s.colorHex)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("bajaj_statuses")
        .update({ name: s.name, display_order: i })
        .eq("id", existing.id);
      statusIdMap.set(s.colorHex, existing.id);
    } else {
      const { data: inserted } = await supabase
        .from("bajaj_statuses")
        .insert({ module_id: mod.id, name: s.name, color_hex: s.colorHex, display_order: i })
        .select("id")
        .single();
      if (inserted) statusIdMap.set(s.colorHex, inserted.id);
    }
  }

  // Upsert board config
  await supabase.from("bajaj_board_config").upsert({
    module_id: mod.id,
    card_face_fields: config.cardFaceFields,
    unique_key_field: config.uniqueKeyField,
    updated_at: new Date().toISOString(),
  });

  // Deduplication
  const { data: existingWOs } = await supabase
    .from("bajaj_work_orders")
    .select("data")
    .eq("module_id", mod.id);

  const existingKeys = new Set(
    (existingWOs ?? []).map((wo) =>
      String((wo.data as Record<string, unknown>)[config.uniqueKeyField] ?? "")
    )
  );

  // Import batch
  const { data: batch } = await supabase
    .from("bajaj_import_batches")
    .insert({
      module_id: mod.id,
      filename: file.name,
      imported_by: config.importedBy,
      row_count: rows.length,
      added_count: 0,
    })
    .select("id")
    .single();

  // Insert new rows
  const toInsert: Record<string, unknown>[] = [];
  let addedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const uniqueVal = String(row.data[config.uniqueKeyField] ?? "");
    if (existingKeys.has(uniqueVal) && uniqueVal !== "") continue;

    const statusId = row.colorHex ? (statusIdMap.get(row.colorHex) ?? null) : null;
    toInsert.push({
      module_id: mod.id,
      status_id: statusId,
      data: row.data,
      column_order: i,
      import_batch_id: batch?.id ?? null,
    });
    addedCount++;
  }

  if (toInsert.length > 0) {
    await supabase.from("bajaj_work_orders").insert(toInsert);
  }

  if (batch) {
    await supabase
      .from("bajaj_import_batches")
      .update({ added_count: addedCount })
      .eq("id", batch.id);
  }

  await supabase.from("bajaj_audit_logs").insert({
    actor_id: config.importedBy,
    actor_email: "system",
    action: "imported",
    target_type: "import_batch",
    target_id: batch?.id ?? null,
    new_value: {
      module: moduleSlug,
      sheet: (dataSheet as ExcelJS.Worksheet).name,
      filename: file.name,
      added: addedCount,
      skipped: rows.length - addedCount,
    },
  });

  return NextResponse.json({
    success: true,
    added: addedCount,
    skipped: rows.length - addedCount,
    total: rows.length,
    sheetName: (dataSheet as ExcelJS.Worksheet).name,
  });
}
