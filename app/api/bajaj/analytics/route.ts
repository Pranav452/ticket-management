import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const moduleSlug = req.nextUrl.searchParams.get("module") || null;
    const sb = createAdminClient();

    let woQuery = sb
      .from("bajaj_work_orders")
      .select("id, module_slug, status_id, data, created_at, bajaj_statuses(name, color_hex)");

    if (moduleSlug) woQuery = woQuery.eq("module_slug", moduleSlug);

    const { data: wos, error } = await woQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = wos ?? [];

    // Total
    const totalWorkOrders = rows.length;

    // By status
    const statusMap = new Map<string, { statusName: string; colorHex: string; count: number }>();
    for (const wo of rows) {
      const st = wo.bajaj_statuses as unknown as { name: string; color_hex: string } | null;
      const name = st?.name ?? "Unassigned";
      const hex  = st?.color_hex ?? "6b7280";
      const key  = name;
      const entry = statusMap.get(key) ?? { statusName: name, colorHex: hex, count: 0 };
      entry.count++;
      statusMap.set(key, entry);
    }
    const byStatus = [...statusMap.values()].sort((a, b) => b.count - a.count);

    // By module
    const moduleMap = new Map<string, number>();
    for (const wo of rows) {
      const slug = wo.module_slug ?? "unknown";
      moduleMap.set(slug, (moduleMap.get(slug) ?? 0) + 1);
    }
    const MODULE_NAMES: Record<string, string> = {
      srilanka: "Sri Lanka", nigeria: "Nigeria", bangladesh: "Bangladesh",
      triumph: "Triumph", vipar: "VIPAR",
    };
    const byModule = [...moduleMap.entries()].map(([slug, count]) => ({
      slug, moduleName: MODULE_NAMES[slug] ?? slug, count,
    })).sort((a, b) => b.count - a.count);

    // Import timeline by month
    const timelineMap = new Map<string, number>();
    for (const wo of rows) {
      if (!wo.created_at) continue;
      const month = wo.created_at.slice(0, 7);
      timelineMap.set(month, (timelineMap.get(month) ?? 0) + 1);
    }
    const importTimeline = [...timelineMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, addedCount]) => ({ date, addedCount, batchId: "" }));

    // Containers (sum data->>'cont')
    let totalContainers = 0;
    for (const wo of rows) {
      const d = wo.data as Record<string, unknown>;
      totalContainers += parseInt(String(d?.cont ?? 0), 10) || 0;
    }

    // BLs (data->>'blno' non-empty)
    const totalBLs = rows.filter((wo) => {
      const d = wo.data as Record<string, unknown>;
      return d?.blno != null && String(d.blno).trim() !== "";
    }).length;

    // BL pending after ETD (no blno but vessel_etd set)
    const blPendingAfterETD = rows.filter((wo) => {
      const d = wo.data as Record<string, unknown>;
      const hasBlno = d?.blno != null && String(d.blno).trim() !== "";
      const hasEtd  = d?.vessel_etd != null && String(d.vessel_etd).trim() !== "";
      return !hasBlno && hasEtd;
    }).length;

    // Top agents (as "by line")
    const agentMap = new Map<string, number>();
    for (const wo of rows) {
      const d = wo.data as Record<string, unknown>;
      const agent = String(d?.agent ?? "Unknown");
      agentMap.set(agent, (agentMap.get(agent) ?? 0) + 1);
    }
    const containersByLine = [...agentMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([lineName, containerCount]) => ({ lineName, containerCount }));

    // Top vessels by container count
    const vesselMap = new Map<string, number>();
    for (const wo of rows) {
      const d = wo.data as Record<string, unknown>;
      const vsl = String(d?.vslname ?? d?.veh ?? "Unknown");
      const cont = parseInt(String(d?.cont ?? 0), 10) || 0;
      vesselMap.set(vsl, (vesselMap.get(vsl) ?? 0) + cont);
    }
    const containersByVessel = [...vesselMap.entries()]
      .filter(([, c]) => c > 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vesselName, containerCount]) => ({ vesselName, containerCount }));

    return NextResponse.json({
      totalWorkOrders,
      byStatus,
      byModule,
      importTimeline,
      totalContainers,
      totalBLs,
      blPendingAfterETD,
      containersByLine,
      containersByVessel,
      vesselsOverLimit: containersByVessel,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/analytics]", err);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
