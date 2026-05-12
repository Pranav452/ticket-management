import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sb = createAdminClient();
    const { data: bajajUser } = await sb
      .from("bajaj_users")
      .select("id, email, full_name, status, role, department, supabase_uid")
      .eq("email", user.email!.trim().toLowerCase())
      .maybeSingle();

    if (!bajajUser) {
      // Auto-register as pending
      await sb.from("bajaj_users").insert({
        user_id:      user.id,
        email:        user.email!,
        full_name:    user.user_metadata?.full_name ?? null,
        supabase_uid: user.id,
        status:       "pending",
        role:         "viewer",
      });
      return NextResponse.json({ status: "pending" });
    }

    // Backfill supabase_uid / user_id if missing
    if (!bajajUser.supabase_uid) {
      await sb.from("bajaj_users")
        .update({ supabase_uid: user.id, user_id: user.id })
        .eq("id", bajajUser.id);
    }

    if (bajajUser.status === "pending")  return NextResponse.json({ status: "pending" });
    if (bajajUser.status === "rejected") return NextResponse.json({ error: "Access rejected." }, { status: 403 });

    return NextResponse.json({
      id:           bajajUser.id,
      supabase_uid: bajajUser.supabase_uid ?? user.id,
      email:        bajajUser.email,
      full_name:    bajajUser.full_name ?? null,
      role:         bajajUser.role ?? "viewer",
      department:   bajajUser.department ?? null,
      status:       bajajUser.status,
    });
  } catch (err) {
    console.error("[GET /api/bajaj/auth/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
