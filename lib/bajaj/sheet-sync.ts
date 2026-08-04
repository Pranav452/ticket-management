/**
 * Google Sheets → bajaj_work_orders sync (monthly multi-workbook).
 *
 * Ops starts a NEW Google workbook each month (same tab layout); several
 * months run in parallel while shipments finish. The workbook list lives in
 * app_config."bajaj_sheet_sources" (see lib/bajaj/sheet-sources.ts) with the
 * legacy BAJAJ_SHEET_ID env var as a July-2026 fallback that gets auto-seeded
 * into the config on the first real sync.
 *
 * Every work order belongs to a month: data.sheet_month = "YYYY-MM". All
 * matching/dedup is scoped per (module, month) — a July WO number reappearing
 * in the August workbook is a NEW card, never an update of the July one. DB
 * rows without sheet_month (pre-backfill) count as the OLDEST configured
 * month so legacy data still matches the July workbook.
 *
 * Mapping / status derivation is shared with lib/bajaj/import-map.mjs so sheet
 * rows produce exactly the same records the old import route produced.
 *
 * Semantics (per workbook/month):
 *   - dedup key = `${wo}|${container_no}|${booking_no}` (same as old import),
 *     with progressive fallback matching (`wo|cont|""`, `wo|""|bkg`, `wo|""|""`)
 *     so a card keeps its identity when ops later fills in the booking or
 *     container number and the full key changes
 *   - existing row  → merge sheet data over stored data; when the merged data
 *                     derives a LATER stage than the card's current column the
 *                     card auto-advances forward (never backward)
 *   - archived row  → a sheet row matching an ARCHIVED card auto-restores it
 *                     (archived_at/archived_by cleared) and updates it —
 *                     reappearance in the sheet means it's back
 *   - new row       → inserted with derived status (fallback Planning) at the
 *                     end of the board; Sri-Lanka validation issues are
 *                     reported as warnings, never block the insert
 *   - DB row missing from sheet → reported per (module, month), NEVER touched
 *     by the sync itself (archiveMissing in lib/bajaj/archive.ts is the
 *     explicit admin action for those)
 *
 * Bookings: each month's "Bookings Details" tab is stored under
 * app_config."bajaj_bookings:<month>"; the legacy "bajaj_bookings" key keeps
 * mirroring the CURRENT (latest active) month so the existing bookings page
 * works unchanged. After every successful real run a full version snapshot is
 * stored (lib/bajaj/versions.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateWorkOrderRules } from "@/lib/bajaj/validation";
import {
  fetchSheetRows, listSheetTabs, hasGoogleServiceAccount, missingSheetSyncEnv,
} from "@/lib/bajaj/google-sheets";
import {
  resolveSheetSources, saveSheetSources, sheetSyncEnabled, type SheetSource,
} from "@/lib/bajaj/sheet-sources";
import { createVersionSnapshot } from "@/lib/bajaj/versions";
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

/* ── Bookings list (app_config."bajaj_bookings:<month>") ────────────────────
 * The "Bookings Details" tab replaces in-app booking editing: each month's
 * list is rebuilt from that month's workbook on every sync. Header mapping is
 * local to this tab (it does not share the work-order HEADER_MAP). */
const BOOKINGS_TAB_NAME = "Bookings Details";
const LEGACY_BOOKINGS_KEY = "bajaj_bookings";

export function bookingsKeyForMonth(month: string): string {
  return `bajaj_bookings:${month}`;
}

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
/** Normalize a key part: trim, uppercase, collapse inner whitespace runs
 * (container lists get re-typed with double spaces all the time). */
