import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail } from "@/lib/bajaj/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = createAdminClient();

    if ("role" in body) {
      const validRoles = ["superadmin", "admin", "operator", "viewer"];
      if (!validRoles.includes(body.role))
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });

      const { error } = await sb.from("bajaj_users").update({ role: body.role }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const actorEmail = await getCurrentUserEmail();
    const { action, approved_by } = body;
    if (!["approve", "reject"].includes(action))
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

    const status = action === "approve" ? "approved" : "rejected";
    const { error } = await sb.from("bajaj_users").update({
      status,
      approved_by: approved_by ?? "system",
      approved_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await sb.from("bajaj_audit_logs").insert({
      actor_email: actorEmail ?? approved_by ?? "system",
      action:      action === "approve" ? "approved_user" : "rejected_user",
      target_type: "bajaj_user",
      target_id:   id,
      new_value:   { status, by: approved_by },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/bajaj/users/[id]]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
