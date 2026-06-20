/**
 * Column ownership permission check for Bajaj RBAC.
 * Called from server-side API routes only.
 *
 * Model:
 *   - Users with role = 'admin' or 'superadmin' in bajaj_users → always allowed
 *   - Approved user with assignment for the column → allowed per flags
 *   - Approved user with module-wide assignment (status_id IS NULL) → allowed per flags
 *   - No assignment → can_view only; edit/move/assign denied
 *   - Unapproved / unauthenticated → denied
 *
 * NOTE: The old ADMIN_EMAIL hardcode is kept as a fallback only so the original
 * owner never gets locked out if their bajaj_users row is missing.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_ADMIN_EMAIL = "pranavnairop090@gmail.com";
const ADMIN_ROLES = ["admin", "superadmin"] as const;

export type ColumnAction = "can_edit" | "can_move" | "can_assign";

export interface PermResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks if the given email belongs to an admin/superadmin in bajaj_users.
 * Also returns true for the fallback hardcoded owner email.
 * Async — queries DB. Use this for API route guards.
 */
export async function isAdminEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
  if (email === FALLBACK_ADMIN_EMAIL) return true;

  const sb = createAdminClient();
  const { data } = await sb
    .from("bajaj_users")
    .select("role, status")
    .eq("email", email)
    .maybeSingle();

  return !!data && data.status === "approved" && ADMIN_ROLES.includes(data.role as typeof ADMIN_ROLES[number]);
}

/**
 * Synchronous best-effort check using ONLY the fallback email.
 * Only used in legacy call sites that can't be made async yet.
 * Prefer isAdminEmail() for all new code.
 */
export function isAdmin(email: string | null): boolean {
  return email === FALLBACK_ADMIN_EMAIL;
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

  // Admin / superadmin bypass everything
  if (await isAdminEmail(user.email)) return { allowed: true };

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

  // 3. No assignment → deny write actions
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
