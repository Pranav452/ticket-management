/**
 * Google Sheet → bajaj_work_orders sync.
 *
 * Replaces the manual xlsx/paste/manual-form entry paths: the ops team keeps a
 * single Google Sheet (one tab per module, same layout as the old Excel files)
 * and this module pulls it via the read-only service-account client.
 *
 * Mapping / status derivation is shared with lib/bajaj/import-map.mjs so sheet
 * rows produce exactly the same records the old import route produced.
 *
 * Semantics:
 *   - dedup key = `${wo}|${container_no}|${booking_no}` (same as old import),
 *     with progressive fallback matching (`wo|cont|""`, `wo|""|bkg`, `wo|""|""`)
 *     so a card keeps its identity when ops later fills in the booking or
 *     container number and the full key changes
 *   - existing row  → merge sheet data over stored data; when the merged data
 *                     derives a LATER stage than the card's current column the
 *                     card auto-advances forward (never backward), with the
 *                     same sole-editor auto-assignment as a manual move
 *   - new row       → inserted with derived status (fallback Planning) at the
 *                     end of the board; Sri-Lanka validation issues are
 *                     reported as warnings, never block the insert
 *   - DB row missing from sheet → reported, NEVER deleted or modified
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateWorkOrderRules } from "@/lib/bajaj/validation";
import { fetchSheetRows, listSheetTabs, sheetSyncEnabled, missingSheetSyncEnv } from "@/lib/bajaj/google-sheets";
import {
  SHEET_MODULE_MAP, normHeader, buildColMap, buildRecord, deriveStatusName, formatCell,
} from "@/lib/bajaj/import-map.mjs";

/* Same defaults as the old /api/bajaj/import route. */
const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

/* Canonical keys that hold dates. UNFORMATTED_VALUE returns Google/Excel
 * date serial numbers for date cells — these keys get serial → YYYY-MM-DD
 * conversion before the shared coercion runs (which would stringify them). */
const DATE_KEYS = new Set([
  "wodt", "stuffing_dt", "lc_date", "do_given_dt", "gate_open", "gate_cut_off",
  "si_cutoff", "do_etd", "current_etd", "eta_at_destination", "final_vsl_sob",
  "bldt", "bl_handover_time", "courier_dt", "pickup_dt", "cntr_dispatch",
  "cntr_report", "cntr_gated", "sb_date", "sailingdt", "si_submitted", "vgm_submitted",
]);

/** Plausible date-serial window: ~1954 … ~2064. */
const SERIAL_MIN = 20000;
const SERIAL_MAX = 60000;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function serialToISODate(n: number): string {
  return new Date(EXCEL_EPOCH_MS + Math.round(n * 86_400_000)).toISOString().slice(0, 10);
}

/* ── Bookings list (app_config.bajaj_bookings) ──────────────────────────────
 * The "Bookings Details" tab replaces in-app booking editing: the whole list
 * is rebuilt from the sheet on every sync. Header mapping is local to this
 * tab (it does not share the work-order HEADER_MAP). */
const BOOKINGS_TAB_NAME = "Bookings Details";
const BOOKINGS_CONFIG_KEY = "bajaj_bookings";

const BOOKING_HEADER_MAP: Record<string, string> = {
  "ref no":   "ref_no",
  "bkg no":   "bkg_no",
  "cntr qty": "cntr_qty",
  "line":     "line",
  "validity": "validity",
};

function bookingKeyForHeader(h: unknown): string | null {
  const norm = normHeader(h) as string;
  // The vessel columns appear with inconsistent spacing around "/" in the
  // sheet ("Place /Require BKG on VSL", "Place/Require…") — match loosely.
  if (norm.includes("bkg on vsl")) {
    if (norm.includes("place")) return "place_req_vsl";
    if (norm.includes("received")) return "received_vsl";
  }
  return BOOKING_HEADER_MAP[norm] ?? null;
}

