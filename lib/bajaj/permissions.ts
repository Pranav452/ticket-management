/**
 * Role-based permission helpers for Bajaj API routes.
 * Called from server-side API routes only.
 *
 * Model (simple roles — the Google Sheet is the source of truth for data):
 *   - role = 'admin' or 'superadmin' (approved) → full edit/move/delete
 *   - every other approved user → read-only
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
