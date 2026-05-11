/**
 * POST /api/bajaj/work-orders/paste
 * Body: Any fields from the email table (wo, country, port, vessel_name, blno, etc.)
 *
 * Dynamically inserts WO with all provided fields. Skips if WO already exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

// Map email field names → DB column names (case-insensitive)
const FIELD_MAP: Record<string, string> = {
  "wo": "wo",
  "work order": "wo",
  "country": "country",
  "port": "port",
  "veh": "veh",
  "vehicle": "veh",
  "qty": "qty",
  "quantity": "qty",
  "cont": "cont",
  "container": "cont",
  "type": "type",
  "plant": "plant",
  "s/line": "s_line",
  "s_line": "s_line",
  "shipping line": "s_line",
  "vessel name": "vessel_name",
  "vessel": "vessel_name",
  "agent": "agent",
  "transporter": "transporter",
  "po no": "po_no",
  "po_no": "po_no",
  "lc no": "lc_no",
  "lc_no": "lc_no",
  "lc date": "lc_date",
  "lc_date": "lc_date",
  "ff job": "ff_job",
  "ff_job": "ff_job",
  "booking no": "booking_no",
  "booking_no": "booking_no",
  "bookingno": "booking_no",
  "sbno": "sbno",
  "sb no": "sbno",
  "sb date": "sb_date",
  "sb_date": "sb_date",
  "blno": "blno",
  "bl no": "blno",
  "bldt": "bldt",
  "bl dt": "bldt",
  "bl date": "bldt",
  "bl handover time": "bl_handover_time",
  "bl_handover_time": "bl_handover_time",
  "for hbl": "for_hbl",
  "for_hbl": "for_hbl",
  "haz": "haz",
  "hazardous": "haz",
  "vgm submitted": "vgm_submitted",
  "vgm_submitted": "vgm_submitted",
  "si submitted": "si_submitted",
  "si_submitted": "si_submitted",
  "consignee": "consignee",
  "container no": "container_no",
  "container_no": "container_no",
  "pol gate": "pol_gate",
  "pol_gate": "pol_gate",
  "stuffing on": "stuffing_on",
  "stuffing_on": "stuffing_on",
  "do given dt": "do_given_dt",
  "do_given_dt": "do_given_dt",
  "pick up dt": "pick_up_dt",
  "pick_up_dt": "pick_up_dt",
  "cntr dispatch": "cntr_dispatch",
  "cntr_dispatch": "cntr_dispatch",
  "gate open": "gate_open",
  "gate_open": "gate_open",
  "gate cut off": "gate_cut_off",
  "gate_cut_off": "gate_cut_off",
  "si cut off": "si_cut_off",
  "si_cut_off": "si_cut_off",
  "cntr report nhava sheva": "cntr_report_nhava_sheva",
  "cntr_report_nhava_sheva": "cntr_report_nhava_sheva",
  "cntr gated in port": "cntr_gated_in_port",
  "cntr_gated_in_port": "cntr_gated_in_port",
  "final vsl sob": "final_vsl_sob",
  "final_vsl_sob": "final_vsl_sob",
  "do etd": "do_etd",
  "do_etd": "do_etd",
  "current etd": "current_etd",
  "current_etd": "current_etd",
  "eta at destination": "eta_at_destination",
  "eta_at_destination": "eta_at_destination",
  "sailingdt": "sailingdt",
  "sailing dt": "sailingdt",
  "sailing date": "sailingdt",
  "s/line payment status": "s_line_payment_status",
  "s_line_payment_status": "s_line_payment_status",
  "e doc status": "e_doc_status",
  "e_doc_status": "e_doc_status",
  "clearance point": "clearance_point",
  "clearance_point": "clearance_point",
  "open order": "open_order",
  "open_order": "open_order",
  "buffer yard": "buffer_yard",
  "buffer_yard": "buffer_yard",
  "courier dt": "courier_dt",
  "courier_dt": "courier_dt",
  "remark": "remark",
  "remarks": "remark",
  "remark 1": "remark",
};

function mapFieldName(key: string): string {
  const lower = key.toLowerCase().trim();
  return FIELD_MAP[lower] || lower;
}

const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const wo = String(body.WO || body.wo || "").trim();
    const moduleSlug = String(body.moduleSlug || body.module || "").toLowerCase();
    if (!wo) return NextResponse.json({ error: "WO required" }, { status: 400 });

    const pool = await getLinksPool();

    // Dedup by WO
    const existing = await pool.request()
      .input("wo", sql.VarChar, wo)
      .query("SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE wo=@wo");

    if (existing.recordset[0].n > 0)
      return NextResponse.json({ skipped: true, reason: "duplicate" });

    // Build dynamic INSERT
    const request = pool.request();
    const fields: string[] = ["wo"];
    const values: string[] = ["@wo"];
    request.input("wo", sql.VarChar, wo);

    // Map and add all provided fields
    Object.entries(body).forEach(([key, val]) => {
      if (!val || key.toLowerCase() === "moduleslug" || key.toLowerCase() === "module") return;
      const dbCol = mapFieldName(key);
      if (dbCol && val) {
        fields.push(dbCol);
        values.push(`@${dbCol}`);

        // Determine SQL type
        if (dbCol === "qty" && typeof val === "number") {
          request.input(dbCol, sql.Int, val);
        } else if (["haz", "vgm_submitted", "si_submitted"].includes(dbCol)) {
          request.input(dbCol, sql.Bit, val === true || val === "true" ? 1 : 0);
        } else if (dbCol.includes("date") || dbCol.includes("dt") || dbCol.includes("time")) {
          request.input(dbCol, sql.VarChar, String(val));
        } else {
          request.input(dbCol, sql.NVarChar, String(val));
        }
      }
    });

    // Stamp country from moduleSlug if not already in the data
    if (!fields.includes("country") && moduleSlug && MODULE_DEFAULT_COUNTRY[moduleSlug]) {
      fields.push("country");
      values.push("@country");
      request.input("country", sql.VarChar, MODULE_DEFAULT_COUNTRY[moduleSlug]);
    }

    const query = `INSERT INTO bajaj_work_orders (${fields.join(", ")}) OUTPUT inserted.id VALUES (${values.join(", ")})`;
    const result = await request.query(query);
    const woId = result.recordset[0]?.id;

    // Create metadata with Planning status
    if (woId) {
      await pool.request()
        .input("wo_id", sql.Int, woId)
        .input("module_slug", sql.VarChar, moduleSlug || null)
        .query(`INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug) VALUES (@wo_id, NULL, NULL, 0, @module_slug)`);
    }

    return NextResponse.json({ success: true, wo, id: woId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/work-orders/paste]", err);
    return NextResponse.json({ error: `Insert failed: ${(err as Error).message}` }, { status: 500 });
  }
}
