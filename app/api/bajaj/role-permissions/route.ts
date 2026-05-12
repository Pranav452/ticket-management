import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";

export async function GET() {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_role_permissions")
    .select("id, role, module_slug, can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users")
    .order("role")
    .order("module_slug");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(req: NextRequest) {
  try {
    const actorEmail = await getCurrentUserEmail();
    if (!(await isAdminEmail(actorEmail)))
      return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { role, module_slug = "*", can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users } = body;

    const validRoles = ["superadmin", "admin", "operator", "viewer"];
    if (!validRoles.includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const sb = createAdminClient();
    const { error } = await sb
      .from("bajaj_role_permissions")
      .upsert({ role, module_slug, can_view: !!can_view, can_edit_fields: !!can_edit_fields, can_move_stage: !!can_move_stage, can_import: !!can_import, can_export: !!can_export, can_manage_users: !!can_manage_users },
        { onConflict: "role,module_slug" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/bajaj/role-permissions]", err);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
