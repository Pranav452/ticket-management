import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/bajaj/guards";

// Statuses are seeded in the SQL migration — this endpoint is no longer needed.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ success: true, note: "Statuses are seeded in migration" });
}