/** Grid (row 1 = headers) → booking rows. Rows without a BKG number are skipped. */
function buildBookingRows(grid: unknown[][]): Record<string, string>[] {
  if (grid.length < 2) return [];
  const cols: { idx: number; key: string }[] = [];
  (grid[0] ?? []).forEach((h, idx) => {
    const key = bookingKeyForHeader(h);
    if (key) cols.push({ idx, key });
  });
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row: Record<string, string> = {};
    for (const { idx, key } of cols) {
      let v: unknown = grid[i]?.[idx];
      // "validity" is a date column — convert Google/Excel serials to ISO.
      if (key === "validity" && typeof v === "number" && v >= SERIAL_MIN && v <= SERIAL_MAX) {
        v = serialToISODate(v);
      }
      const formatted = formatCell(v);
      if (formatted != null) row[key] = String(formatted);
    }
    if (!String(row["bkg_no"] ?? "").trim()) continue;
    rows.push(row);
  }
  return rows;
}

/** Composite dedup key — must match the old import route exactly. */
function rowKey(d: Record<string, unknown>): string {
  // Case-insensitive: ops occasionally re-type a WO with different casing
  // ("5327994/l1" → "5327994/L1") — that must not spawn a duplicate card.
  return [d["wo"], d["container_no"], d["booking_no"]]
    .map((v) => String(v ?? "").trim().toUpperCase())
    .join("|");
}

/**
 * Progressive match candidates for a sheet record, most → least specific.
 * When ops fills in a booking/container number on an existing row the full key
 * changes; the fallbacks let the sheet row re-adopt the card it came from
 * instead of inserting a duplicate. Exact key always wins first, so legitimate
 * multi-row WOs (same WO, different containers) stay separate.
 */
function candidateKeys(d: Record<string, unknown>): string[] {
  const wo   = String(d["wo"] ?? "").trim().toUpperCase();
  const cont = String(d["container_no"] ?? "").trim().toUpperCase();
  const bkg  = String(d["booking_no"] ?? "").trim().toUpperCase();
  return [...new Set([
    `${wo}|${cont}|${bkg}`,
    `${wo}|${cont}|`,
    `${wo}||${bkg}`,
    `${wo}||`,
  ])];
}

/** Order-insensitive deep equality for plain JSON data objects. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}
function deepEquals(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export interface TabSyncResult {
  tab: string;
  module: string;
  rows: number;
  inserted: number;
  updated: number;
  /** Cards moved (or that would move, in dryRun) forward to a later stage. */
  moved: number;
  unchanged: number;
  violations: string[];
  /** WOs present in the DB for this module but absent from the sheet (never touched). */
  missingFromSheet: string[];
  /** WO numbers that were (or would be, in dryRun) inserted. */
  wouldInsert: string[];
  /** WO numbers that were (or would be, in dryRun) updated. */
  wouldUpdate: string[];
  /** "WO: From → To" strings for cards moved (or that would move, in dryRun). */
  wouldMove: string[];
}

export interface BookingsSyncResult {
  tab: string;
  rows: number;
  /** Row count of the previously stored bajaj_bookings list. */
  previous: number;
  /** True when the stored list was actually replaced (never in dryRun). */
  replaced: boolean;
  error?: string;
}

export interface SheetSyncResult {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  tabs: TabSyncResult[];
  bookings?: BookingsSyncResult;
  totals: {
    rows: number;
    inserted: number;
    updated: number;
    moved: number;
    unchanged: number;
    violations: number;
    missingFromSheet: number;
  };
}

interface ExistingRow { id: string; wo: string; status_id: string | null; data: Record<string, unknown> }

