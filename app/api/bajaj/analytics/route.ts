/**
 * GET /api/bajaj/analytics?module=<slug>
 * Returns BajajAnalytics computed from TMP_TBL_BAJAJ_WO + bajaj_wo_meta + bajaj_statuses
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool } from "@/lib/db";

const MODULE_COUNTRY_MAP: Record<string, string[]> = {
  srilanka:   ["Sri Lanka"],
  nigeria:    ["Nigeria"],
  bangladesh: ["Bangladesh", "BANGALDESH"],
  triumph:    ["United Kingdom"],
};

function buildModuleFilter(moduleSlug: string | null): string {
  if (!moduleSlug) return "";
  if (moduleSlug === "vipar") {
    const allOther = Object.values(MODULE_COUNTRY_MAP).flat()
      .map(c => `'${c.replace(/'/g,"''")}'`)
      .join(",");
    return `AND w.country NOT IN (${allOther})`;
  }
  const countries = MODULE_COUNTRY_MAP[moduleSlug];
  if (!countries) return "";
  const list = countries.map(c => `'${c.replace(/'/g,"''")}'`).join(",");
  return `AND w.country IN (${list})`;
}

export async function GET(req: NextRequest) {
  try {
    const moduleSlug = req.nextUrl.searchParams.get("module");
    const mf = buildModuleFilter(moduleSlug);
    const pool = await getLinksPool();

    const [
      totalRes, byStatusRes, byModuleRes, timelineRes,
      blPendingRes, vesselRes, lineRes,
    ] = await Promise.all([
      // Total WOs
      pool.request().query(`SELECT COUNT(*) AS n FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}`),

      // By status (joined)
      pool.request().query(`
        SELECT
          ISNULL(s.name,'Unassigned') AS statusName,
          ISNULL(s.color_hex,'6b7280') AS colorHex,
          COUNT(*) AS cnt
        FROM TMP_TBL_BAJAJ_WO w
        LEFT JOIN bajaj_wo_meta    m ON m.pkid = w.PKID
        LEFT JOIN bajaj_statuses   s ON s.id   = m.status_id
        WHERE 1=1 ${mf}
        GROUP BY s.name, s.color_hex
        ORDER BY cnt DESC
      `),

      // By module — map country values to logical slugs
      pool.request().query(`
        SELECT
          CASE
            WHEN country IN ('Sri Lanka')              THEN 'srilanka'
            WHEN country IN ('Nigeria')                THEN 'nigeria'
            WHEN country IN ('Bangladesh','BANGALDESH') THEN 'bangladesh'
            WHEN country IN ('United Kingdom')         THEN 'triumph'
            ELSE 'vipar'
          END AS slug,
          CASE
            WHEN country IN ('Sri Lanka')              THEN 'Sri Lanka'
            WHEN country IN ('Nigeria')                THEN 'Nigeria'
            WHEN country IN ('Bangladesh','BANGALDESH') THEN 'Bangladesh'
            WHEN country IN ('United Kingdom')         THEN 'Triumph'
            ELSE 'VIPAR'
          END AS moduleName,
          COUNT(*) AS cnt
        FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}
        GROUP BY
          CASE
            WHEN country IN ('Sri Lanka')              THEN 'srilanka'
            WHEN country IN ('Nigeria')                THEN 'nigeria'
            WHEN country IN ('Bangladesh','BANGALDESH') THEN 'bangladesh'
            WHEN country IN ('United Kingdom')         THEN 'triumph'
            ELSE 'vipar'
          END,
          CASE
            WHEN country IN ('Sri Lanka')              THEN 'Sri Lanka'
            WHEN country IN ('Nigeria')                THEN 'Nigeria'
            WHEN country IN ('Bangladesh','BANGALDESH') THEN 'Bangladesh'
            WHEN country IN ('United Kingdom')         THEN 'Triumph'
            ELSE 'VIPAR'
          END
        ORDER BY cnt DESC
      `),

      // Import timeline (by WODT month)
      pool.request().query(`
        SELECT
          LEFT(WODT,7) AS date,
          COUNT(*) AS addedCount,
          '' AS batchId
        FROM TMP_TBL_BAJAJ_WO w
        WHERE WODT IS NOT NULL AND WODT != '' ${mf}
        GROUP BY LEFT(WODT,7)
        ORDER BY LEFT(WODT,7) DESC
      `),

      // BL pending after ETD (BLNO is empty but SAILINGDT is set)
      pool.request().query(`
        SELECT COUNT(*) AS n
        FROM TMP_TBL_BAJAJ_WO w
        WHERE (BLNO IS NULL OR BLNO='')
          AND SAILINGDT IS NOT NULL AND SAILINGDT != ''
          ${mf}
      `),

      // Containers by vessel
      pool.request().query(`
        SELECT TOP 20
          vslname AS vesselName,
          SUM(
            CASE WHEN containerno IS NULL OR containerno='' THEN 0
                 ELSE LEN(RTRIM(containerno)) - LEN(REPLACE(RTRIM(containerno),' ','')) + 1
            END
          ) AS containerCount
        FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}
        GROUP BY vslname
        ORDER BY containerCount DESC
      `),

      // Containers by shipping line (extracted from vessel name prefix)
      pool.request().query(`
        SELECT TOP 10
          CASE
            WHEN vslname LIKE 'APL%'    THEN 'APL'
            WHEN vslname LIKE 'MSC%'    THEN 'MSC'
            WHEN vslname LIKE 'MAERSK%' THEN 'MAERSK'
            WHEN vslname LIKE 'CMA%'    THEN 'CMA CGM'
            WHEN vslname LIKE 'HAPAG%'  THEN 'HAPAG-LLOYD'
            WHEN vslname LIKE 'EVER%'   THEN 'EVERGREEN'
            WHEN vslname LIKE 'ONE%'    THEN 'ONE'
            WHEN vslname LIKE 'COSCO%'  THEN 'COSCO'
            ELSE 'OTHER'
          END AS lineName,
          COUNT(*) AS containerCount
        FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}
        GROUP BY
          CASE
            WHEN vslname LIKE 'APL%'    THEN 'APL'
            WHEN vslname LIKE 'MSC%'    THEN 'MSC'
            WHEN vslname LIKE 'MAERSK%' THEN 'MAERSK'
            WHEN vslname LIKE 'CMA%'    THEN 'CMA CGM'
            WHEN vslname LIKE 'HAPAG%'  THEN 'HAPAG-LLOYD'
            WHEN vslname LIKE 'EVER%'   THEN 'EVERGREEN'
            WHEN vslname LIKE 'ONE%'    THEN 'ONE'
            WHEN vslname LIKE 'COSCO%'  THEN 'COSCO'
            ELSE 'OTHER'
          END
        ORDER BY containerCount DESC
      `),
    ]);

    // Total containers (count space-separated values in containerno)
    const containerTotal = await pool.request().query(`
      SELECT SUM(
        CASE WHEN containerno IS NULL OR containerno='' THEN 0
             ELSE LEN(RTRIM(containerno)) - LEN(REPLACE(RTRIM(containerno),' ','')) + 1
        END
      ) AS n FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}
    `);

    // Total BLs (non-empty BLNO)
    const blTotal = await pool.request().query(`
      SELECT COUNT(*) AS n FROM TMP_TBL_BAJAJ_WO w
      WHERE BLNO IS NOT NULL AND BLNO != '' ${mf}
    `);

    // Vessels over 25 containers
    const overLimitRes = await pool.request().query(`
      SELECT vslname AS vesselName,
        SUM(
          CASE WHEN containerno IS NULL OR containerno='' THEN 0
               ELSE LEN(RTRIM(containerno)) - LEN(REPLACE(RTRIM(containerno),' ','')) + 1
          END
        ) AS containerCount
      FROM TMP_TBL_BAJAJ_WO w WHERE 1=1 ${mf}
      GROUP BY vslname
      HAVING SUM(
          CASE WHEN containerno IS NULL OR containerno='' THEN 0
               ELSE LEN(RTRIM(containerno)) - LEN(REPLACE(RTRIM(containerno),' ','')) + 1
          END
        ) > 25
      ORDER BY containerCount DESC
    `);

    return NextResponse.json({
      totalWorkOrders: totalRes.recordset[0].n,
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
        batchId:    r.batchId,
      })),
      totalContainers:      containerTotal.recordset[0].n ?? 0,
      totalBLs:             blTotal.recordset[0].n,
      containersByVessel:   vesselRes.recordset,
      containersByLine:     lineRes.recordset,
      blPendingAfterETD:    blPendingRes.recordset[0].n,
      vesselsOverLimit:     overLimitRes.recordset,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/analytics]", err);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
