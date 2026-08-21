/**
 * Archive-missing capability for the monthly sheet sync.
 *
 * The sync itself NEVER touches DB rows absent from their month's workbook —
 * it only reports them. archiveMissing() is the explicit admin action that
 * parks those rows: it re-runs the reconciliation as a dry run, takes the
 * per-(module, month) unclaimed rows, and stamps data.archived_at /
 * data.archived_by on them (jsonb only — no schema change, no deletion).
 *
 * Archived cards are skipped by the sync's missing-report, but if their row
 * reappears in the sheet the sync auto-restores them (clears the archive
 * stamps) — reappearance means the shipment is back.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSheetSync, type UnclaimedRow } from "@/lib/bajaj/sheet-sync";

const CHUNK = 100;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface ArchiveMissingResult {
  ok: boolean;
  error?: string;
  /** Rows actually archived. */
  archived: number;
  /** WO numbers archived (for the audit trail / UI). */
  workOrders: string[];
  /** The unclaimed rows that were archived, grouped info per row. */
  rows: UnclaimedRow[];
}

/**
 * Archive every non-archived DB row (per module + month, active sources only)
 * that is absent from its month's workbook. Never throws.
 */
export async function archiveMissing(actor: string): Promise<ArchiveMissingResult> {
  try {
    // Recompute which rows are missing — dry run, zero board writes.
    // explain:false — this run only feeds the archive logic; nobody reads a
    // briefing for it.
    const sync = await runSheetSync(actor, { dryRun: true, explain: false });
    if (!sync.ok) {
      return { ok: false, error: sync.error ?? "Sheet reconciliation failed", archived: 0, workOrders: [], rows: [] };
    }

    const unclaimed = sync.unclaimedRows ?? [];
    if (unclaimed.length === 0) {
      return { ok: true, archived: 0, workOrders: [], rows: [] };
    }

    const sb = createAdminClient();
    const now = new Date().toISOString();
    const archivedRows: UnclaimedRow[] = [];

    for (const batch of chunks(unclaimed, CHUNK)) {
      const byId = new Map(batch.map((u) => [u.id, u]));
      const { data: dbRows, error } = await sb
        .from("bajaj_work_orders")
        .select("id, data")
        .in("id", [...byId.keys()]);
      if (error) throw new Error(`Archive read failed: ${error.message}`);

      for (const row of dbRows ?? []) {
        const data = { ...((row.data ?? {}) as Record<string, unknown>) };
        if (data["archived_at"]) continue; // already archived — idempotent
        data["archived_at"] = now;
        data["archived_by"] = actor;
        const { error: updErr } = await sb
          .from("bajaj_work_orders")
          .update({ data, updated_at: now })
          .eq("id", row.id);
        if (updErr) throw new Error(`Archive update failed (${row.id}): ${updErr.message}`);
        const u = byId.get(row.id);
        if (u) archivedRows.push(u);
      }
    }

    const workOrders = archivedRows.map((r) => r.wo).filter(Boolean);
    await sb.from("bajaj_audit_logs").insert({
      actor_email: actor,
      action:      "archived_missing",
      target_type: "work_order",
      target_id:   "bulk",
      new_value:   { count: archivedRows.length, work_orders: workOrders },
    });

    return { ok: true, archived: archivedRows.length, workOrders, rows: archivedRows };
  } catch (err) {
    console.error("[archive-missing]", err);
    return {
      ok: false, error: err instanceof Error ? err.message : "Archive failed",
      archived: 0, workOrders: [], rows: [],
    };
  }
}

export interface RestoreResult { ok: boolean; error?: string }

/** Clear the archive stamps on one card (manual un-archive). */
export async function restoreArchived(id: string, actor: string): Promise<RestoreResult> {
  try {
    const sb = createAdminClient();
    const { data: row, error } = await sb
      .from("bajaj_work_orders").select("id, data").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, error: "Work order not found" };

    const data = { ...((row.data ?? {}) as Record<string, unknown>) };
    if (!data["archived_at"] && !data["archived_by"]) {
      return { ok: false, error: "Work order is not archived" };
    }
    const previous = { archived_at: data["archived_at"] ?? null, archived_by: data["archived_by"] ?? null };
    delete data["archived_at"];
    delete data["archived_by"];

    const { error: updErr } = await sb
      .from("bajaj_work_orders")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updErr) throw new Error(updErr.message);

    await sb.from("bajaj_audit_logs").insert({
      actor_email: actor,
      action:      "restored_archived",
      target_type: "work_order",
      target_id:   id,
      old_value:   previous,
      new_value:   { wo: String(data["wo"] ?? "") },
    });

    return { ok: true };
  } catch (err) {
    console.error("[restore-archived]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Restore failed" };
  }
}

export interface ArchivedRow {
  id: string;
  module_slug: string;
  status_id: string | null;
  wo: string;
  month: string | null;
  archived_at: string;
  archived_by: string | null;
  data: Record<string, unknown>;
}

/** All archived work orders (data.archived_at set), newest archive first. */
export async function getArchived(sb?: SupabaseClient): Promise<ArchivedRow[]> {
  const client = sb ?? createAdminClient();
  const out: ArchivedRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("bajaj_work_orders")
      .select("id, module_slug, status_id, data")
      .not("data->>archived_at", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Archived list failed: ${error.message}`);
    for (const r of data ?? []) {
      const d = (r.data ?? {}) as Record<string, unknown>;
      out.push({
        id: r.id,
        module_slug: r.module_slug,
        status_id: (r.status_id as string | null) ?? null,
        wo: String(d["wo"] ?? "").trim(),
        month: d["sheet_month"] ? String(d["sheet_month"]) : null,
        archived_at: String(d["archived_at"] ?? ""),
        archived_by: d["archived_by"] ? String(d["archived_by"]) : null,
        data: d,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  out.sort((a, b) => b.archived_at.localeCompare(a.archived_at));
  return out;
}
