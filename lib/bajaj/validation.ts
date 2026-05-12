/**
 * Business rule validation for Bajaj work orders.
 *
 * Both rules apply to Sri Lanka + LINKS agent ONLY.
 *
 * Rule 1 — Container cargo conflict (Sri Lanka · LINKS):
 *   Spare parts (assy_config ~ "spare") and frames/SKD (assy_config ~ "frame|skd")
 *   must NEVER share the same container number.
 *
 * Rule 2 — Vessel capacity (Sri Lanka · LINKS):
 *   A single vessel must not have more than 25 containers assigned
 *   across LINKS work orders.
 */

import { SupabaseClient } from "@supabase/supabase-js";

/* ── scope guards ─────────────────────────────────────────────────────────── */
const SRI_LANKA_VALUES = ["Sri Lanka", "SriLanka", "sri lanka", "SRILANKA", "srilanka"];

export function isSriLanka(country: string | null | undefined): boolean {
  if (!country) return false;
  return SRI_LANKA_VALUES.some(v => v.toLowerCase() === String(country).trim().toLowerCase());
}

export function isLinks(agent: string | null | undefined): boolean {
  if (!agent) return false;
  return String(agent).trim().toUpperCase() === "LINKS";
}

export interface ValidationWarning {
  rule: "container_conflict" | "vessel_limit";
  severity: "error";
  message: string;
  detail?: string;
}

/* ── helpers ──────────────────────────────────────────────────────────────── */
export function isSpare(assyCfg: string): boolean {
  return /spare/i.test(assyCfg);
}
export function isFrame(assyCfg: string): boolean {
  return /frame|skd|f\.k\.d/i.test(assyCfg);
}
export function containerCount(containerno: string | null | undefined): number {
  if (!containerno) return 0;
  return containerno.trim().split(/\s+/).filter(Boolean).length;
}
export function containerList(containerno: string | null | undefined): string[] {
  if (!containerno) return [];
  return containerno.trim().split(/\s+/).filter(Boolean);
}

/* ── main validator ───────────────────────────────────────────────────────── */
export async function validateWorkOrderRules(
  sb: SupabaseClient,
  incoming: {
    country?:     string | null;
    agent?:       string | null;
    containerno?: string | null;
    vslname?:     string | null;
    assy_config?: string | null;
    excludeId?:   string;
  }[]
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];

  for (const row of incoming) {
    const { country, agent, containerno, vslname, assy_config, excludeId } = row;

    // Rules only apply to Sri Lanka · LINKS
    if (!isSriLanka(country)) continue;
    if (!isLinks(agent))      continue;

    // Fetch LINKS Sri Lanka WOs once (lazy)
    let linksWOs: { id: string; data: Record<string, unknown> }[] | null = null;
    async function getLinksWOs() {
      if (linksWOs !== null) return linksWOs;
      let q = sb.from("bajaj_work_orders").select("id, data").eq("module_slug", "srilanka");
      if (excludeId) q = q.neq("id", excludeId);
      const { data } = await q;
      linksWOs = (data ?? [])
        .filter(w => isLinks(String((w.data as Record<string, unknown>)["agent"] ?? "")))
        .map(w => ({ id: w.id, data: w.data as Record<string, unknown> }));
      return linksWOs;
    }

    /* ── Rule 1: spare parts vs frames in same container ───────────────── */
    if (containerno && assy_config) {
      const containers = containerList(containerno);
      if (containers.length > 0 && (isSpare(assy_config) || isFrame(assy_config))) {
        const incomingIsSpare = isSpare(assy_config);
        const incomingIsFrame = isFrame(assy_config);
        const existing = await getLinksWOs();

        for (const wo of existing) {
          const d = wo.data;
          const existingContainers = containerList(String(d["containerno"] ?? d["container_no"] ?? ""));
          const shared = existingContainers.filter(c => containers.includes(c));
          if (shared.length === 0) continue;

          const existingAssy = String(d["assy_config"] ?? "");
          if (!existingAssy) continue;

          if (
            (incomingIsSpare && isFrame(existingAssy)) ||
            (incomingIsFrame && isSpare(existingAssy))
          ) {
            warnings.push({
              rule: "container_conflict",
              severity: "error",
              message: `[Sri Lanka · LINKS] Container conflict: spare parts and frames cannot share a container.`,
              detail: `Container(s) ${shared.join(", ")} already has "${existingAssy}" cargo (WO ${d["wo"] ?? wo.id}).`,
            });
          }
        }
      }
    }

    /* ── Rule 2: vessel capacity — max 25 containers (LINKS only) ──────── */
    if (vslname && containerno) {
      const incomingCount = containerCount(containerno);
      if (incomingCount === 0) continue;

      const existing = await getLinksWOs();
      let existingTotal = 0;

      for (const wo of existing) {
        const d = wo.data;
        const woVsl = String(d["vslname"] ?? "").trim().toLowerCase();
        if (woVsl !== vslname.trim().toLowerCase()) continue;
        existingTotal += containerCount(String(d["containerno"] ?? d["container_no"] ?? ""));
      }

      const newTotal = existingTotal + incomingCount;
      if (newTotal > 25) {
        warnings.push({
          rule: "vessel_limit",
          severity: "error",
          message: `[Sri Lanka · LINKS] Vessel capacity exceeded: "${vslname}" would have ${newTotal} containers (max 25).`,
          detail: `${existingTotal} currently assigned + ${incomingCount} being added = ${newTotal}.`,
        });
      }
    }
  }

  return warnings;
}

