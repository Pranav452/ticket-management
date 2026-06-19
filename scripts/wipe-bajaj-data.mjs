/**
 * Wipe stale Bajaj work orders + logs. Preserves users, permissions, config,
 * statuses, board config, required-field rules.  RUN backup-bajaj.mjs FIRST.
 *
 *   node scripts/wipe-bajaj-data.mjs
 *
 * FK-safe delete order: comments → reminders → work_orders → import_batches → audit_logs
 */
import { sb, count } from "./_sb.mjs";

const ZERO = "00000000-0000-0000-0000-000000000000";
const DELETE_ORDER = [
  "bajaj_comments",
  "bajaj_reminders",
  "bajaj_work_orders",
  "bajaj_import_batches",
  "bajaj_audit_logs",
];
const PRESERVE = [
  "profiles", "bajaj_users", "bajaj_column_assignments", "bajaj_column_required_fields",
  "bajaj_modules", "bajaj_statuses", "bajaj_board_config", "bajaj_role_permissions",
  "bajaj_auto_progression",
];

console.log("=== BEFORE ===");
for (const t of [...DELETE_ORDER, ...PRESERVE]) console.log(`${t.padEnd(30)} ${await count(t)}`);

console.log("\n=== DELETING ===");
for (const t of DELETE_ORDER) {
  const before = await count(t);
  if (before === 0) { console.log(`${t.padEnd(30)} already empty`); continue; }
  const { error } = await sb.from(t).delete().neq("id", ZERO);
  if (error) { console.error(`${t}: ${error.message}`); process.exit(1); }
  console.log(`${t.padEnd(30)} deleted ${before} → ${await count(t)}`);
}

console.log("\n=== AFTER (preserved tables must be unchanged) ===");
for (const t of PRESERVE) console.log(`${t.padEnd(30)} ${await count(t)}`);
console.log("\nWipe complete ✓");
