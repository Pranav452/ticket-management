/**
 * GET  /api/bajaj/work-orders
 *   ?module=<slug>           filter by module slug (maps to country group)
 *   ?statusId=<id>
 *   ?assignedTo=<email>
 *   ?search=<text>           searches WO, FFJOBNO, BLNO, vslname, port
 *   ?dateFrom=<YYYY-MM-DD>   WODT ≥
 *   ?dateTo=<YYYY-MM-DD>     WODT ≤
 *   ?page=<n>                1-based (default 1)
 *   ?pageSize=<n>            default 50, max 200
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

// ─── Module → country mapping ───────────────────────────────────────────────
const MODULE_COUNTRY_MAP: Record<string, string[]> = {
  srilanka:   ["Sri Lanka"],
  nigeria:    ["Nigeria"],
  bangladesh: ["Bangladesh", "BANGALDESH"],
  triumph:    ["United Kingdom"],
  // vipar = everything else; handled as "NOT IN the above"
};

function buildWhereClause(
  moduleSlug: string | null,
  params: { statusId?: string; assignedTo?: string; search?: string; dateFrom?: string; dateTo?: string },
  req: sql.Request
): string {
  const conditions: string[] = [];

  // Module filter
  if (moduleSlug && moduleSlug !== "vipar") {
    const countries = MODULE_COUNTRY_MAP[moduleSlug];
    if (countries) {
      const placeholders = countries
        .map((c, i) => {
          req.input(`country${i}`, sql.VarChar, c);
          return `@country${i}`;
        })
        .join(", ");
      req.input("moduleSlug", sql.VarChar, moduleSlug);
      // Show rows matching country OR rows with NULL country stamped for this module
      conditions.push(`(w.country IN (${placeholders}) OR (w.country IS NULL AND m.module_slug = @moduleSlug))`);
    }
  } else if (moduleSlug === "vipar") {
    // vipar = all countries NOT in any other module bucket
    const allOther = Object.values(MODULE_COUNTRY_MAP).flat();
    const placeholders = allOther
      .map((c, i) => {
        req.input(`vipar_exc${i}`, sql.VarChar, c);
        return `@vipar_exc${i}`;
      })
      .join(", ");
    // Include NULL-country rows in vipar (SQL NOT IN excludes NULLs)
    conditions.push(`(w.country NOT IN (${placeholders}) OR w.country IS NULL)`);
  }

  if (params.statusId) {
    req.input("statusId", sql.VarChar, params.statusId);
    conditions.push("m.status_id = @statusId");
  }
  if (params.assignedTo) {
    req.input("assignedTo", sql.NVarChar, params.assignedTo);
    conditions.push("m.assigned_to = @assignedTo");
  }
  if (params.search) {
    req.input("search", sql.NVarChar, `%${params.search}%`);
    conditions.push(
      "(w.WO LIKE @search OR w.FFJOBNO LIKE @search OR w.BLNO LIKE @search OR w.vslname LIKE @search OR w.port LIKE @search)"
    );
  }
  if (params.dateFrom) {
    req.input("dateFrom", sql.VarChar, params.dateFrom);
    conditions.push("w.WODT >= @dateFrom");
  }
  if (params.dateTo) {
    req.input("dateTo", sql.VarChar, params.dateTo);
    conditions.push("w.WODT <= @dateTo");
  }

  return conditions.length ? "WHERE " + conditions.join(" AND ") : "";
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const moduleSlug = sp.get("module");
    const pageRaw     = parseInt(sp.get("page") ?? "1", 10);
    const pageSizeRaw = parseInt(sp.get("pageSize") ?? "50", 10);
    const page        = Math.max(1, isNaN(pageRaw)     ? 1   : pageRaw);
    const pageSize    = Math.min(200, Math.max(1, isNaN(pageSizeRaw) ? 50 : pageSizeRaw));
    const offset   = (page - 1) * pageSize;

    const pool    = await getLinksPool();
    const request = pool.request();

    request.input("offset",   sql.Int, offset);
    request.input("pageSize", sql.Int, pageSize);

    const where = buildWhereClause(
      moduleSlug,
      {
        statusId:   sp.get("statusId") ?? undefined,
        assignedTo: sp.get("assignedTo") ?? undefined,
        search:     sp.get("search") ?? undefined,
        dateFrom:   sp.get("dateFrom") ?? undefined,
        dateTo:     sp.get("dateTo") ?? undefined,
      },
      request
    );

    const dataQ = `
      SELECT *
      FROM (
        SELECT
          w.*,
          m.status_id    AS status_id,
          m.assigned_to  AS assigned_to,
          m.column_order AS column_order,
          s.name         AS status_name,
          s.color_hex    AS status_color,
          ROW_NUMBER() OVER (ORDER BY ISNULL(m.column_order, w.id)) AS rn
        FROM bajaj_work_orders w
        LEFT JOIN bajaj_wo_meta    m ON m.wo_id    = w.id
        LEFT JOIN bajaj_statuses   s ON s.id       = m.status_id
        ${where}
      ) AS paged
      WHERE rn > @offset AND rn <= @offset + @pageSize
      ORDER BY rn
    `;

    // Execute data query first
    const dataResult = await request.query(dataQ);

    // Count query needs its own request with same parameters
    const countRequest = pool.request();
    // Re-add all the same parameters that were bound to the first request
    const sp2 = req.nextUrl.searchParams;
    const moduleSlug2 = sp2.get("module");
    const where2 = buildWhereClause(
      moduleSlug2,
      {
        statusId:   sp2.get("statusId") ?? undefined,
        assignedTo: sp2.get("assignedTo") ?? undefined,
        search:     sp2.get("search") ?? undefined,
        dateFrom:   sp2.get("dateFrom") ?? undefined,
        dateTo:     sp2.get("dateTo") ?? undefined,
      },
      countRequest
    );
    const countQ2 = `
      SELECT COUNT(*) AS total
      FROM bajaj_work_orders w
      LEFT JOIN bajaj_wo_meta m ON m.wo_id = w.id
      ${where2}
    `;
    const countResult = await countRequest.query(countQ2);

    const rows = dataResult.recordset.map((r: Record<string, unknown>) => {
      // Exclude metadata/system fields from data object
      const excludeFields = new Set(['id', 'status_id', 'assigned_to', 'column_order', 'created_at', 'updated_at', 'status_name', 'status_color']);
      const data: Record<string, unknown> = {};
      Object.keys(r).forEach(key => {
        if (!excludeFields.has(key)) {
          data[key] = r[key];
        }
      });

      return {
        id: String(r.id),
        module_id: null,
        status_id: r.status_id ?? null,
        assigned_to: r.assigned_to ?? null,
        column_order: r.column_order ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data,
        status: r.status_id
          ? { id: r.status_id, name: r.status_name, color_hex: r.status_color }
          : null,
      };
    });

    return NextResponse.json({
      data:  rows,
      total: countResult.recordset[0]?.total ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/work-orders]", err);
    return NextResponse.json({ error: "Failed to fetch work orders" }, { status: 500 });
  }
}
