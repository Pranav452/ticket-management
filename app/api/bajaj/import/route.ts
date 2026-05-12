/**
 * POST /api/bajaj/import
 * Accepts multipart/form-data with:
 *   file       — Excel (.xlsx) file
 *   moduleSlug — target module slug
 *
 * Parses the Excel, maps columns to bajaj_work_orders, inserts new rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";
import ExcelJS from "exceljs";

const HEADER_MAP: Record<string, string> = {
  "wo": "wo",
  "wo no": "wo",
  "wo no.": "wo",
  "work order": "wo",
  "work order no": "wo",
  "wodt": "wodt",
  "wo date": "wodt",
  "port": "port",
  "port (wo/pod)": "port",
  "pod": "port",
  "country": "country",
  "plant": "plant",
  "brand": "brand",
  "variant": "variant",
  "qty": "qty",
  "quantity": "qty",
  "40hc": "hc40",
  "40 hc": "hc40",
  "40hc qty": "hc40",
  "std20": "std20",
  "std 20": "std20",
  "std20 qty": "std20",
  "bookingno": "bookingno",
  "booking no": "bookingno",
  "booking no.": "bookingno",
  "sbno": "sbno",
  "sb no": "sbno",
  "sb no.": "sbno",
  "blno": "blno",
  "bl no": "blno",
  "bl no.": "blno",
  "bldt": "bldt",
  "bl date": "bldt",
  "sailingdt": "sailingdt",
  "sailing date": "sailingdt",
  "lsd": "sailingdt",
  "etd": "sailingdt",
  "assy config": "assy_config",
  "assy configuration": "assy_config",
  "remark": "remark",
  "remarks": "remark",
};

function matchHeader(h: string): string | null {
  const key = h.trim().toLowerCase().replace(/\s+/g, " ");
  return HEADER_MAP[key] ?? null;
}

// Default country to stamp when Excel has no "country" column
const MODULE_DEFAULT_COUNTRY: Record<string, string> = {
  srilanka:   "Sri Lanka",
  nigeria:    "Nigeria",
  bangladesh: "Bangladesh",
  triumph:    "United Kingdom",
  vipar:      "VIPAR",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const moduleSlug = (formData.get("moduleSlug") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const arrayBuf = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(uint8 as any);

    // Find the first sheet that actually has a "wo" / "work order" header column
    // (some Excel files put a Color Legend as the first sheet)
    let sheet = workbook.worksheets[0];
    let colMap: Record<number, string> = {};
    for (const ws of workbook.worksheets) {
      const hdr = ws.getRow(1).values as (string | undefined)[];
      const map: Record<number, string> = {};
      hdr.forEach((h, idx) => {
        if (!h) return;
        const mapped = matchHeader(String(h));
        if (mapped) map[idx] = mapped;
      });
      if (map[Object.keys(map).find((k) => map[parseInt(k)] === "wo") ? 1 : -1] !== undefined || Object.values(map).includes("wo")) {
        sheet = ws;
        colMap = map;
        break;
      }
    }
    if (!sheet) return NextResponse.json({ error: "No worksheet found" }, { status: 400 });
    // If colMap still empty (no wo column found), fall back to first sheet anyway
    if (!Object.values(colMap).includes("wo")) {
      sheet = workbook.worksheets[0];
      const hdr = sheet.getRow(1).values as (string | undefined)[];
      hdr.forEach((h, idx) => {
        if (!h) return;
        const mapped = matchHeader(String(h));
        if (mapped) colMap[idx] = mapped;
      });
    }

    const pool = await getLinksPool();
    let addedCount = 0;
    let skippedCount = 0;

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const values = row.values as (string | number | undefined)[];

      const record: Record<string, string | number | null> = {};
      Object.entries(colMap).forEach(([idx, col]) => {
        const v = values[parseInt(idx, 10)];
        if (col === "qty" || col === "hc40" || col === "std20") {
          record[col] = v != null ? parseInt(String(v)) : null;
        } else {
          record[col] = v != null ? String(v).trim() : null;
        }
      });

      if (!record["wo"]) { skippedCount++; continue; }

      // Check for duplicate
      const existing = await pool.request()
        .input("wo", sql.VarChar, String(record["wo"]))
        .query("SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE wo=@wo");

      if (existing.recordset[0].n > 0) { skippedCount++; continue; }

      // Insert work order
      const result = await pool.request()
        .input("wo", sql.VarChar, String(record["wo"]))
        .input("wodt", sql.VarChar, record["wodt"] ?? null)
        .input("port", sql.VarChar, record["port"] ?? null)
        .input("country", sql.VarChar, record["country"] ?? MODULE_DEFAULT_COUNTRY[moduleSlug] ?? null)
        .input("plant", sql.VarChar, record["plant"] ?? null)
        .input("brand", sql.VarChar, record["brand"] ?? null)
        .input("variant", sql.VarChar, record["variant"] ?? null)
        .input("qty", sql.Int, record["qty"] ?? null)
        .input("hc40", sql.Int, record["hc40"] ?? null)
        .input("std20", sql.Int, record["std20"] ?? null)
        .input("bookingno", sql.VarChar, record["bookingno"] ?? null)
        .input("sbno", sql.VarChar, record["sbno"] ?? null)
        .input("blno", sql.VarChar, record["blno"] ?? null)
        .input("bldt", sql.VarChar, record["bldt"] ?? null)
        .input("sailingdt", sql.VarChar, record["sailingdt"] ?? null)
        .input("assy_config", sql.VarChar, record["assy_config"] ?? null)
        .input("remark", sql.NVarChar, record["remark"] ?? null)
        .query(`
          INSERT INTO bajaj_work_orders
            (wo, wodt, port, country, plant, brand, variant, qty, hc40, std20, bookingno, sbno, blno, bldt, sailingdt, assy_config, remark)
          OUTPUT inserted.id
          VALUES (@wo, @wodt, @port, @country, @plant, @brand, @variant, @qty, @hc40, @std20, @bookingno, @sbno, @blno, @bldt, @sailingdt, @assy_config, @remark)
        `);

      const woId = result.recordset[0]?.id;
      if (woId) {
        await pool.request()
          .input("wo_id", sql.Int, woId)
          .input("status_id", sql.VarChar, null)
          .input("assigned_to", sql.NVarChar, null)
          .input("module_slug", sql.VarChar, moduleSlug || null)
          .query(`
            INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
            VALUES (@wo_id, @status_id, @assigned_to, 0, @module_slug)
          `);
      }

      addedCount++;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      skippedCount,
    });
  } catch (err) {
    console.error("[POST /api/bajaj/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