function keyPart(v: unknown): string {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function rowKey(d: Record<string, unknown>): string {
  // Case-insensitive: ops occasionally re-type a WO with different casing
  // ("5327994/l1" → "5327994/L1") — that must not spawn a duplicate card.
  return [d["wo"], d["container_no"], d["booking_no"]].map(keyPart).join("|");
}

/**
 * Progressive match candidates for a sheet record, most → least specific.
 * When ops fills in a booking/container number on an existing row the full key
 * changes; the fallbacks let the sheet row re-adopt the card it came from
 * instead of inserting a duplicate. Exact key always wins first, so legitimate
 * multi-row WOs (same WO, different containers) stay separate.
 */
function candidateKeys(d: Record<string, unknown>): string[] {
  const wo   = keyPart(d["wo"]);
  const cont = keyPart(d["container_no"]);
  const bkg  = keyPart(d["booking_no"]);
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

/** The month a stored row belongs to; NULL sheet_month = oldest configured month. */
function rowMonth(d: Record<string, unknown>, oldestMonth: string): string {
  const m = String(d["sheet_month"] ?? "").trim();
  return m || oldestMonth;
}

function isArchivedData(d: Record<string, unknown>): boolean {
  return d["archived_at"] != null && String(d["archived_at"]).trim() !== "";
}

export interface TabSyncResult {
  tab: string;
  module: string;
  /** Month ("YYYY-MM") of the workbook this tab came from. */
  month: string;
  rows: number;
  inserted: number;
  updated: number;
  /** Cards moved (or that would move, in dryRun) forward to a later stage. */
  moved: number;
  unchanged: number;
  violations: string[];
  /** WOs of this module+month present in the DB but absent from the sheet (never touched). */
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
  /** Month this bookings list belongs to. */
  month: string;
  rows: number;
  /** Row count of the previously stored list for this month. */
  previous: number;
  /** True when the stored list was actually replaced (never in dryRun). */
  replaced: boolean;
  error?: string;
}

export interface MonthSyncResult {
  month: string;
  label: string;
  sheetId: string;
  tabs: TabSyncResult[];
  bookings?: BookingsSyncResult;
  /** Set when this month's workbook failed to sync (other months continue). */
  error?: string;
}

/** A non-archived DB row absent from its month's workbook (archive candidates). */
export interface UnclaimedRow {
  id: string;
  wo: string;
  module: string;
  month: string;
}

export interface SheetSyncTotals {
  rows: number;
  inserted: number;
  updated: number;
  moved: number;
  unchanged: number;
  violations: number;
  missingFromSheet: number;
}

export interface SheetSyncResult {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  /** Flattened per-tab results across ALL months (each tagged with .month). */
  tabs: TabSyncResult[];
  /** Legacy top-level bookings — the CURRENT (latest active) month's result. */
  bookings?: BookingsSyncResult;
  /** Per-month breakdown. */
  months: MonthSyncResult[];
  /** Totals across all months. */
  totals: SheetSyncTotals;
  /** Non-archived DB rows absent from their month's sheet (fully-scanned months only). */
  unclaimedRows?: UnclaimedRow[];
  /** app_config key of the version snapshot stored after a real run. */
  versionKey?: string;
  versionError?: string;
}

interface ExistingRow {
  id: string;
  wo: string;
  status_id: string | null;
  data: Record<string, unknown>;
  archived: boolean;
}

/** Per-module info shared across all months of a run. */
interface ModInfo {
  id: string;
  slug: string;
  statusIdByName: Record<string, string>;
  /** status name → display_order (board column position). */
  statusOrderByName: Record<string, number>;
  /** status id → status name. */
  statusNameById: Record<string, string>;
  /** All DB rows of the module (fetched once, filtered per month). */
  allRows: { id: string; status_id: string | null; data: Record<string, unknown> }[];
  /** Running max column_order for appended inserts — shared across months. */
  order: number;
}

/** Per-(module, month) reconciliation state. */
interface ModCtx {
  info: ModInfo;
  month: string;
  /** dedup key → existing DB row of this month (archived rows included — see restore). */
  existing: Map<string, ExistingRow>;
  /** normalized WO number → this month's DB rows (last-resort rename matching). */
  byWo: Map<string, ExistingRow[]>;
  /** dedup keys seen in this month's sheet (across all tabs mapping to this module) */
  seenKeys: Set<string>;
  /** ids of existing DB rows matched (exactly or via fallback) this run. */
  claimedIds: Set<string>;
  inserted: number;
  updated: number;
  moved: number;
  rowCount: number;
  /** first tab result for this module+month — carries missingFromSheet */
  firstTab: TabSyncResult | null;
}

async function getModInfo(
  sb: SupabaseClient, cache: Map<string, ModInfo | null>, slug: string,
): Promise<ModInfo | null> {
  if (cache.has(slug)) return cache.get(slug)!;

  const { data: mod } = await sb.from("bajaj_modules").select("id").eq("slug", slug).single();
  if (!mod) { cache.set(slug, null); return null; }

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

  // All rows for the module, paging past the PostgREST 1000-row cap.
  const allRows: ModInfo["allRows"] = [];
  let order = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await sb
      .from("bajaj_work_orders")
      .select("id, data, column_order, status_id")
      .eq("module_slug", slug)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading ${slug} rows failed: ${error.message}`);
    for (const r of page ?? []) {
      allRows.push({
        id: r.id,
        status_id: (r.status_id as string | null) ?? null,
        data: (r.data ?? {}) as Record<string, unknown>,
      });
      order = Math.max(order, Number(r.column_order) || 0);
    }
    if (!page || page.length < PAGE) break;
  }

  const info: ModInfo = {
    id: mod.id, slug, statusIdByName, statusOrderByName, statusNameById,
    allRows, order,
  };
  cache.set(slug, info);
  return info;
}

function buildModCtx(info: ModInfo, month: string, oldestMonth: string): ModCtx {
  const existing = new Map<string, ExistingRow>();
  const byWo = new Map<string, ExistingRow[]>();
  for (const r of info.allRows) {
    if (rowMonth(r.data, oldestMonth) !== month) continue;
    const row: ExistingRow = {
      id: r.id,
      wo: String(r.data["wo"] ?? "").trim(),
      status_id: r.status_id,
      data: r.data,
      archived: isArchivedData(r.data),
    };
    existing.set(rowKey(r.data), row);
    const woKey = keyPart(r.data["wo"]);
    if (woKey) {
      const list = byWo.get(woKey) ?? [];
      list.push(row);
      byWo.set(woKey, list);
    }
  }
  return {
    info, month, existing, byWo,
    seenKeys: new Set(), claimedIds: new Set(),
    inserted: 0, updated: 0, moved: 0, rowCount: 0, firstTab: null,
  };
}

async function syncBookingsForMonth(
  sb: SupabaseClient,
  sheetId: string,
  allTabs: string[],
  month: string,
  isCurrentMonth: boolean,
  dryRun: boolean,
): Promise<BookingsSyncResult> {
  const bookingsTab = allTabs.find((t) => normHeader(t) === normHeader(BOOKINGS_TAB_NAME));
  if (!bookingsTab) {
    return { tab: BOOKINGS_TAB_NAME, month, rows: 0, previous: 0, replaced: false, error: "tab not found" };
  }
  try {
    const grid = await fetchSheetRows(sheetId, bookingsTab);
    const bookingRows = buildBookingRows(grid);
    const monthKey = bookingsKeyForMonth(month);

    // Previous count: the per-month key; for the current month fall back to
    // the legacy key (pre-migration state).
    let previous = 0;
    const keysToTry = isCurrentMonth ? [monthKey, LEGACY_BOOKINGS_KEY] : [monthKey];
    for (const k of keysToTry) {
      const { data: prev } = await sb
        .from("app_config").select("value").eq("key", k).maybeSingle();
      if (!prev?.value) continue;
      try {
        const parsed = JSON.parse(prev.value) as { rows?: unknown };
        if (Array.isArray(parsed.rows)) { previous = parsed.rows.length; break; }
      } catch { /* corrupt stored value — treat as empty */ }
    }

    let replaced = false;
    if (!dryRun) {
      // Same stored shape as the reference API: { updated_at, rows }.
      const payload = { updated_at: new Date().toISOString(), rows: bookingRows };
      const value = JSON.stringify(payload);
      const { error } = await sb
        .from("app_config").upsert({ key: monthKey, value }, { onConflict: "key" });
      if (error) throw new Error(`Bookings save failed: ${error.message}`);
      if (isCurrentMonth) {
        // Legacy mirror so the existing bookings page keeps working.
        const { error: legacyErr } = await sb
          .from("app_config").upsert({ key: LEGACY_BOOKINGS_KEY, value }, { onConflict: "key" });
        if (legacyErr) throw new Error(`Bookings legacy mirror failed: ${legacyErr.message}`);
      }
      replaced = true;
    }
    return { tab: bookingsTab, month, rows: bookingRows.length, previous, replaced };
  } catch (err) {
    return {
      tab: bookingsTab, month, rows: 0, previous: 0, replaced: false,
      error: err instanceof Error ? err.message : "Bookings sync failed",
    };
  }
}

export interface SheetSyncOptions { dryRun?: boolean }

const EMPTY_TOTALS: SheetSyncTotals = {
  rows: 0, inserted: 0, updated: 0, moved: 0, unchanged: 0, violations: 0, missingFromSheet: 0,
};

/**
 * Pull every ACTIVE monthly workbook and reconcile it into bajaj_work_orders.
 * Never throws — failures come back as { ok: false }; a single workbook
 * failing does not stop the other months.
 */
export async function runSheetSync(actor: string, opts: SheetSyncOptions = {}): Promise<SheetSyncResult> {
  const dryRun = !!opts.dryRun;

  try {
    if (!hasGoogleServiceAccount()) {
      return {
        ok: false, dryRun, tabs: [], months: [], totals: { ...EMPTY_TOTALS },
        error: `Google Sheet sync is not configured — missing env: ${missingSheetSyncEnv().join(", ")}`,
      };
    }

    const sb = createAdminClient();

    const { sources, seededFromEnv } = await resolveSheetSources(sb);
    const active = sources
      .filter((s) => s.status === "active")
      .sort((a, b) => a.month.localeCompare(b.month));
    if (active.length === 0) {
      return {
        ok: false, dryRun, tabs: [], months: [], totals: { ...EMPTY_TOTALS },
        error: "Google Sheet sync is not configured — no active workbook sources (set BAJAJ_SHEET_ID or configure bajaj_sheet_sources).",
      };
    }

    // Auto-seed the sources config from the env fallback — real runs only.
    if (seededFromEnv && !dryRun) {
      await saveSheetSources(sb, sources);
    }

    // Rows with NULL sheet_month (pre-backfill) count as the OLDEST configured
    // month, so legacy data still matches its original (July) workbook.
    const oldestMonth = sources.map((s) => s.month).sort()[0];
    const currentMonth = active[active.length - 1].month;

    const infoCache = new Map<string, ModInfo | null>();
    const allCtxs: ModCtx[] = [];
    const monthResults: MonthSyncResult[] = [];
    const unclaimedRows: UnclaimedRow[] = [];

    for (const source of active) {
      const { month, label, sheetId } = source;
      const mres: MonthSyncResult = { month, label, sheetId, tabs: [] };
      monthResults.push(mres);

      // Per-month ctx cache — dedup/matching is scoped per (module, month).
      const ctxCache = new Map<string, ModCtx>();

      try {
        const allTabs = await listSheetTabs(sheetId);
        const knownTabs = allTabs.filter((t) => SHEET_MODULE_MAP[normHeader(t)]);
        if (knownTabs.length === 0) {
          mres.error = `No recognized module tabs found. Tabs present: ${allTabs.join(", ") || "(none)"}`;
          continue;
        }

        for (const tab of knownTabs) {
          const meta = SHEET_MODULE_MAP[normHeader(tab)];
          let ctx = ctxCache.get(meta.slug);
          if (!ctx) {
            const info = await getModInfo(sb, infoCache, meta.slug);
            if (!info) continue; // unknown module in DB — skip rather than fail the sync
            ctx = buildModCtx(info, month, oldestMonth);
            ctxCache.set(meta.slug, ctx);
            allCtxs.push(ctx);
          }

          const result: TabSyncResult = {
            tab, module: meta.slug, month, rows: 0, inserted: 0, updated: 0, moved: 0, unchanged: 0,
            violations: [], missingFromSheet: [], wouldInsert: [], wouldUpdate: [], wouldMove: [],
          };
          mres.tabs.push(result);
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

            // Every record carries its workbook's month — set BEFORE dedup /
            // merge so it persists on inserts and merges alike.
            data["sheet_month"] = month;

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

            // Last-resort WO-level matching: ops sometimes REPLACE a booking or
            // container number on an existing row (rebooking) — every key
            // candidate then misses and the card would duplicate. Among this
            // month's unclaimed rows with the same WO number, prefer a row whose
            // container list overlaps, then one whose booking matches, and only
            // when the WO is otherwise unambiguous (single unclaimed row) adopt
            // that. Ambiguous multi-row WOs fall through to insert.
            if (!existing) {
              const woRows = (ctx.byWo.get(keyPart(data["wo"])) ?? []).filter(
                (r) => !ctx.claimedIds.has(r.id),
              );
              if (woRows.length > 0) {
                const sheetConts = new Set(keyPart(data["container_no"]).split(" ").filter(Boolean));
                const overlap = woRows.find((r) => {
                  const rc = keyPart(r.data["container_no"]).split(" ").filter(Boolean);
                  return rc.some((c) => sheetConts.has(c));
                });
                const bkgMatch = woRows.find(
                  (r) => keyPart(r.data["booking_no"]) !== "" &&
                         keyPart(r.data["booking_no"]) === keyPart(data["booking_no"]),
                );
                existing = overlap ?? bkgMatch ?? (woRows.length === 1 ? woRows[0] : undefined);
              }
            }

            if (existing) {
              ctx.claimedIds.add(existing.id);

              // Merge sheet values over stored data. A sheet row matching an
              // ARCHIVED card auto-restores it — reappearance means it's back.
              const merged = { ...existing.data, ...data };
              if (existing.archived) {
                delete merged["archived_at"];
                delete merged["archived_by"];
              }
              const dataChanged = !deepEquals(merged, existing.data);

              // Forward-only auto-move: when the merged data derives a strictly
              // later stage than the card's current column, advance it. Never
              // moves backward; unknown derived stages are ignored.
              const derived      = deriveStatusName(merged) as string;
              const curName      = ctx.info.statusNameById[existing.status_id ?? ""];
              const curOrder     = curName !== undefined ? ctx.info.statusOrderByName[curName] ?? -Infinity : -Infinity;
              const derivedOrder = ctx.info.statusOrderByName[derived];
              const shouldMove   = derivedOrder !== undefined && derivedOrder > curOrder;

              if (!dataChanged && !shouldMove) { result.unchanged++; continue; }

              if (dataChanged) {
                result.updated++;
                ctx.updated++;
                result.wouldUpdate.push(wo);
              }

              let newStatusId: string | undefined;
              if (shouldMove) {
                result.moved++;
                ctx.moved++;
                result.wouldMove.push(`${wo}: ${curName ?? "?"} → ${derived}`);
                newStatusId = ctx.info.statusIdByName[derived];
              }

              if (!dryRun) {
                toUpdate.push({
                  id: existing.id,
                  data: merged,
                  ...(shouldMove && newStatusId
                    ? { status_id: newStatusId, column_order: ++ctx.info.order }
                    : {}),
                });
                if (shouldMove) {
                  moveAudits.push({
                    actor_email: "system@sheet-sync",
                    action:      "moved_card",
                    target_type: "work_order",
                    target_id:   existing.id,
                    old_value:   { status: curName ?? "?" },
                    new_value:   { status: derived },
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
            const statusId = ctx.info.statusIdByName[statusName] ?? ctx.info.statusIdByName["Planning"] ?? null;
            result.inserted++;
            ctx.inserted++;
            result.wouldInsert.push(wo);
            if (!dryRun) {
              toInsert.push({
                module_id:    ctx.info.id,
                module_slug:  ctx.info.slug,
                status_id:    statusId,
                column_order: ++ctx.info.order,
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
              if (error) throw new Error(`Update failed (tab "${tab}", ${month}): ${error.message}`);
            }
            if (toInsert.length > 0) {
              const { error } = await sb.from("bajaj_work_orders").insert(toInsert);
              if (error) throw new Error(`Insert failed (tab "${tab}", ${month}): ${error.message}`);
            }
            if (moveAudits.length > 0) {
              const { error } = await sb.from("bajaj_audit_logs").insert(moveAudits);
              if (error) throw new Error(`Move audit failed (tab "${tab}", ${month}): ${error.message}`);
            }
          }
        }

        // DB rows of this month never claimed by any sheet row (exactly or via
        // fallback) — report only, never touch. Archived rows are already
        // parked and are not re-reported. Computed here (inside the try) so a
        // partially-scanned failed month never reports false "missing" rows.
        for (const ctx of ctxCache.values()) {
          if (!ctx.firstTab) continue;
          const missing: string[] = [];
          for (const [key, row] of ctx.existing) {
            if (ctx.claimedIds.has(row.id) || row.archived) continue;
            missing.push(row.wo || key);
            unclaimedRows.push({ id: row.id, wo: row.wo, module: ctx.info.slug, month });
          }
          ctx.firstTab.missingFromSheet = missing;
        }

        // Bookings for this month's workbook (+ legacy mirror for the current month).
        mres.bookings = await syncBookingsForMonth(
          sb, sheetId, allTabs, month, month === currentMonth, dryRun,
        );
      } catch (err) {
        console.error(`[sheet-sync] month ${month}`, err);
        mres.error = err instanceof Error ? err.message : "Workbook sync failed";
      }
    }

    const failed = monthResults.filter((m) => m.error);
    if (failed.length === monthResults.length) {
      // Every workbook failed — surface it as a failed run.
      return {
        ok: false, dryRun, tabs: [], months: monthResults, totals: { ...EMPTY_TOTALS },
        error: failed.map((m) => `${m.label}: ${m.error}`).join(" · "),
      };
    }

    // Flattened tab list (UI compat) + totals across all months.
    const tabResults = monthResults.flatMap((m) => m.tabs);
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
      { ...EMPTY_TOTALS },
    );

    // Legacy top-level bookings = the current (latest active) month's result.
    const bookings = monthResults.find((m) => m.month === currentMonth)?.bookings;

    const result: SheetSyncResult = {
      ok: true, dryRun, tabs: tabResults, bookings, months: monthResults, totals, unclaimedRows,
    };

    if (!dryRun) {
      // One import-batch row per (module, month) that changed.
      for (const ctx of allCtxs) {
        if (ctx.inserted === 0 && ctx.updated === 0 && ctx.moved === 0) continue;
        await sb.from("bajaj_import_batches").insert({
          module_id:     ctx.info.id,
          module_slug:   ctx.info.slug,
          filename:      `google-sheet:${ctx.month}`,
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
        target_id:   active.map((s) => s.sheetId).join(","),
        new_value:   {
          ...totals,
          months: monthResults.map((m) => ({ month: m.month, error: m.error ?? null })),
          bookings_rows: bookings && !bookings.error ? bookings.rows : 0,
        },
      });

      // Version snapshot of the post-sync state (never fails the sync itself).
      try {
        const snap = await createVersionSnapshot(
          sb, actor, { ...totals } as unknown as Record<string, number>,
          active.map((s) => s.month),
        );
        result.versionKey = snap.key;
      } catch (err) {
        console.error("[sheet-sync] snapshot failed", err);
        result.versionError = err instanceof Error ? err.message : "Snapshot failed";
      }
    }

    return result;
  } catch (err) {
    console.error("[sheet-sync]", err);
    return {
      ok: false, dryRun, tabs: [], months: [], totals: { ...EMPTY_TOTALS },
      error: err instanceof Error ? err.message : "Sheet sync failed",
    };
  }
}

export { sheetSyncEnabled };
export type { SheetSource };
