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

function hexFromARGB(argb: string | undefined): string | null {
  if (!argb || argb.length < 6) return null;
  // ExcelJS ARGB format: AARRGGBB — drop the AA prefix
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return hex.toUpperCase();
}


// ─── POST /api/bajaj/import?module=srilanka&phase=preview|confirm ─────────────
export async function POST(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module");
  const phase = req.nextUrl.searchParams.get("phase") ?? "preview";

  if (!moduleSlug) {
    return NextResponse.json({ error: "Missing module query param" }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Look up module
  const { data: mod, error: modError } = await supabase
    .from("bajaj_modules")
    .select("id")
    .eq("slug", moduleSlug)
    .single();

  if (modError || !mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  // Parse multipart form — get the file
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // ─── Read Color Coding Legend sheet ────────────────────────────────────────
  const legendSheet = workbook.getWorksheet("Color Coding Legend");
  const colorMap = new Map<string, string>(); // hex → status name

  if (legendSheet) {
    legendSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const nameCell = row.getCell(1);
      const colorCell = row.getCell(2); // assume col B has the hex or fill

      // Try to read fill color from cell A (the colored cell)
      const fill = nameCell.fill as { fgColor?: { argb?: string } } | undefined;
      const argb = fill?.fgColor?.argb;
      const hex = hexFromARGB(argb);
      const name = nameCell.text?.trim() || colorCell.text?.trim();

      if (hex && name) {
        colorMap.set(hex, name);
      }
    });
  }

  // ─── Read target sheet ─────────────────────────────────────────────────────
  // Try exact match first, then case-insensitive
  let dataSheet = workbook.getWorksheet(moduleSlug);
  if (!dataSheet) {
    workbook.eachSheet((sheet) => {
      if (sheet.name.toLowerCase().replace(/\s/g, "") === moduleSlug.toLowerCase()) {
        dataSheet = sheet;
      }
    });
  }
  // Fallback: first non-legend sheet
  if (!dataSheet) {
    workbook.eachSheet((sheet) => {
      if (!dataSheet && !sheet.name.toLowerCase().includes("legend") && !sheet.name.toLowerCase().includes("original")) {
        dataSheet = sheet;
      }
    });
  }

  if (!dataSheet) {
    return NextResponse.json({ error: `Sheet not found for module: ${moduleSlug}` }, { status: 404 });
  }

  // Get headers from row 1
  const headers: string[] = [];
  const headerRow = dataSheet.getRow(1);
  headerRow.eachCell((cell) => {
    headers.push(cell.text?.trim() ?? "");
  });

  // Collect statuses from data rows
  const detectedStatuses = new Map<string, { hex: string; name: string; count: number }>();
  const rows: { data: Record<string, unknown>; colorHex: string | null }[] = [];

  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    // Determine row color from first cell fill
    const firstCell = row.getCell(1);
    const fill = firstCell.fill as { fgColor?: { argb?: string } } | undefined;
    const argb = fill?.fgColor?.argb;
    const hex = hexFromARGB(argb);

    // Build row data object
    const rowData: Record<string, unknown> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.text?.trim() ?? cell.value;
        hasData = true;
      }
    });

    if (!hasData) return;
    rows.push({ data: rowData, colorHex: hex });

    if (hex) {
      if (!detectedStatuses.has(hex)) {
        const name = colorMap.get(hex) ?? `Status (${hex})`;
        detectedStatuses.set(hex, { hex, name, count: 0 });
      }
      detectedStatuses.get(hex)!.count++;
    }
  });

  const statuses = Array.from(detectedStatuses.values());

  // ── PREVIEW phase: return columns + statuses + sample rows ─────────────────
  if (phase === "preview") {
    return NextResponse.json({
      statuses,
      columns: headers.filter(Boolean),
      preview: rows.slice(0, 5).map((r) => r.data),
      totalRows: rows.length,
      moduleSlug,
    });
  }

  // ── CONFIRM phase: save config + insert work orders ────────────────────────
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

  // Upsert statuses into DB
  const statusIdMap = new Map<string, string>(); // hex → uuid

  for (let i = 0; i < config.statuses.length; i++) {
    const s = config.statuses[i];
    const { data: existing } = await supabase
      .from("bajaj_statuses")
      .select("id")
      .eq("module_id", mod.id)
      .eq("color_hex", s.colorHex)
      .maybeSingle();

    if (existing) {
      // Update name + display_order
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

  // Fetch existing unique key values for deduplication
  const { data: existingWOs } = await supabase
    .from("bajaj_work_orders")
    .select("data")
    .eq("module_id", mod.id);

  const existingKeys = new Set(
    (existingWOs ?? []).map((wo) => String((wo.data as Record<string, unknown>)[config.uniqueKeyField] ?? ""))
  );

  // Create import batch
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
  const toInsert = [];
  let addedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const uniqueVal = String(row.data[config.uniqueKeyField] ?? "");

    if (existingKeys.has(uniqueVal) && uniqueVal !== "") continue;

    const statusId = row.colorHex ? statusIdMap.get(row.colorHex) ?? null : null;

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

  // Update batch added count
  if (batch) {
    await supabase
      .from("bajaj_import_batches")
      .update({ added_count: addedCount })
      .eq("id", batch.id);
  }

  // Write audit log
  await supabase.from("bajaj_audit_logs").insert({
    actor_id: config.importedBy,
    actor_email: "system",
    action: "imported",
    target_type: "import_batch",
    target_id: batch?.id ?? null,
    new_value: { module: moduleSlug, filename: file.name, added: addedCount, skipped: rows.length - addedCount },
  });

  return NextResponse.json({
    success: true,
    added: addedCount,
    skipped: rows.length - addedCount,
    total: rows.length,
  });
}