interface ModCtx {
  id: string;
  slug: string;
  statusIdByName: Record<string, string>;
  /** status name → display_order (board column position). */
  statusOrderByName: Record<string, number>;
  /** status id → status name. */
  statusNameById: Record<string, string>;
  /** status id → sole can_edit editor's email (only statuses with exactly one). */
  soleEditorByStatusId: Record<string, string>;
  /** dedup key → existing DB row */
  existing: Map<string, ExistingRow>;
  /** dedup keys seen in the sheet (across all tabs mapping to this module) */
  seenKeys: Set<string>;
  /** ids of existing DB rows matched (exactly or via fallback) this run. */
  claimedIds: Set<string>;
  /** running max column_order for appended inserts (old route's approach) */
  order: number;
  inserted: number;
  updated: number;
  moved: number;
  rowCount: number;
  /** first tab result for this module — carries missingFromSheet */
  firstTab: TabSyncResult | null;
}

async function getModCtx(
  sb: SupabaseClient, cache: Map<string, ModCtx>, slug: string,
): Promise<ModCtx | null> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const { data: mod } = await sb.from("bajaj_modules").select("id").eq("slug", slug).single();
  if (!mod) return null;

  const { data: statusRows } = await sb
    .from("bajaj_statuses").select("id, name, display_order").eq("module_id", mod.id);
  const statusIdByName:    Record<string, string> = {};
  const statusOrderByName: Record<string, number> = {};
  const statusNameById:    Record<string, string> = {};
  for (const s of statusRows ?? []) {
    statusIdByName[s.name]    = s.id;
    statusOrderByName[s.name] = Number(s.display_order) || 0;
    statusNameById[s.id]      = s.name;
  }

  // Sole-editor lookup for auto-assignment on auto-moves (mirrors RULE 7 in
  // lib/bajaj/workflow.ts, prefetched here so the sync loop stays batch-only).
  const { data: assignRows } = await sb
    .from("bajaj_column_assignments")
    .select("status_id, user_email")
    .eq("module_slug", slug)
    .eq("can_edit", true);
  const editorsByStatusId: Record<string, string[]> = {};
  for (const a of assignRows ?? []) (editorsByStatusId[a.status_id] ??= []).push(a.user_email);
  const soleEditorByStatusId: Record<string, string> = {};
  for (const [sid, emails] of Object.entries(editorsByStatusId)) {
    if (emails.length === 1) soleEditorByStatusId[sid] = emails[0];
  }

  const { data: existingRows } = await sb
    .from("bajaj_work_orders")
    .select("id, data, column_order, status_id")
    .eq("module_slug", slug);

  const existing = new Map<string, ExistingRow>();
  let order = 0;
  for (const r of existingRows ?? []) {
    const d = (r.data ?? {}) as Record<string, unknown>;
    existing.set(rowKey(d), {
      id: r.id, wo: String(d["wo"] ?? "").trim(),
      status_id: (r.status_id as string | null) ?? null, data: d,
    });
    order = Math.max(order, Number(r.column_order) || 0);
  }

  const ctx: ModCtx = {
    id: mod.id, slug, statusIdByName, statusOrderByName, statusNameById,
    soleEditorByStatusId, existing,
    seenKeys: new Set(), claimedIds: new Set(), order,
    inserted: 0, updated: 0, moved: 0, rowCount: 0, firstTab: null,
  };
  cache.set(slug, ctx);
  return ctx;
}

export interface SheetSyncOptions { dryRun?: boolean }

/**
 * Pull every recognized tab of the configured Google Sheet and reconcile it
 * into bajaj_work_orders. Never throws — failures come back as { ok: false }.
 */
