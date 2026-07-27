/**
 * Monthly workbook sources for the Google Sheet sync.
 *
 * Ops starts a NEW Google workbook every month (same tab layout); several
 * months stay active in parallel while shipments finish (July WOs are still
 * closing during August). The list of workbooks lives in the app_config
 * key/value table under "bajaj_sheet_sources":
 *
 *   { updated_at, sources: [{ month: "2026-07", label: "July 2026",
 *                             sheetId: "...", status: "active"|"archived" }] }
 *
 * When the config is missing/empty the legacy env var BAJAJ_SHEET_ID acts as
 * a fallback single source (July 2026 — the workbook it has always pointed
 * at). runSheetSync seeds the config from that fallback on its first REAL
 * (non-dryRun) run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasGoogleServiceAccount } from "@/lib/bajaj/google-sheets";

export const SHEET_SOURCES_KEY = "bajaj_sheet_sources";

/** Month of the workbook the legacy BAJAJ_SHEET_ID env var points at. */
export const ENV_FALLBACK_MONTH = "2026-07";
export const ENV_FALLBACK_LABEL = "July 2026";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface SheetSource {
  /** "YYYY-MM" — the month this workbook belongs to. */
  month: string;
  /** Human label, e.g. "July 2026". */
  label: string;
  /** Google spreadsheet id (the long id in the sheet URL). */
  sheetId: string;
  status: "active" | "archived";
}

export interface SheetSourcesConfig {
  updated_at: string | null;
  sources: SheetSource[];
}

function sanitizeSources(raw: unknown): SheetSource[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetSource[] = [];
  for (const s of raw as Record<string, unknown>[]) {
    if (!s || typeof s !== "object") continue;
    const month = String(s.month ?? "").trim();
    const sheetId = String(s.sheetId ?? "").trim();
    const status = s.status === "archived" ? "archived" : "active";
    if (!MONTH_RE.test(month) || !sheetId) continue;
    out.push({
      month,
      label: String(s.label ?? "").trim() || month,
      sheetId,
      status,
    });
  }
  return out;
}

/** The BAJAJ_SHEET_ID env var expressed as a source (null when unset). */
export function envFallbackSource(): SheetSource | null {
  const sheetId = process.env.BAJAJ_SHEET_ID?.trim();
  if (!sheetId) return null;
  return { month: ENV_FALLBACK_MONTH, label: ENV_FALLBACK_LABEL, sheetId, status: "active" };
}

/** Full stored config ({ updated_at, sources }); empty config when missing/corrupt. */
export async function getSheetSourcesConfig(sb: SupabaseClient): Promise<SheetSourcesConfig> {
  const { data } = await sb
    .from("app_config").select("value").eq("key", SHEET_SOURCES_KEY).maybeSingle();
  if (!data?.value) return { updated_at: null, sources: [] };
  try {
    const parsed = JSON.parse(data.value) as { updated_at?: string; sources?: unknown };
    return {
      updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : null,
      sources: sanitizeSources(parsed.sources),
    };
  } catch {
    return { updated_at: null, sources: [] }; // corrupt stored value — treat as empty
  }
}

/** Just the configured sources (empty array when the config is missing). */
export async function getSheetSources(sb: SupabaseClient): Promise<SheetSource[]> {
  return (await getSheetSourcesConfig(sb)).sources;
}

/** Persist the sources list. Returns the stored payload. */
export async function saveSheetSources(
  sb: SupabaseClient, sources: SheetSource[],
): Promise<SheetSourcesConfig> {
  const payload = { updated_at: new Date().toISOString(), sources };
  const { error } = await sb
    .from("app_config")
    .upsert({ key: SHEET_SOURCES_KEY, value: JSON.stringify(payload) }, { onConflict: "key" });
  if (error) throw new Error(`Sheet sources save failed: ${error.message}`);
  return payload;
}

/**
 * Effective sources for a sync run: the configured list, or — when the config
 * is missing/empty — the BAJAJ_SHEET_ID env fallback. `seededFromEnv` tells
 * the caller the config should be auto-seeded on a real (non-dryRun) run.
 */
export async function resolveSheetSources(
  sb: SupabaseClient,
): Promise<{ sources: SheetSource[]; seededFromEnv: boolean }> {
  const configured = await getSheetSources(sb);
  if (configured.length > 0) return { sources: configured, seededFromEnv: false };
  const env = envFallbackSource();
  return { sources: env ? [env] : [], seededFromEnv: env !== null };
}

/**
 * Oldest configured month ("YYYY-MM") — rows with NULL data.sheet_month
 * (pre-backfill legacy data) are treated as belonging to this month, so
 * month-filtered queries must OR in the null case when filtering by it.
 * Null when nothing is configured (env fallback included).
 */
export async function oldestConfiguredMonth(sb: SupabaseClient): Promise<string | null> {
  const { sources } = await resolveSheetSources(sb);
  if (sources.length === 0) return null;
  return sources.map((s) => s.month).sort()[0];
}

/**
 * Sheet sync is enabled when the Google service account is configured AND
 * there is at least one workbook to pull (an active configured source, or the
 * BAJAJ_SHEET_ID env fallback). DB lookup failures degrade to "disabled".
 */
export async function sheetSyncEnabled(sb?: SupabaseClient): Promise<boolean> {
  if (!hasGoogleServiceAccount()) return false;
  if (envFallbackSource()) return true;
  try {
    const client = sb ?? createAdminClient();
    const sources = await getSheetSources(client);
    return sources.some((s) => s.status === "active");
  } catch {
    return false;
  }
}
