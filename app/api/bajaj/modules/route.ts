import { NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getLinksPool();
    const result = await pool.request().query<{
      id: string;
      name: string;
      slug: string;
      display_order: number;
      created_at: string;
    }>(
      "SELECT id, name, slug, display_order, created_at FROM bajaj_modules ORDER BY display_order"
    );
    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    console.error("[GET /api/bajaj/modules]", err);
    return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, slug, display_order } = await req.json();
    if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });
    const pool = await getLinksPool();
    const r = await pool
      .request()
      .input("name", sql.NVarChar, name)
      .input("slug", sql.VarChar, slug)
      .input("order", sql.Int, display_order ?? 99)
      .query<{ id: string }>(
        "INSERT INTO bajaj_modules (name,slug,display_order) OUTPUT inserted.id VALUES (@name,@slug,@order)"
      );
    const id = r.recordset[0].id;
    const row = await pool.request().input("id", sql.VarChar, id)
      .query("SELECT * FROM bajaj_modules WHERE id=@id");
    return NextResponse.json(row.recordset[0], { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/bajaj/modules]", err);
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }
}
