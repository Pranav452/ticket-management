/**
 * Authorization guards for Bajaj API routes.
 *
 * Most /api/bajaj/* routes use the service-role client (createAdminClient),
 * which BYPASSES Postgres RLS. That makes a server-side authorization check
 * mandatory: without one, any authenticated (even un-approved) user — or any
 * caller that reaches the route — can read/modify all data.
 *
 * Identity ALWAYS comes from the session cookie (getCurrentUserEmail), never
 * from the request body. Use these at the top of every route that mutates or
 * reads sensitive Bajaj data:
 *
 *   const auth = await requireApprovedUser();
 *   if (auth instanceof NextResponse) return auth;   // 401 / 403 already built
 *   // ...auth.email / auth.isAdmin are now trustworthy
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserEmail, isAdminEmail } from "@/lib/bajaj/permissions";

const ADMIN_ROLES = ["admin", "superadmin"];

export interface AuthContext {
  email: string;
  role: string | null;
  isAdmin: boolean;
}

/**
 * Require an authenticated, APPROVED bajaj user.
 * Returns the auth context, or a ready-to-return NextResponse (401/403).
 */
export async function requireApprovedUser(): Promise<AuthContext | NextResponse> {
  const email = await getCurrentUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hardcoded fallback owner is always treated as approved superadmin.
  if (await isAdminEmail(email)) {
    return { email, role: "superadmin", isAdmin: true };
  }

  const sb = createAdminClient();
  const { data } = await sb
    .from("bajaj_users")
    .select("status, role")
    .eq("email", email)
    .maybeSingle();

  if (!data || data.status !== "approved") {
    return NextResponse.json({ error: "Bajaj access not approved" }, { status: 403 });
  }

  return {
    email,
    role: data.role ?? null,
    isAdmin: ADMIN_ROLES.includes(String(data.role)),
  };
}

/** Require an authenticated approved user with admin/superadmin role. */
export async function requireAdmin(): Promise<AuthContext | NextResponse> {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return auth;
}
