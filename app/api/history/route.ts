import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let contentId = "";
  try { contentId = String((await request.json()).contentId || ""); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({ error: "Invalid content." }, { status: 400 });
  const { error } = await supabase.from("content_views").upsert({ user_id: user.id, content_id: contentId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,content_id" });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
