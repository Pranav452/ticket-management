import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Demo mode: do nothing with Supabase and let all routes through.
  return NextResponse.next({ request });
}
