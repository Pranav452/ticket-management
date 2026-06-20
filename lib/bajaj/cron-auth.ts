/**
 * Shared secret check for scheduled (cron) endpoints.
 *
 * Cron callers have no user session, so these routes are authorized by a shared
 * secret instead. CRON_SECRET MUST be set in the environment — if it is missing
 * we deny by default (fail closed) rather than leaving the endpoint open.
 *
 * Accepts the secret via any of:
 *   - Authorization: Bearer <secret>   (Vercel Cron sends this automatically)
 *   - x-cron-secret: <secret>
 *   - ?secret=<secret>                  (manual trigger / external scheduler)
 */

import type { NextRequest } from "next/server";

export function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed: no secret configured ⇒ deny

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;

  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === expected) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret && querySecret === expected) return true;

  return false;
}
