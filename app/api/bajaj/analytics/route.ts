/**
 * GET /api/bajaj/analytics?module=<slug>
 * Queries bajaj_work_orders + bajaj_wo_meta + bajaj_statuses
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

const MODULE_COUNTRY_MAP: Record<string, string[]> = {
  srilanka:   ["Sri Lanka"],
  nigeria:    ["Nigeria"],
  bangladesh: ["Bangladesh", "BANGALDESH"],
  triumph:    ["United Kingdom"],
};

function buildModuleFilter(moduleSlug: string | null, req: import("mssql").Request): string {
  if (!moduleSlug) return "";
  if (moduleSlug === "vipar") {
    const allOther = Object.values(MODULE_COUNTRY_MAP).flat();
    const placeholders = allOther.map((c, i) => {
      req.input(`vipar_exc${i}`, sql.VarChar, c);
      return `@vipar_exc${i}`;
    }).join(",");
    return `AND (w.country NOT IN (${placeholders}) OR w.country IS NULL)`;
  }
  const countries = MODULE_COUNTRY_MAP[moduleSlug];
  if (!countries) return "";
  const placeholders = countries.map((c, i) => {
    req.input(`country${i}`, sql.VarChar, c);
    return `@country${i}`;
  }).join(",");
  return `AND w.country IN (${placeholders})`;
}

export async function GET(req: NextRequest) {
  try {
    const moduleSlug = req.nextUrl.searchParams.get("module") || null;
    const pool = await getLinksPool();

    function makeFilter() {
      const r = pool.request();
      const f = buildModuleFilter(moduleSlug, r);
      return { r, f };
    }

    const { r: r1, f: f1 } = makeFilter();
    const { r: r2, f: f2 } = makeFilter();
    const { r: r3, f: f3 } = makeFilter();
    const { r: r4, f: f4 } = makeFilter();
    const { r: r5, f: f5 } = makeFilter();
    const { r: r6, f: f6 } = makeFilter();
    const { r: r7, f: f7 } = makeFilter();
    const { r: r8, f: f8 } = makeFilter();
    const { r: r9, f: f9 } = makeFilter();

    const [
      totalRes, byStatusRes, byModuleRes, timelineRes,
      blPendingRes, containerRes, blTotalRes, lineRes, overLimitRes,
    ] = await Promise.all([

      // Total WOs
      r1.query(`
        SELECT COUNT(*) AS n
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE 1=1 ${f1}
      `),

      // By status
      r2.query(`
        SELECT
          ISNULL(s.name, 'Unassigned') AS statusName,
          ISNULL(s.color_hex, '6b7280') AS colorHex,
          COUNT(*) AS cnt
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta  m ON m.wo_id = w.id
        LEFT JOIN bajaj_statuses s ON s.id = m.status_id
        WHERE 1=1 ${f2}
        GROUP BY s.name, s.color_hex
        ORDER BY cnt DESC
      `),

      // By module
      r3.query(`
        SELECT
          CASE
            WHEN w.country IN ('Sri Lanka')               THEN 'srilanka'
            WHEN w.country IN ('Nigeria')                 THEN 'nigeria'
            WHEN w.country IN ('Bangladesh','BANGALDESH') THEN 'bangladesh'
            WHEN w.country IN ('United Kingdom')          THEN 'triumph'
            ELSE 'vipar'
          END AS slug,
          CASE
            WHEN w.country IN ('Sri Lanka')               THEN 'Sri Lanka'
            WHEN w.country IN ('Nigeria')                 THEN 'Nigeria'
            WHEN w.country IN ('Bangladesh','BANGALDESH') THEN 'Bangladesh'
            WHEN w.country IN ('United Kingdom')          THEN 'Triumph'
            ELSE 'VIPAR'
          END AS moduleName,
          COUNT(*) AS cnt
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE 1=1 ${f3}
        GROUP BY
          CASE WHEN w.country IN ('Sri Lanka') THEN 'srilanka' WHEN w.country IN ('Nigeria') THEN 'nigeria' WHEN w.country IN ('Bangladesh','BANGALDESH') THEN 'bangladesh' WHEN w.country IN ('United Kingdom') THEN 'triumph' ELSE 'vipar' END,
          CASE WHEN w.country IN ('Sri Lanka') THEN 'Sri Lanka' WHEN w.country IN ('Nigeria') THEN 'Nigeria' WHEN w.country IN ('Bangladesh','BANGALDESH') THEN 'Bangladesh' WHEN w.country IN ('United Kingdom') THEN 'Triumph' ELSE 'VIPAR' END
        ORDER BY cnt DESC
      `),

      // Import timeline by wodt month
      r4.query(`
        SELECT
          LEFT(CONVERT(varchar(10), w.wodt, 23), 7) AS date,
          COUNT(*) AS addedCount
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE w.wodt IS NOT NULL ${f4}
        GROUP BY LEFT(CONVERT(varchar(10), w.wodt, 23), 7)
        ORDER BY LEFT(CONVERT(varchar(10), w.wodt, 23), 7) DESC
      `),

      // BL pending after sailing (no blno but sailingdt set)
      r5.query(`
        SELECT COUNT(*) AS n
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE (w.blno IS NULL OR LTRIM(RTRIM(ISNULL(w.blno,'')))='')
          AND w.sailingdt IS NOT NULL
          ${f5}
      `),

      // Total containers (hc40 + std20)
      r6.query(`
        SELECT
          ISNULL(SUM(ISNULL(w.hc40,0) + ISNULL(w.std20,0)), 0) AS n
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE 1=1 ${f6}
      `),

      // Total BLs
      r7.query(`
        SELECT COUNT(*) AS n
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE w.blno IS NOT NULL AND LTRIM(RTRIM(w.blno)) != '' ${f7}
      `),

      // WOs by brand
      r8.query(`
        SELECT TOP 10
          ISNULL(w.brand, 'Unknown') AS lineName,
          COUNT(*) AS containerCount
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE 1=1 ${f8}
        GROUP BY w.brand
        ORDER BY containerCount DESC
      `),

      // Variants with high container count
      r9.query(`
        SELECT TOP 10
          ISNULL(w.variant, 'Unknown') AS vesselName,
          ISNULL(SUM(ISNULL(w.hc40,0) + ISNULL(w.std20,0)), 0) AS containerCount
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
        WHERE 1=1 ${f9}
        GROUP BY w.variant
        HAVING ISNULL(SUM(ISNULL(w.hc40,0) + ISNULL(w.std20,0)), 0) > 5
        ORDER BY containerCount DESC
      `),
    ]);

    return NextResponse.json({
      totalWorkOrders:   totalRes.recordset[0].n,
      byStatus: byStatusRes.recordset.map((r) => ({
        statusName: r.statusName,
        colorHex:   r.colorHex,
        count:      r.cnt,
      })),
      byModule: byModuleRes.recordset.map((r) => ({
        moduleName: r.moduleName,
        slug:       r.slug,
        count:      r.cnt,
      })),
      importTimeline: timelineRes.recordset.map((r) => ({
        date:       r.date,
        addedCount: r.addedCount,
        batchId:    "",
      })),
      totalContainers:    containerRes.recordset[0].n ?? 0,
      totalBLs:           blTotalRes.recordset[0].n ?? 0,
      containersByVessel: overLimitRes.recordset,
      containersByLine:   lineRes.recordset,
      blPendingAfterETD:  blPendingRes.recordset[0].n ?? 0,
      vesselsOverLimit:   overLimitRes.recordset,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/analytics]", err);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
