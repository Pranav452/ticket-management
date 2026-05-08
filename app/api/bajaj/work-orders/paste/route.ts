/**
 * POST /api/bajaj/work-orders/paste
 * Body: { WO, WODT, port, country, bookingno, SBNO, BLNO, BLDT, containerno,
 *         vslname, SAILINGDT, REMARK, FFJOBNO, moduleSlug }
 *
 * Inserts a single row from the paste importer. Skips if WO already exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string | undefined>;

    const wo = body.WO?.trim();
    if (!wo) return NextResponse.json({ error: "WO required" }, { status: 400 });

    const pool = await getLinksPool();

    // Dedup by WO
    const existing = await pool.request()
      .input("wo", sql.VarChar, wo)
      .query("SELECT COUNT(*) AS n FROM TMP_TBL_BAJAJ_WO WHERE WO=@wo");

    if (existing.recordset[0].n > 0)
      return NextResponse.json({ skipped: true, reason: "duplicate" });

    await pool.request()
      .input("ffjobno",    sql.VarChar, body.FFJOBNO    ?? null)
      .input("wo",         sql.VarChar, wo)
      .input("wodt",       sql.VarChar, body.WODT       ?? null)
      .input("port",       sql.VarChar, body.port       ?? null)
      .input("country",    sql.VarChar, body.country    ?? null)
      .input("bookingno",  sql.VarChar, body.bookingno  ?? null)
      .input("sbno",       sql.VarChar, body.SBNO       ?? null)
      .input("sbdt",       sql.VarChar, null)
      .input("blno",       sql.VarChar, body.BLNO       ?? null)
      .input("bldt",       sql.VarChar, body.BLDT       ?? null)
      .input("containerno",sql.VarChar, body.containerno ?? null)
      .input("vslname",    sql.VarChar, body.vslname    ?? null)
      .input("sailingdt",  sql.VarChar, body.SAILINGDT  ?? null)
      .input("remark",     sql.VarChar, body.REMARK     ?? null)
      .query(`
        INSERT INTO TMP_TBL_BAJAJ_WO
          (FFJOBNO,WO,WODT,port,country,bookingno,SBNO,SBDT,BLNO,BLDT,containerno,vslname,SAILINGDT,REMARK)
        VALUES
          (@ffjobno,@wo,@wodt,@port,@country,@bookingno,@sbno,@sbdt,@blno,@bldt,@containerno,@vslname,@sailingdt,@remark)
      `);

    return NextResponse.json({ success: true, wo }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/work-orders/paste]", err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
