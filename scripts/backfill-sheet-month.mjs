/**
 * One-off backfill for the monthly multi-workbook migration:
 *   1. Set data.sheet_month = "2026-07" on every bajaj_work_orders row that
 *      lacks it (all pre-migration rows came from the July 2026 workbook).
 *   2. Copy app_config."bajaj_bookings" → "bajaj_bookings:2026-07" if the
 *      per-month key does not exist yet.
 *
 * Idempotent — safe to re-run. Usage: node scripts/backfill-sheet-month.mjs
 */
import { sb, fetchAll } from "./_sb.mjs";

const MONTH = "2026-07";
const MONTH_KEY = `bajaj_bookings:${MONTH}`;

// ── 1. sheet_month backfill ──────────────────────────────────────────────────
const rows = await fetchAll("bajaj_work_orders", "id, data");
console.log(`bajaj_work_orders: ${rows.length} rows total`);

let updated = 0;
let skipped = 0;
for (const row of rows) {
  const data = row.data ?? {};
  if (String(data.sheet_month ?? "").trim()) { skipped++; continue; }
  data.sheet_month = MONTH;
  const { error } = await sb.from("bajaj_work_orders").update({ data }).eq("id", row.id);
  if (error) {
    console.error(`  FAILED ${row.id}: ${error.message}`);
    process.exit(1);
  }
  updated++;
}
console.log(`  sheet_month="${MONTH}" set on ${updated} rows (${skipped} already had one)`);

// ── 2. bookings copy ─────────────────────────────────────────────────────────
const { data: monthly, error: monthlyErr } = await sb
  .from("app_config").select("value").eq("key", MONTH_KEY).maybeSingle();
if (monthlyErr) {
  console.error(`app_config read failed: ${monthlyErr.message}`);
  process.exit(1);
}

if (monthly?.value) {
  console.log(`app_config."${MONTH_KEY}" already exists — bookings copy skipped`);
} else {
  const { data: legacy, error: legacyErr } = await sb
    .from("app_config").select("value").eq("key", "bajaj_bookings").maybeSingle();
  if (legacyErr) {
    console.error(`app_config read failed: ${legacyErr.message}`);
    process.exit(1);
  }
  if (!legacy?.value) {
    console.log(`app_config."bajaj_bookings" not found — nothing to copy`);
  } else {
    const { error } = await sb
      .from("app_config")
      .upsert({ key: MONTH_KEY, value: legacy.value }, { onConflict: "key" });
    if (error) {
      console.error(`bookings copy failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`app_config."bajaj_bookings" copied → "${MONTH_KEY}"`);
  }
}

console.log("Backfill complete.");
