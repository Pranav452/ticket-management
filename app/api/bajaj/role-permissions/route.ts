/**
 * GET  /api/bajaj/role-permissions          — fetch all role permissions
 * PUT  /api/bajaj/role-permissions           — upsert a permission row
 *       body: { role, module_slug, can_view, can_edit_fields, can_move_stage,
 *               can_import, can_export, can_manage_users }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinksPool, sql } from "@/lib/db";

export async function GET() {
  try {
    const pool   = await getLinksPool();
    const result = await pool.request().query(
      "SELECT id, role, module_slug, can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users FROM bajaj_role_permissions ORDER BY role, module_slug"
    );
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("[GET /api/bajaj/role-permissions]", err);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, module_slug = "*", can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users } = body;

    const validRoles = ["superadmin", "admin", "operator", "viewer"];
    if (!validRoles.includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const pool = await getLinksPool();

    // Check if row exists (MSSQL 2008 doesn't support MERGE safely, use IF EXISTS pattern)
    const existing = await pool.request()
      .input("role",        sql.VarChar(20), role)
      .input("module_slug", sql.VarChar(50), module_slug)
      .query("SELECT id FROM bajaj_role_permissions WHERE role=@role AND module_slug=@module_slug");

    if (existing.recordset.length > 0) {
      await pool.request()
        .input("role",             sql.VarChar(20), role)
        .input("module_slug",      sql.VarChar(50), module_slug)
        .input("can_view",         sql.Bit,         can_view         ? 1 : 0)
        .input("can_edit_fields",  sql.Bit,         can_edit_fields  ? 1 : 0)
        .input("can_move_stage",   sql.Bit,         can_move_stage   ? 1 : 0)
        .input("can_import",       sql.Bit,         can_import       ? 1 : 0)
        .input("can_export",       sql.Bit,         can_export       ? 1 : 0)
        .input("can_manage_users", sql.Bit,         can_manage_users ? 1 : 0)
        .query(`
          UPDATE bajaj_role_permissions
          SET can_view=@can_view, can_edit_fields=@can_edit_fields,
              can_move_stage=@can_move_stage, can_import=@can_import,
              can_export=@can_export, can_manage_users=@can_manage_users
          WHERE role=@role AND module_slug=@module_slug
        `);
    } else {
      await pool.request()
        .input("role",             sql.VarChar(20), role)
        .input("module_slug",      sql.VarChar(50), module_slug)
        .input("can_view",         sql.Bit,         can_view         ? 1 : 0)
        .input("can_edit_fields",  sql.Bit,         can_edit_fields  ? 1 : 0)
        .input("can_move_stage",   sql.Bit,         can_move_stage   ? 1 : 0)
        .input("can_import",       sql.Bit,         can_import       ? 1 : 0)
        .input("can_export",       sql.Bit,         can_export       ? 1 : 0)
        .input("can_manage_users", sql.Bit,         can_manage_users ? 1 : 0)
        .query(`
          INSERT INTO bajaj_role_permissions
            (id, role, module_slug, can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users)
          VALUES
            (NEWID(), @role, @module_slug, @can_view, @can_edit_fields, @can_move_stage, @can_import, @can_export, @can_manage_users)
        `);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/bajaj/role-permissions]", err);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
