import { NextResponse } from "next/server";

// Statuses are seeded in the SQL migration — this endpoint is no longer needed.
export async function POST() {
  return NextResponse.json({ success: true, note: "Statuses are seeded in migration" });
}