/* ── audit existing violations (Sri Lanka · LINKS only) ──────────────────── */

export interface VesselViolation {
  vesselName:     string;
  containerCount: number;
  workOrders: {
    id:    string;
    wo:    string;
    qty:   number;
    containers: string[];
  }[];
}

export async function auditExistingViolations(sb: SupabaseClient): Promise<{
  containerConflicts: { woId: string; woA: string; woB: string; containers: string[]; assyA: string; assyB: string }[];
  vesselViolations:   VesselViolation[];
}> {
  const { data: all } = await sb
    .from("bajaj_work_orders")
    .select("id, data")
    .eq("module_slug", "srilanka");

  // Filter to LINKS only
  const rows = (all ?? [])
    .filter(wo => isLinks(String((wo.data as Record<string, unknown>)["agent"] ?? "")))
    .map(wo => {
      const d = wo.data as Record<string, unknown>;
      return {
        id:         wo.id,
        d,
        containers: containerList(String(d["containerno"] ?? d["container_no"] ?? "")),
        assy:       String(d["assy_config"] ?? ""),
        vsl:        String(d["vslname"]     ?? "").trim(),
        vslKey:     String(d["vslname"]     ?? "").trim().toLowerCase(),
        wo:         String(d["wo"]          ?? wo.id),
        qty:        Number(d["qty"]         ?? 0),
      };
    });

  /* Container conflicts — spare vs frame */
  const containerConflicts: { woId: string; woA: string; woB: string; containers: string[]; assyA: string; assyB: string }[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (!a.assy || !b.assy) continue;
      if (!(isSpare(a.assy) || isFrame(a.assy))) continue;
      if (!(isSpare(b.assy) || isFrame(b.assy))) continue;
      if ((isSpare(a.assy) && isSpare(b.assy)) || (isFrame(a.assy) && isFrame(b.assy))) continue;
      const shared = a.containers.filter(c => b.containers.includes(c));
      if (shared.length === 0) continue;
      const pairKey = [a.id, b.id].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      containerConflicts.push({ woId: a.id, woA: a.wo, woB: b.wo, containers: shared, assyA: a.assy, assyB: b.assy });
    }
  }

  /* Vessel violations — group WOs by vessel, flag > 25 */
  const vesselMap = new Map<string, { vesselName: string; wos: typeof rows }>();
  for (const row of rows) {
    if (!row.vslKey) continue;
    if (!vesselMap.has(row.vslKey)) vesselMap.set(row.vslKey, { vesselName: row.vsl, wos: [] });
    vesselMap.get(row.vslKey)!.wos.push(row);
  }

  const vesselViolations: VesselViolation[] = [];
  for (const { vesselName, wos } of vesselMap.values()) {
    const total = wos.reduce((sum, w) => sum + w.containers.length, 0);
    if (total <= 25) continue;
    vesselViolations.push({
      vesselName,
      containerCount: total,
      workOrders: wos.map(w => ({
        id:         w.id,
        wo:         w.wo,
        qty:        w.qty,
        containers: w.containers,
      })),
    });
  }
  vesselViolations.sort((a, b) => b.containerCount - a.containerCount);

  return { containerConflicts, vesselViolations };
}
