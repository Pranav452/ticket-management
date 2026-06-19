/**
 * Refill Bajaj boards from the June 2026 Excel sheet.
 * Parses each module sheet, maps all columns to the canonical data vocabulary,
 * derives a lifecycle status + parts/frames tag, and inserts one card per row.
 *
 *   node scripts/import-june-2026.mjs ["C:/path/to/Bajaj June Sheet 2026.xlsx"]
 *
 * No WO dedup (multi-container legs are distinct cards). Idempotent only if the
 * table was wiped first — re-running appends.
 */
import ExcelJS from "exceljs";
import { sb } from "./_sb.mjs";
import {
  SHEET_MODULE_MAP, normHeader, buildColMap, buildRecord, deriveStatusName,
} from "../lib/bajaj/import-map.mjs";

const XLSX_PATH = process.argv[2] || "C:/Users/Manilal/Downloads/Bajaj June Sheet 2026.xlsx";
const IMPORTED_BY = process.env.DEV_EMAIL || "system";
const CHUNK = 500;

/* ── load reference data ──────────────────────────────────────────────────── */
const { data: modules, error: mErr } = await sb.from("bajaj_modules").select("id, slug");
if (mErr) { console.error(mErr.message); process.exit(1); }
const modIdBySlug = Object.fromEntries(modules.map((m) => [m.slug, m.id]));

const { data: statuses, error: sErr } = await sb.from("bajaj_statuses").select("id, module_id, name");
if (sErr) { console.error(sErr.message); process.exit(1); }
const statusIdByModuleName = {};
for (const s of statuses) (statusIdByModuleName[s.module_id] ??= {})[s.name] = s.id;

/* ── parse workbook ───────────────────────────────────────────────────────── */
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX_PATH);

const byModule = {}; // slug → [{ data, statusName }]

for (const ws of wb.worksheets) {
  const cfg = SHEET_MODULE_MAP[normHeader(ws.name)];
  if (!cfg) { console.log(`skip sheet "${ws.name}" (not a module sheet)`); continue; }
  const colMap = buildColMap(ws.getRow(1).values);
  if (!Object.values(colMap).includes("wo")) { console.log(`skip "${ws.name}" — no WO column`); continue; }

  let rows = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const data = buildRecord(colMap, ws.getRow(r).values, { partsFrames: cfg.partsFrames });
    if (!data) continue;
    (byModule[cfg.slug] ??= []).push({ data, statusName: deriveStatusName(data) });
    rows++;
  }
  console.log(`sheet "${ws.name}" → ${cfg.slug}: ${rows} rows`);
}

/* ── insert per module ────────────────────────────────────────────────────── */
let grand = 0;
for (const [slug, items] of Object.entries(byModule)) {
  const moduleId = modIdBySlug[slug];
  const nameToId = statusIdByModuleName[moduleId] || {};

  // import batch (counts patched after insert)
  const { data: batch, error: bErr } = await sb.from("bajaj_import_batches").insert({
    module_id: moduleId, module_slug: slug,
    filename: "Bajaj June Sheet 2026.xlsx", imported_by: IMPORTED_BY,
    row_count: items.length, added_count: 0, skipped_count: 0,
  }).select("id").single();
  if (bErr) { console.error(`batch ${slug}: ${bErr.message}`); process.exit(1); }

  // column_order per status bucket
  const orderBy = {};
  const insertRows = items.map(({ data, statusName }) => {
    const statusId = nameToId[statusName] ?? null;
    const key = statusName;
    const column_order = (orderBy[key] = (orderBy[key] ?? -1) + 1);
    return { module_id: moduleId, module_slug: slug, status_id: statusId, column_order, data, import_batch_id: batch.id };
  });

  let added = 0;
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const slice = insertRows.slice(i, i + CHUNK);
    const { data: ins, error } = await sb.from("bajaj_work_orders").insert(slice).select("id");
    if (error) { console.error(`insert ${slug}: ${error.message}`); process.exit(1); }
    added += ins.length;
  }
  await sb.from("bajaj_import_batches").update({ added_count: added }).eq("id", batch.id);
  grand += added;

  // status distribution
  const dist = {};
  for (const { statusName } of items) dist[statusName] = (dist[statusName] ?? 0) + 1;
  console.log(`\n${slug}: inserted ${added}`);
  console.log("  status:", JSON.stringify(dist));
  if (slug === "srilanka") {
    const cat = {};
    for (const { data } of items) if (data.category) cat[data.category] = (cat[data.category] ?? 0) + 1;
    console.log("  parts/frames tag:", JSON.stringify(cat));
  }
}

console.log(`\nTOTAL inserted: ${grand}`);
process.exit(0);
