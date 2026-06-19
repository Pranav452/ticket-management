/**
 * Backup the transactional Bajaj tables before wiping.
 * Exports work orders + logs to backups/bajaj-predelete-<date>.json
 *
 *   node scripts/backup-bajaj.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sb, ROOT, fetchAll, count } from "./_sb.mjs";

const TABLES = ["bajaj_work_orders", "bajaj_audit_logs", "bajaj_import_batches", "bajaj_comments", "bajaj_reminders"];

const stamp = new Date().toISOString().slice(0, 10);
const dir = join(ROOT, "backups");
mkdirSync(dir, { recursive: true });
const outFile = join(dir, `bajaj-predelete-${stamp}.json`);

const dump = { exported_at: new Date().toISOString(), project: process.env.NEXT_PUBLIC_SUPABASE_URL, tables: {} };

for (const t of TABLES) {
  const rows = await fetchAll(t);
  dump.tables[t] = rows;
  console.log(`${t.padEnd(24)} ${rows.length} rows`);
}

writeFileSync(outFile, JSON.stringify(dump, null, 2));
console.log(`\nBackup written: ${outFile}`);

// sanity: counts match
let ok = true;
for (const t of TABLES) {
  const c = await count(t);
  if (c !== dump.tables[t].length) { console.error(`MISMATCH ${t}: live=${c} backed=${dump.tables[t].length}`); ok = false; }
}
console.log(ok ? "Counts verified ✓" : "Count mismatch — review before wiping!");
process.exit(ok ? 0 : 1);
