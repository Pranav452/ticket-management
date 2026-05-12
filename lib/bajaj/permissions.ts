/**
 * Column ownership permission check for Bajaj RBAC.
 * Called from server-side API routes only.
 *
 * Model:
 *   - Super admin (ADMIN_EMAIL) → always allowed, no checks
 *   - Approved user with assignment for the column → allowed per flags
 *   - Approved user with module-wide assignment (status_id IS NULL) → allowed per flags
 *   - No assignment → can_view only; edit/move/assign denied
 *   - Unapproved / unauthenticated → denied
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ADMIN_EMAIL = "pranavnairop090@gmail.com";

export type ColumnAction = "can_edit" | "can_move" | "can_assign";

export interface PermResult {
  allowed: boolean;
  reason?: string;
}

export async function checkColumnAccess(
  action: ColumnAction,
  moduleSlug: string,
  statusId: string | null,
): Promise<PermResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { allowed: false, reason: "Not authenticated" };

  // Super admin bypasses everything
  if (user.email === ADMIN_EMAIL) return { allowed: true };

  // Must be approved bajaj user
  const { data: bajajUser } = await supabase
    .from("bajaj_users")
    .select("status")
    .eq("email", user.email)
    .maybeSingle();

  if (!bajajUser || bajajUser.status !== "approved") {
    return { allowed: false, reason: "Bajaj access not approved" };
  }

  // 1. Column-specific assignment
  if (statusId) {
    const { data: specific } = await supabase
      .from("bajaj_column_assignments")
      .select(action)
      .eq("user_email", user.email)
      .eq("module_slug", moduleSlug)
      .eq("status_id", statusId)
      .maybeSingle();

    if (specific != null) {
      return { allowed: Boolean((specific as Record<string, unknown>)[action]) };
    }
  }

  // 2. Module-wide assignment (status_id IS NULL)
  const { data: moduleWide } = await supabase
    .from("bajaj_column_assignments")
    .select(action)
    .eq("user_email", user.email)
    .eq("module_slug", moduleSlug)
    .is("status_id", null)
    .maybeSingle();

  if (moduleWide != null) {
    return { allowed: Boolean((moduleWide as Record<string, unknown>)[action]) };
  }

  // 3. No assignment → deny write actions, allow view
  return {
    allowed: false,
    reason: "Not assigned to this column. Request access from your admin.",
  };
}

/** Returns the email of the currently authenticated user (null if not authed). */
export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch { return null; }
}

export function isAdmin(email: string | null): boolean {
  return email === ADMIN_EMAIL;
}