export async function runSheetSync(actor: string, opts: SheetSyncOptions = {}): Promise<SheetSyncResult> {
  const dryRun = !!opts.dryRun;
  const emptyTotals = { rows: 0, inserted: 0, updated: 0, moved: 0, unchanged: 0, violations: 0, missingFromSheet: 0 };

  try {
    if (!sheetSyncEnabled()) {
      return {
        ok: false, dryRun, tabs: [], totals: emptyTotals,
        error: `Google Sheet sync is not configured — missing env: ${missingSheetSyncEnv().join(", ")}`,
      };
    }

    const sheetId = process.env.BAJAJ_SHEET_ID!;
    const sb = createAdminClient();
    const ctxCache = new Map<string, ModCtx>();
    const tabResults: TabSyncResult[] = [];

    const allTabs = await listSheetTabs(sheetId);
    const knownTabs = allTabs.filter((t) => SHEET_MODULE_MAP[normHeader(t)]);
    if (knownTabs.length === 0) {
      return {
        ok: false, dryRun, tabs: [], totals: emptyTotals,
        error: `No recognized module tabs found in the sheet. Tabs present: ${allTabs.join(", ") || "(none)"}`,
      };
    }

    for (const tab of knownTabs) {
      const meta = SHEET_MODULE_MAP[normHeader(tab)];
      const ctx = await getModCtx(sb, ctxCache, meta.slug);
      if (!ctx) continue; // unknown module in DB — skip rather than fail the sync

      const result: TabSyncResult = {
        tab, module: meta.slug, rows: 0, inserted: 0, updated: 0, moved: 0, unchanged: 0,
        violations: [], missingFromSheet: [], wouldInsert: [], wouldUpdate: [], wouldMove: [],
      };
      tabResults.push(result);
      if (!ctx.firstTab) ctx.firstTab = result;

      const gridRows = await fetchSheetRows(sheetId, tab);
      if (gridRows.length < 2) continue;

      // Adapter shim (a): Sheets rows are 0-based arrays; the shared mapping
      // helpers expect ExcelJS-style 1-based arrays with an empty slot 0.
      const colMap = buildColMap([null, ...gridRows[0]]) as Record<string, string>;
      if (!Object.values(colMap).includes("wo")) continue; // no WO column — not a work-order tab

      const defaultCountry = MODULE_DEFAULT_COUNTRY[meta.slug] ?? null;
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: {
        id: string; data: Record<string, unknown>; status_id?: string; column_order?: number;
      }[] = [];
      const moveAudits: Record<string, unknown>[] = [];

      for (let i = 1; i < gridRows.length; i++) {
        const oneBased: unknown[] = [null, ...gridRows[i]];

        // Adapter shim (b): convert date serials → YYYY-MM-DD for date keys
        // BEFORE the shared coercion turns them into plain number strings.
        for (const [idxStr, key] of Object.entries(colMap)) {
          if (!DATE_KEYS.has(key)) continue;
          const idx = parseInt(idxStr, 10);
          const v = oneBased[idx];
          if (typeof v === "number" && v >= SERIAL_MIN && v <= SERIAL_MAX) {
            oneBased[idx] = serialToISODate(v);
          }
        }

        const data = buildRecord(colMap, oneBased, { partsFrames: !!meta.partsFrames }) as
          | Record<string, unknown> | null;
        if (!data) continue; // no WO number on this row
        if (!data["country"]) data["country"] = defaultCountry;

        result.rows++;
        ctx.rowCount++;
        const wo = String(data["wo"] ?? "").trim();
        const key = rowKey(data);

        if (ctx.seenKeys.has(key)) { result.unchanged++; continue; } // duplicate sheet row
        ctx.seenKeys.add(key);

        // Progressive matching: exact key first, then fallbacks with the
        // booking/container parts blanked. Skip rows already claimed this run
        // so two sheet rows can never adopt the same card.
        let existing: ExistingRow | undefined;
        for (const k of candidateKeys(data)) {
          const row = ctx.existing.get(k);
          if (row && !ctx.claimedIds.has(row.id)) { existing = row; break; }
        }

        if (existing) {
          ctx.claimedIds.add(existing.id);

          // Merge sheet values over stored data.
          const merged = { ...existing.data, ...data };
          const dataChanged = !deepEquals(merged, existing.data);

          // Forward-only auto-move: when the merged data derives a strictly
          // later stage than the card's current column, advance it. Never
          // moves backward; unknown derived stages are ignored.
          const derived      = deriveStatusName(merged) as string;
          const curName      = ctx.statusNameById[existing.status_id ?? ""];
          const curOrder     = curName !== undefined ? ctx.statusOrderByName[curName] ?? -Infinity : -Infinity;
          const derivedOrder = ctx.statusOrderByName[derived];
          const shouldMove   = derivedOrder !== undefined && derivedOrder > curOrder;

          if (!dataChanged && !shouldMove) { result.unchanged++; continue; }

          if (dataChanged) {
            result.updated++;
            ctx.updated++;
            result.wouldUpdate.push(wo);
          }

          let newStatusId: string | undefined;
          let autoAssigned: string | undefined;
          if (shouldMove) {
            result.moved++;
            ctx.moved++;
            result.wouldMove.push(`${wo}: ${curName ?? "?"} → ${derived}`);
            newStatusId = ctx.statusIdByName[derived];

            // Sole-editor auto-assignment (mirrors workflow.ts RULE 7), done
            // inline on `merged` so the card needs only the one write below.
            const sole = newStatusId ? ctx.soleEditorByStatusId[newStatusId] : undefined;
            const assignKey = `assigned_to_${derived.toLowerCase().replace(/\s+/g, "_")}`;
            if (sole && !merged[assignKey]) {
              merged[assignKey] = sole;
              autoAssigned = sole;
            }
          }

          if (!dryRun) {
            toUpdate.push({
              id: existing.id,
              data: merged,
              ...(shouldMove && newStatusId
                ? { status_id: newStatusId, column_order: ++ctx.order }
                : {}),
            });
            if (shouldMove) {
              moveAudits.push({
                actor_email: "system@sheet-sync",
                action:      "moved_card",
                target_type: "work_order",
                target_id:   existing.id,
                old_value:   { status: curName ?? "?" },
                new_value:   { status: derived, ...(autoAssigned ? { auto_assigned: autoAssigned } : {}) },
              });
            }
          }
          continue;
        }

        // New row → Sri-Lanka business validation. The sheet is the source of
        // truth, so violations are reported but the row is still inserted
        // (unlike the old upload flow, which dropped violating rows).
        const warnings = await validateWorkOrderRules(sb, [{
          country:     data["country"]      ? String(data["country"])      : defaultCountry,
          agent:       data["agent"]        ? String(data["agent"])        : null,
          containerno: data["container_no"] ? String(data["container_no"]) : null,
          vslname:     data["vslname"]      ? String(data["vslname"])      : null,
          assy_config: data["assy_config"]  ? String(data["assy_config"])  : null,
        }]);
        if (warnings.length > 0) {
          result.violations.push(`WO ${wo}: ${warnings.map((w) => w.message).join(" ")}`);
        }

        const statusName = deriveStatusName(data) as string;
        const statusId = ctx.statusIdByName[statusName] ?? ctx.statusIdByName["Planning"] ?? null;
        result.inserted++;
        ctx.inserted++;
        result.wouldInsert.push(wo);
        if (!dryRun) {
          toInsert.push({
            module_id:    ctx.id,
            module_slug:  ctx.slug,
            status_id:    statusId,
            column_order: ++ctx.order,
            data,
          });
        }
      }

      if (!dryRun) {
        for (const upd of toUpdate) {
          const { error } = await sb
            .from("bajaj_work_orders")
            .update({
              data: upd.data,
              updated_at: new Date().toISOString(),
              ...(upd.status_id !== undefined
                ? { status_id: upd.status_id, column_order: upd.column_order }
                : {}),
            })
            .eq("id", upd.id);
          if (error) throw new Error(`Update failed (tab "${tab}"): ${error.message}`);
        }
        if (toInsert.length > 0) {
          const { error } = await sb.from("bajaj_work_orders").insert(toInsert);
          if (error) throw new Error(`Insert failed (tab "${tab}"): ${error.message}`);
        }
        if (moveAudits.length > 0) {
          const { error } = await sb.from("bajaj_audit_logs").insert(moveAudits);
          if (error) throw new Error(`Move audit failed (tab "${tab}"): ${error.message}`);
        }
      }
    }

    // DB rows never claimed by any sheet row (exactly or via fallback) —
    // report only, never touch.
    for (const ctx of ctxCache.values()) {
      if (!ctx.firstTab) continue;
      const missing: string[] = [];
      for (const [key, row] of ctx.existing) {
        if (!ctx.claimedIds.has(row.id)) missing.push(row.wo || key);
      }
      ctx.firstTab.missingFromSheet = missing;
    }

    // ── Bookings list: rebuild app_config.bajaj_bookings from its sheet tab ──
    let bookings: BookingsSyncResult;
    const bookingsTab = allTabs.find((t) => normHeader(t) === normHeader(BOOKINGS_TAB_NAME));
    if (!bookingsTab) {
      bookings = { tab: BOOKINGS_TAB_NAME, rows: 0, previous: 0, replaced: false, error: "tab not found" };
    } else {
      try {
        const grid = await fetchSheetRows(sheetId, bookingsTab);
        const bookingRows = buildBookingRows(grid);

        let previous = 0;
        const { data: prev } = await sb
          .from("app_config").select("value").eq("key", BOOKINGS_CONFIG_KEY).maybeSingle();
        if (prev?.value) {
          try {
            const parsed = JSON.parse(prev.value) as { rows?: unknown };
            if (Array.isArray(parsed.rows)) previous = parsed.rows.length;
          } catch { /* corrupt stored value — treat as empty */ }
        }

        let replaced = false;
        if (!dryRun) {
          // Same stored shape as the reference API: { updated_at, rows }.
          const payload = { updated_at: new Date().toISOString(), rows: bookingRows };
          const { error } = await sb
            .from("app_config")
            .upsert({ key: BOOKINGS_CONFIG_KEY, value: JSON.stringify(payload) }, { onConflict: "key" });
          if (error) throw new Error(`Bookings save failed: ${error.message}`);
          replaced = true;
        }
        bookings = { tab: bookingsTab, rows: bookingRows.length, previous, replaced };
      } catch (err) {
        bookings = {
          tab: bookingsTab, rows: 0, previous: 0, replaced: false,
          error: err instanceof Error ? err.message : "Bookings sync failed",
        };
      }
    }

    const totals = tabResults.reduce(
      (t, r) => ({
        rows:             t.rows + r.rows,
        inserted:         t.inserted + r.inserted,
        updated:          t.updated + r.updated,
        moved:            t.moved + r.moved,
        unchanged:        t.unchanged + r.unchanged,
        violations:       t.violations + r.violations.length,
        missingFromSheet: t.missingFromSheet + r.missingFromSheet.length,
      }),
      { ...emptyTotals },
    );

    if (!dryRun) {
      // One import-batch row per module that changed ("filename" marks the source).
      for (const ctx of ctxCache.values()) {
        if (ctx.inserted === 0 && ctx.updated === 0 && ctx.moved === 0) continue;
        await sb.from("bajaj_import_batches").insert({
          module_id:     ctx.id,
          module_slug:   ctx.slug,
          filename:      "google-sheet",
          imported_by:   actor,
          row_count:     ctx.rowCount,
          added_count:   ctx.inserted,
          skipped_count: ctx.rowCount - ctx.inserted,
        });
      }
      await sb.from("bajaj_audit_logs").insert({
        actor_email: actor,
        action:      "sheet_sync",
        target_type: "google_sheet",
        target_id:   sheetId,
        new_value:   { ...totals, bookings_rows: bookings.error ? 0 : bookings.rows },
      });
    }

    return { ok: true, dryRun, tabs: tabResults, bookings, totals };
  } catch (err) {
    console.error("[sheet-sync]", err);
    return {
      ok: false, dryRun, tabs: [], totals: emptyTotals,
      error: err instanceof Error ? err.message : "Sheet sync failed",
    };
  }
}
