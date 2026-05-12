/**
 * Shared auth helper for chat API routes.
 * Returns { userId } (Supabase auth UID) or null if unauthenticated.
 */

import { createClient } from "@/lib/supabase/server"

export async function getChatAuthContext(): Promise<{ userId: string } | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { userId: user.id }
  } catch {
    return null
  }
}
