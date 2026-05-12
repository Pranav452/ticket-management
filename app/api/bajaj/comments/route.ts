import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const woId = req.nextUrl.searchParams.get("work_order_id");
  if (!woId) return NextResponse.json({ error: "work_order_id required" }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bajaj_comments")
    .select("id, work_order_id, author_email, author_name, content, created_at")
    .eq("work_order_id", woId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((r) => ({
      id:            r.id,
      work_order_id: r.work_order_id,
      author_id:     r.author_email,
      content:       r.content,
      created_at:    r.created_at,
      author: {
        id:        r.author_email,
        email:     r.author_email,
        full_name: r.author_name ?? null,
        avatar_url: null,
      },
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const { work_order_id, author_email, author_name, content } = await req.json();
    if (!work_order_id || !content)
      return NextResponse.json({ error: "work_order_id and content required" }, { status: 400 });

    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bajaj_comments")
      .insert({ work_order_id, author_email, author_name, content })
      .select("id, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id:            data.id,
      work_order_id,
      author_id:     author_email,
      content,
      created_at:    data.created_at,
      author: { id: author_email, email: author_email, full_name: author_name ?? null, avatar_url: null },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bajaj/comments]", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
