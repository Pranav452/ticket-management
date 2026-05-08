/**
 * POST /api/bajaj/import
 * Accepts multipart/form-data with:
 *   file       — Excel (.xlsx) file
 *   moduleSlug — target module slug
 *
 * Parses the Excel, maps columns to TMP_TBL_BAJAJ_WO shape, inserts new rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";
import ExcelJS from "exceljs";

// Map Excel header → DB column  (case-insensitive fuzzy match)
const HEADER_MAP: Record<string, string> = {
  "ffjobno":     "FFJOBNO",
  "job no":      "FFJOBNO",
  "job number":  "FFJOBNO",
  "wo":          "WO",
  "work order":  "WO",
  "wodt":        "WODT",
  "wo date":     "WODT",
  "port":        "port",
  "country":     "country",
  "bookingno":   "bookingno",
  "booking no":  "bookingno",
  "sbno":        "SBNO",
  "sb no":       "SBNO",
  "sbdt":        "SBDT",
  "sb date":     "SBDT",
  "blno":        "BLNO",
  "bl no":       "BLNO",
  "bldt":        "BLDT",
  "bl date":     "BLDT",
  "containerno": "containerno",
  "container no":"containerno",
  "containers":  "containerno",
  "vslname":     "vslname",
  "vessel":      "vslname",
  "vessel name": "vslname",
  "sailingdt":   "SAILINGDT",
  "sailing date":"SAILINGDT",
  "remark":      "REMARK",
  "remarks":     "REMARK",
};

function matchHeader(h: string): string | null {
  const key = h.trim().toLowerCase();
  return HEADER_MAP[key] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    const moduleSlug = (formData.get("moduleSlug") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const arrayBuf  = await file.arrayBuffer();
    const uint8      = new Uint8Array(arrayBuf);
    const workbook   = new ExcelJS.Workbook();
    // ExcelJS accepts Buffer or Uint8Array; cast to satisfy older @types/exceljs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(uint8 as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) return NextResponse.json({ error: "No worksheet found" }, { status: 400 });

    // Row 1 = headers
    const headerRow = sheet.getRow(1).values as (string | undefined)[];
    const colMap: Record<number, string> = {};
    headerRow.forEach((h, idx) => {
      if (!h) return;
      const mapped = matchHeader(String(h));
      if (mapped) colMap[idx] = mapped;
    });

    const pool = await getLinksPool();
    let addedCount   = 0;
    let skippedCount = 0;

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row    = sheet.getRow(rowNum);
      const values = row.values as (string | number | undefined)[];

      const record: Record<string, string | null> = {};
      Object.entries(colMap).forEach(([idx, col]) => {
        const v = values[parseInt(idx, 10)];
        record[col] = v != null ? String(v).trim() : null;
      });

      if (!record["WO"] && !record["FFJOBNO"]) { skippedCount++; continue; }

      // Skip duplicates (by WO number)
      if (record["WO"]) {
        const existing = await pool.request()
          .input("wo", sql.VarChar, record["WO"])
          .query("SELECT COUNT(*) AS n FROM TMP_TBL_BAJAJ_WO WHERE WO=@wo");
        if (existing.recordset[0].n > 0) { skippedCount++; continue; }
      }

      await pool.request()
        .input("ffjobno",    sql.VarChar, record["FFJOBNO"]     ?? null)
        .input("wo",         sql.VarChar, record["WO"]          ?? null)
        .input("wodt",       sql.VarChar, record["WODT"]        ?? null)
        .input("port",       sql.VarChar, record["port"]        ?? null)
        .input("country",    sql.VarChar, record["country"]     ?? null)
        .input("bookingno",  sql.VarChar, record["bookingno"]   ?? null)
        .input("sbno",       sql.VarChar, record["SBNO"]        ?? null)
        .input("sbdt",       sql.VarChar, record["SBDT"]        ?? null)
        .input("blno",       sql.VarChar, record["BLNO"]        ?? null)
        .input("bldt",       sql.VarChar, record["BLDT"]        ?? null)
        .input("containerno",sql.VarChar, record["containerno"] ?? null)
        .input("vslname",    sql.VarChar, record["vslname"]     ?? null)
        .input("sailingdt",  sql.VarChar, record["SAILINGDT"]   ?? null)
        .input("remark",     sql.VarChar, record["REMARK"]      ?? null)
        .query(`
          INSERT INTO TMP_TBL_BAJAJ_WO
            (FFJOBNO,WO,WODT,port,country,bookingno,SBNO,SBDT,BLNO,BLDT,containerno,vslname,SAILINGDT,REMARK)
          VALUES
            (@ffjobno,@wo,@wodt,@port,@country,@bookingno,@sbno,@sbdt,@blno,@bldt,@containerno,@vslname,@sailingdt,@remark)
        `);
      addedCount++;
    }

    return NextResponse.json({
      success: true,
      moduleSlug,
      addedCount,
      skippedCount,
      totalRows: sheet.rowCount - 1,
    });
  } catch (err) {
    console.error("[POST /api/bajaj/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
