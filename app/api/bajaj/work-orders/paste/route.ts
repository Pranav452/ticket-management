/**
 * POST /api/bajaj/work-orders/paste
 * Body: { rows: PasteRow[], moduleSlug: string }
 *
 * Inserts rows from pasted email content into bajaj_work_orders.
 * Only the initial-stage columns are populated; all others remain null.
 * Skips duplicate WO numbers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool } from "@/lib/db";

const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

interface PasteRow {
  wo:          string;
  country?:    string;
  port?:       string;
  agent?:      string;
  plant?:      string;
  veh?:        string;   // brand
  type?:       string;   // variant
  qty?:        string | number;
  cont?:       string | number;  // 40HC container count
  po_no?:      string;
  lc_no?:      string;
  do_given_dt?: string;  // plant ready / dispatch date
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { rows: PasteRow[]; moduleSlug?: string };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const moduleSlug = String(body.moduleSlug ?? "").toLowerCase();

    if (rows.length === 0) {
      return NextResponse.json({ added: 0, skipped: 0, errors: [] });
    }

    const pool = await getLinksPool();
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const wo = String(row.wo ?? "").trim();
      if (!wo) { skipped++; continue; }

      // Dedup check
      const dup = await pool.request()
        .input("wo", wo)
        .query("SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE wo = @wo");
      if (dup.recordset[0].n > 0) { skipped++; continue; }

      const country = String(row.country ?? "").trim() || MODULE_DEFAULT_COUNTRY[moduleSlug] || null;
      const port    = String(row.port    ?? "").trim() || null;
      const agent   = String(row.agent   ?? "").trim() || null;
      const plant   = String(row.plant   ?? "").trim() || null;
      const veh     = String(row.veh     ?? "").trim() || null;
      const type    = String(row.type    ?? "").trim() || null;
      const po_no   = String(row.po_no   ?? "").trim() || null;
      const lc_no   = String(row.lc_no   ?? "").trim() || null;
      const do_given_dt = String(row.do_given_dt ?? "").trim() || null;

      const rawQty  = row.qty  != null ? parseInt(String(row.qty),  10) : null;
      const rawCont = row.cont != null ? parseInt(String(row.cont), 10) : null;
      const qty  = rawQty  != null && !isNaN(rawQty)  ? rawQty  : null;
      const cont = rawCont != null && !isNaN(rawCont) ? rawCont : null;

      try {
        const result = await pool.request()
          .input("wo",          wo)
          .input("country",     country)
          .input("port",        port)
          .input("agent",       agent)
          .input("plant",       plant)
          .input("veh",         veh)
          .input("type",        type)
          .input("qty",         qty)
          .input("cont",        cont)
          .input("po_no",       po_no)
          .input("lc_no",       lc_no)
          .input("do_given_dt", do_given_dt)
          .query(`
            INSERT INTO bajaj_work_orders
              (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
            OUTPUT inserted.id
            VALUES
              (@wo, @country, @port, @agent, @plant, @veh, @type, @qty, @cont, @po_no, @lc_no, @do_given_dt)
          `);

        const woId = result.recordset[0]?.id;
        if (woId != null) {
          await pool.request()
            .input("wo_id",      woId)
            .input("module_slug", moduleSlug || null)
            .query(`
              INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
              VALUES (@wo_id, NULL, NULL, 0, @module_slug)
            `);
        }
        added++;
      } catch (e) {
        errors.push(`WO ${wo}: ${(e as Error).message}`);
        skipped++;
      }
    }

    return NextResponse.json({ added, skipped, errors });
  } catch (err) {
    console.error("[POST /api/bajaj/work-orders/paste]", err);
    return NextResponse.json({ error: `Paste failed: ${(err as Error).message}` }, { status: 500 });
  }
}
