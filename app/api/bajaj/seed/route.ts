/**
 * POST /api/bajaj/seed  — DEV ONLY
 * Inserts 20 realistic test work orders (WO 9000001–9000043) across 5 modules.
 * Safe to re-run: skips existing WO numbers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool } from "@/lib/db";

if (process.env.NODE_ENV === "production") {
  throw new Error("Seed route must not load in production");
}

const SEED_ROWS: Array<{
  wo: string; country: string; port: string; agent: string;
  plant: string; veh: string; type: string; qty: number; cont: number;
  po_no: string | null; lc_no: string | null; do_given_dt: string | null;
  module_slug: string;
}> = [
  // Nigeria
  { wo:"9000001", country:"Nigeria",           port:"Apapa Lagos",    agent:"KSHIP LOGISTICS",  plant:"Waluj",     veh:"Pulsar NS200",       type:"STD", qty: 80, cont:2, po_no:"PO-NG-2026-001", lc_no:"LC-NG-8821", do_given_dt:null,         module_slug:"nigeria" },
  { wo:"9000002", country:"Nigeria",           port:"Apapa Lagos",    agent:"KSHIP LOGISTICS",  plant:"Chakan",    veh:"CT100B",             type:"STD", qty:120, cont:3, po_no:"PO-NG-2026-002", lc_no:"LC-NG-8822", do_given_dt:"2026-02-15", module_slug:"nigeria" },
  { wo:"9000003", country:"Nigeria",           port:"Apapa Lagos",    agent:"DSV AIR & SEA",    plant:"Waluj",     veh:"Discover 125",       type:"DLX", qty: 60, cont:2, po_no:"PO-NG-2026-003", lc_no:"LC-NG-8823", do_given_dt:"2026-02-20", module_slug:"nigeria" },
  { wo:"9000004", country:"Nigeria",           port:"Apapa Lagos",    agent:"DSV AIR & SEA",    plant:"Chakan",    veh:"Avenger 220",        type:"STD", qty: 40, cont:1, po_no:"PO-NG-2026-004", lc_no:null,         do_given_dt:"2026-03-01", module_slug:"nigeria" },
  { wo:"9000005", country:"Nigeria",           port:"Apapa Lagos",    agent:"KSHIP LOGISTICS",  plant:"Waluj",     veh:"Platina 110",        type:"H",   qty:160, cont:4, po_no:"PO-NG-2026-005", lc_no:"LC-NG-8824", do_given_dt:null,         module_slug:"nigeria" },
  // Sri Lanka
  { wo:"9000010", country:"Sri Lanka",         port:"Colombo",        agent:"TRANSWAY INTL",    plant:"Chakan",    veh:"Pulsar NS160",       type:"STD", qty: 50, cont:2, po_no:"PO-SL-2026-001", lc_no:"LC-SL-4401", do_given_dt:"2026-02-10", module_slug:"srilanka" },
  { wo:"9000011", country:"Sri Lanka",         port:"Colombo",        agent:"TRANSWAY INTL",    plant:"Waluj",     veh:"CT100B",             type:"STD", qty:100, cont:3, po_no:"PO-SL-2026-002", lc_no:"LC-SL-4402", do_given_dt:"2026-02-18", module_slug:"srilanka" },
  { wo:"9000012", country:"Sri Lanka",         port:"Colombo",        agent:"FREIGHT CONNECT",  plant:"Pantnagar", veh:"Discover 125",       type:"DLX", qty: 75, cont:2, po_no:"PO-SL-2026-003", lc_no:null,         do_given_dt:"2026-03-05", module_slug:"srilanka" },
  { wo:"9000013", country:"Sri Lanka",         port:"Colombo",        agent:"FREIGHT CONNECT",  plant:"Chakan",    veh:"Platina 110",        type:"H",   qty:200, cont:5, po_no:"PO-SL-2026-004", lc_no:"LC-SL-4403", do_given_dt:"2026-03-10", module_slug:"srilanka" },
  // Bangladesh
  { wo:"9000020", country:"Bangladesh",        port:"Chattogram",     agent:"CONCORDE LINES",   plant:"Waluj",     veh:"Pulsar N250",        type:"STD", qty: 30, cont:1, po_no:"PO-BD-2026-001", lc_no:"LC-BD-7701", do_given_dt:"2026-01-28", module_slug:"bangladesh" },
  { wo:"9000021", country:"Bangladesh",        port:"Chattogram",     agent:"CONCORDE LINES",   plant:"Chakan",    veh:"CT100B",             type:"STD", qty: 90, cont:3, po_no:"PO-BD-2026-002", lc_no:"LC-BD-7702", do_given_dt:"2026-02-08", module_slug:"bangladesh" },
  { wo:"9000022", country:"Bangladesh",        port:"Chattogram",     agent:"ATLAS SHIPPING",   plant:"Waluj",     veh:"Discover 125",       type:"DLX", qty: 45, cont:2, po_no:"PO-BD-2026-003", lc_no:null,         do_given_dt:"2026-02-22", module_slug:"bangladesh" },
  // Triumph
  { wo:"9000030", country:"United Kingdom",    port:"Felixstowe",     agent:"CARMICHAEL INTL",  plant:"Chakan",    veh:"Triumph Speed 400",  type:"STD", qty: 20, cont:1, po_no:"PO-UK-2026-001", lc_no:null,         do_given_dt:"2026-02-01", module_slug:"triumph" },
  { wo:"9000031", country:"United Kingdom",    port:"Felixstowe",     agent:"CARMICHAEL INTL",  plant:"Chakan",    veh:"Triumph Speed Triple",type:"DLX",qty: 10, cont:1, po_no:"PO-UK-2026-002", lc_no:"LC-UK-001",  do_given_dt:"2026-02-14", module_slug:"triumph" },
  // VIPAR
  { wo:"9000040", country:"Dominican Republic",port:"Puerto Caucedo", agent:"TRANSCARGO",       plant:"Waluj",     veh:"Pulsar NS200",       type:"STD", qty: 70, cont:2, po_no:"PO-DR-2026-001", lc_no:"LC-DR-5501", do_given_dt:"2026-01-20", module_slug:"vipar" },
  { wo:"9000041", country:"Morocco",           port:"Casablanca",     agent:"ATLAS TRANS",      plant:"Chakan",    veh:"CT100B",             type:"STD", qty:110, cont:3, po_no:"PO-MA-2026-001", lc_no:"LC-MA-5502", do_given_dt:"2026-02-05", module_slug:"vipar" },
  { wo:"9000042", country:"Liberia",           port:"Monrovia",       agent:"TRANSCARGO",       plant:"Waluj",     veh:"Discover 125",       type:"DLX", qty: 55, cont:2, po_no:"PO-LR-2026-001", lc_no:null,         do_given_dt:"2026-02-12", module_slug:"vipar" },
  { wo:"9000043", country:"Dominican Republic",port:"Puerto Caucedo", agent:"ATLAS TRANS",      plant:"Pantnagar", veh:"Platina 110",        type:"H",   qty: 90, cont:3, po_no:"PO-DR-2026-002", lc_no:"LC-DR-5503", do_given_dt:"2026-02-28", module_slug:"vipar" },
];

// Spread stages: Planning(0) BookingReq(1) Booking(2) Container(3) SI(4) Custom(5) Gate(6) Billing(7) BL(8) Completed(9)
const STAGE_INDICES: Record<string, number> = {
  "9000001":0,"9000002":2,"9000003":3,"9000004":4,"9000005":9,
  "9000010":0,"9000011":2,"9000012":6,"9000013":9,
  "9000020":5,"9000021":0,"9000022":7,
  "9000030":4,"9000031":9,
  "9000040":0,"9000041":3,"9000042":8,"9000043":2,
};

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const pool = await getLinksPool();
  let added = 0; let skipped = 0; const errors: string[] = [];

  // Fetch statuses per module to assign status_ids
  const statusCache: Record<string, Array<{ id: string; display_order: number }>> = {};

  for (const row of SEED_ROWS) {
    const dup = await pool.request().input("wo", row.wo)
      .query("SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE wo=@wo");
    if (dup.recordset[0].n > 0) { skipped++; continue; }

    try {
      const ins = await pool.request()
        .input("wo",          row.wo)
        .input("country",     row.country)
        .input("port",        row.port)
        .input("agent",       row.agent)
        .input("plant",       row.plant)
        .input("veh",         row.veh)
        .input("type",        row.type)
        .input("qty",         row.qty)
        .input("cont",        row.cont)
        .input("po_no",       row.po_no)
        .input("lc_no",       row.lc_no)
        .input("do_given_dt", row.do_given_dt)
        .query(`
          INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
          OUTPUT inserted.id
          VALUES (@wo, @country, @port, @agent, @plant, @veh, @type, @qty, @cont, @po_no, @lc_no, @do_given_dt)
        `);

      const woId = ins.recordset[0]?.id;
      if (woId == null) continue;

      // Resolve status_id for this stage index
      const slug = row.module_slug;
      if (!statusCache[slug]) {
        const sRes = await pool.request().input("slug", slug)
          .query(`
            SELECT s.id, s.display_order
            FROM bajaj_statuses s
            JOIN bajaj_modules m ON m.id = s.module_id
            WHERE m.slug = @slug
            ORDER BY s.display_order
          `);
        statusCache[slug] = sRes.recordset;
      }
      const statuses = statusCache[slug];
      const stageIdx = STAGE_INDICES[row.wo] ?? 0;
      const statusId = statuses[stageIdx]?.id ?? statuses[0]?.id ?? null;

      await pool.request()
        .input("wo_id",       woId)
        .input("status_id",   statusId)
        .input("module_slug", slug)
        .query(`
          INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
          VALUES (@wo_id, @status_id, NULL, 0, @module_slug)
        `);

      added++;
    } catch (e) {
      errors.push(`WO ${row.wo}: ${(e as Error).message}`);
      skipped++;
    }
  }

  return NextResponse.json({ added, skipped, errors, total: SEED_ROWS.length });
}

export async function DELETE(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  const pool = await getLinksPool();
  await pool.request().query(`
    DELETE FROM bajaj_wo_meta    WHERE wo_id IN (SELECT id FROM bajaj_work_orders WHERE wo LIKE '900000%');
    DELETE FROM bajaj_work_orders WHERE wo LIKE '900000%';
  `);
  return NextResponse.json({ cleared: true });
}
