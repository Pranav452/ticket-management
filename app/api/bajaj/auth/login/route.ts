/**
 * POST /api/bajaj/auth/login
 * Auth is handled by Supabase — this endpoint is kept for compatibility
 * but redirects callers to use Supabase auth directly.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Use Supabase auth (signInWithPassword) directly from the client." },
    { status: 410 }
  );
}
