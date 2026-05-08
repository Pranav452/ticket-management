import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

/** GET /api/bajaj/statuses?module_id=... */
export async function GET(req: NextRequest) {
  try {
    const moduleId = req.nextUrl.searchParams.get("module_id");
    const pool = await getLinksPool();
    const request = pool.request();
    let query =
      "SELECT id, module_id, name, color_hex, display_order FROM bajaj_statuses";
    if (moduleId) {
      request.input("mid", sql.VarChar, moduleId);
      query += " WHERE module_id=@mid";
    }
    query += " ORDER BY display_order";
    const result = await request.query(query);
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("[GET /api/bajaj/statuses]", err);
    return NextResponse.json({ error: "Failed to fetch statuses" }, { status: 500 });
  }
}
