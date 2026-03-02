import { NextRequest, NextResponse } from "next/server";

// Demo-only endpoint: disable real import logic and just return a stub response.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      demo: true,
      message: "Bajaj Excel import is disabled in demo mode. The board uses static sample data only.",
    },
    { status: 200 },
  );
}
