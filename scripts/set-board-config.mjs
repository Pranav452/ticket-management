/**
 * Populate bajaj_board_config for every module so cards show useful chips
 * (incl. the PARTS/FRAMES category tag) instead of the default fallback.
 *
 *   node scripts/set-board-config.mjs
 */
import { sb } from "./_sb.mjs";
import { DEFAULT_CARD_FACE_FIELDS } from "../lib/bajaj/import-map.mjs";

const { data: modules, error } = await sb.from("bajaj_modules").select("id, slug");
if (error) { console.error(error.message); process.exit(1); }

for (const m of modules) {
  const { error: e } = await sb.from("bajaj_board_config").upsert({
    module_id: m.id,
    card_face_fields: DEFAULT_CARD_FACE_FIELDS,
    unique_key_field: "wo",
    updated_at: new Date().toISOString(),
  }, { onConflict: "module_id" });
  if (e) { console.error(`${m.slug}: ${e.message}`); process.exit(1); }
  console.log(`${m.slug.padEnd(12)} card_face_fields = [${DEFAULT_CARD_FACE_FIELDS.join(", ")}]`);
}
console.log("\nBoard config set ✓");
