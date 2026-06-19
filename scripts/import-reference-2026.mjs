/**
 * Import the June file's non-work-order sheets (Sheet8 bookings, Sheet10 rate card)
 * into app_config as JSON blobs (no DDL needed; service-role write).
 *
 *   node scripts/import-reference-2026.mjs ["C:/path/to/Bajaj June Sheet 2026.xlsx"]
 *
 * Keys written: bajaj_bookings, bajaj_rate_card
 */
import ExcelJS from "exceljs";
import { sb } from "./_sb.mjs";
import { formatCell } from "../lib/bajaj/import-map.mjs";

const XLSX_PATH = process.argv[2] || "C:/Users/Manilal/Downloads/Bajaj June Sheet 2026.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX_PATH);

/* ── Sheet8 → bookings ─────────────────────────────────────────────────────── */
const BOOK_COLS = {
  1: "bkg_no", 2: "bkg_no_alt", 3: "cntr_qty", 4: "pod", 5: "place_req_vsl",
  6: "received_vsl", 7: "etd_required", 8: "etd_received", 9: "line",
  10: "validity", 11: "remark", 12: "wo_ref",
};
const bookings = [];
const s8 = wb.getWorksheet("Sheet8");
if (s8) {
  for (let r = 2; r <= s8.rowCount; r++) {
    const v = s8.getRow(r).values;
    const obj = {};
    for (const [idx, key] of Object.entries(BOOK_COLS)) {
      const val = formatCell(v[parseInt(idx, 10)]);
      if (val != null && val !== "") obj[key] = val;
    }
    if (obj.bkg_no || obj.bkg_no_alt) bookings.push(obj);
  }
}

/* ── Sheet10 → rate card (raw grid, preserved as-is) ───────────────────────── */
let rateGrid = [];
const s10 = wb.getWorksheet("Sheet10");
if (s10) {
  for (let r = 1; r <= s10.rowCount; r++) {
    const row = (s10.getRow(r).values || []).slice(1).map((c) => formatCell(c) ?? "");
    while (row.length && row[row.length - 1] === "") row.pop();
    rateGrid.push(row);
  }
  // drop trailing empty rows
  while (rateGrid.length && rateGrid[rateGrid.length - 1].length === 0) rateGrid.pop();
}

const stamp = new Date().toISOString();
await sb.from("app_config").upsert(
  { key: "bajaj_bookings", value: JSON.stringify({ updated_at: stamp, rows: bookings }) },
  { onConflict: "key" },
);
await sb.from("app_config").upsert(
  { key: "bajaj_rate_card", value: JSON.stringify({ updated_at: stamp, grid: rateGrid }) },
  { onConflict: "key" },
);

console.log(`bookings rows: ${bookings.length}`);
console.log(`rate grid rows: ${rateGrid.length}`);
console.log("sample booking:", JSON.stringify(bookings[0] ?? null));
console.log("Reference data written to app_config ✓");
process.exit(0);
