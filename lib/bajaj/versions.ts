/**
 * Version snapshots of the Bajaj board state (bajaj_work_orders + bookings).
 *
 * After every successful REAL sheet-sync run the full board is snapshotted
 * into app_config under "bajaj_version:<ISO timestamp>":
 *
 *   { created_at, actor, totals,
 *     rows: [{ id, module_id, module_slug, status_id, column_order, data }],
 *     bookings: { "<month>": rows[] } }
 *
 * An index key "bajaj_versions" ({ versions: [...] }) lists the snapshots
 * newest-first; retention prunes to the newest 15 (older app_config rows are
 * deleted). rollbackToVersion restores a snapshot wholesale: rows are
 * upserted by id, rows NOT in the snapshot are deleted (their comments
 * cascade — acceptable), and the per-month bookings keys are restored.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const VERSIONS_INDEX_KEY = "bajaj_versions";
export const VERSION_KEY_PREFIX = "bajaj_version:";
const MAX_VERSIONS = 15;
const CHUNK = 200;

export interface VersionEntry {
  key: string;
  created_at: string;
  actor: string;
  /** Total work orders captured in the snapshot. */
  workOrders: number;
  /** Cards moved by the sync run that produced this snapshot. */
  moved: number;
  /** Cards inserted by the sync run that produced this snapshot. */
  inserted: number;
}

interface SnapshotRow {
  id: string;
  module_id: string;
  module_slug: string;
  status_id: string | null;
  column_order: number;
  data: Record<string, unknown>;
}

interface VersionSnapshot {
  created_at: string;
  actor: string;
  totals: Record<string, number>;
  rows: SnapshotRow[];
  /** month ("YYYY-MM") → booking rows for that month's workbook. */
  bookings: Record<string, unknown[]>;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** All work orders, paging past the PostgREST 1000-row cap. */
async function fetchAllWorkOrders(sb: SupabaseClient): Promise<SnapshotRow[]> {
  const out: SnapshotRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("bajaj_work_orders")
      .select("id, module_id, module_slug, status_id, column_order, data")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Snapshot read failed: ${error.message}`);
    for (const r of data ?? []) {
      out.push({
        id: r.id,
        module_id: r.module_id,
        module_slug: r.module_slug,
        status_id: (r.status_id as string | null) ?? null,
        column_order: Number(r.column_order) || 0,
        data: (r.data ?? {}) as Record<string, unknown>,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function readConfigJSON<T>(sb: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await sb.from("app_config").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return null;
  try { return JSON.parse(data.value) as T; } catch { return null; }
}

async function writeConfigJSON(sb: SupabaseClient, key: string, value: unknown): Promise<void> {
  const { error } = await sb
    .from("app_config")
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
  if (error) throw new Error(`Config write failed (${key}): ${error.message}`);
}

/** Snapshots newest-first (from the index key). */
export async function listVersions(sb: SupabaseClient): Promise<VersionEntry[]> {
  const idx = await readConfigJSON<{ versions?: unknown }>(sb, VERSIONS_INDEX_KEY);
  if (!idx || !Array.isArray(idx.versions)) return [];
  return (idx.versions as VersionEntry[]).filter(
    (v) => v && typeof v.key === "string" && v.key.startsWith(VERSION_KEY_PREFIX),
  );
}

/**
 * Capture the current board + per-month bookings as a new version snapshot,
 * update the index, and prune to the newest MAX_VERSIONS.
 */
export async function createVersionSnapshot(
  sb: SupabaseClient,
  actor: string,
  totals: Record<string, number>,
  months: string[],
): Promise<{ key: string; workOrders: number }> {
  const created_at = new Date().toISOString();
  const key = `${VERSION_KEY_PREFIX}${created_at}`;

  const rows = await fetchAllWorkOrders(sb);

  const bookings: Record<string, unknown[]> = {};
  for (const month of months) {
    const stored = await readConfigJSON<{ rows?: unknown[] }>(sb, `bajaj_bookings:${month}`);
    if (stored && Array.isArray(stored.rows)) bookings[month] = stored.rows;
  }

  const snapshot: VersionSnapshot = { created_at, actor, totals, rows, bookings };
  await writeConfigJSON(sb, key, snapshot);

  // Index: prepend newest, prune to MAX_VERSIONS, delete pruned snapshot rows.
  const entry: VersionEntry = {
    key, created_at, actor,
    workOrders: rows.length,
    moved: Number(totals.moved) || 0,
    inserted: Number(totals.inserted) || 0,
  };
  const existing = await listVersions(sb);
  const all = [entry, ...existing.filter((v) => v.key !== key)];
  const kept = all.slice(0, MAX_VERSIONS);
  const pruned = all.slice(MAX_VERSIONS);

  await writeConfigJSON(sb, VERSIONS_INDEX_KEY, { versions: kept });

  if (pruned.length > 0) {
    const { error } = await sb
      .from("app_config").delete().in("key", pruned.map((v) => v.key));
    if (error) console.error("[versions] prune failed:", error.message);
  }

  return { key, workOrders: rows.length };
}

export interface RollbackResult {
  ok: boolean;
  error?: string;
  restored?: number;
  deleted?: number;
}

/**
 * Restore a snapshot wholesale: upsert snapshot rows by id, delete current
 * rows absent from the snapshot (comments cascade), restore the per-month
 * bookings keys (+ legacy "bajaj_bookings" mirror of the latest month), and
 * write a "rollback" audit row. Never throws — returns { ok, error }.
 */
export async function rollbackToVersion(key: string, actor: string): Promise<RollbackResult> {
  try {
    if (!key || !key.startsWith(VERSION_KEY_PREFIX)) {
      return { ok: false, error: "Invalid version key" };
    }
    const sb = createAdminClient();

    const snapshot = await readConfigJSON<VersionSnapshot>(sb, key);
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return { ok: false, error: `Snapshot not found: ${key}` };
    }

    const now = new Date().toISOString();

    // 1. Upsert snapshot rows by id.
    for (const chunk of chunks(snapshot.rows, CHUNK)) {
      const { error } = await sb.from("bajaj_work_orders").upsert(
        chunk.map((r) => ({
          id: r.id,
          module_id: r.module_id,
          module_slug: r.module_slug,
          status_id: r.status_id,
          column_order: r.column_order,
          data: r.data,
          updated_at: now,
        })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`Rollback upsert failed: ${error.message}`);
    }

    // 2. Delete current rows not present in the snapshot.
    const snapshotIds = new Set(snapshot.rows.map((r) => r.id));
    const current = await fetchAllWorkOrders(sb);
    const toDelete = current.map((r) => r.id).filter((id) => !snapshotIds.has(id));
    for (const chunk of chunks(toDelete, CHUNK)) {
      const { error } = await sb.from("bajaj_work_orders").delete().in("id", chunk);
      if (error) throw new Error(`Rollback delete failed: ${error.message}`);
    }

    // 3. Restore bookings keys (+ legacy mirror of the latest snapshotted month).
    const bookingMonths = Object.keys(snapshot.bookings ?? {}).sort();
    for (const month of bookingMonths) {
      await writeConfigJSON(sb, `bajaj_bookings:${month}`, {
        updated_at: now, rows: snapshot.bookings[month],
      });
    }
    const latestMonth = bookingMonths[bookingMonths.length - 1];
    if (latestMonth) {
      await writeConfigJSON(sb, "bajaj_bookings", {
        updated_at: now, rows: snapshot.bookings[latestMonth],
      });
    }

    // 4. Audit.
    await sb.from("bajaj_audit_logs").insert({
      actor_email: actor,
      action:      "rollback",
      target_type: "app_config",
      target_id:   key,
      new_value:   { restored: snapshot.rows.length, deleted: toDelete.length },
    });

    return { ok: true, restored: snapshot.rows.length, deleted: toDelete.length };
  } catch (err) {
    console.error("[rollback]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Rollback failed" };
  }
}
